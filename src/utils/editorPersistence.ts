import { v4 as uuidv4 } from 'uuid';
import { store } from '../store/store';
import { openResumeRecord, removeResumeFromList, setSaveState } from '../store/resumeSlice';
import { deleteResume, listResumes, saveResume, saveSettings, updateResumeRecord } from '../db/resumeDB';
import type { ResumeData, ResumeRecord } from '../types/resume';
import { validateResumeRecord } from './resumeSchema';

let timer: ReturnType<typeof setTimeout> | undefined;
let writes: Promise<void> = Promise.resolve();

function cancelPendingSave() {
  clearTimeout(timer);
  timer = undefined;
}

/** Serialize saves and retain edits made while IndexedDB was committing. */
export function flushEditor(): Promise<void> {
  cancelPendingSave();
  const operation = writes.catch(() => {}).then(async () => {
    let state = store.getState().resume;
    if (!state.hydrated) return;
    while (true) {
      const { activeResumeId, data, jobDescription, revision, settings } = state;
      store.dispatch(setSaveState({ status: 'saving' }));
      try {
        const saved = await updateResumeRecord(activeResumeId, existing => ({
          ...existing, data, jobDescription, jdMatchScore: undefined,
          updatedAt: new Date().toISOString(),
        }));
        await saveSettings(settings);
        state = store.getState().resume;
        if (state.activeResumeId !== activeResumeId) return;
        if (state.revision === revision) {
          store.dispatch(setSaveState({ status: 'saved', savedAt: saved.updatedAt }));
          return;
        }
      } catch (error) {
        if (store.getState().resume.activeResumeId === activeResumeId) {
          store.dispatch(setSaveState({ status: 'error', error: error instanceof Error ? error.message : 'Save failed. Please retry.' }));
        }
        throw error;
      }
    }
  });
  writes = operation;
  return operation;
}

/** Call only after the outgoing document has been flushed. */
export function openEditorRecord(record: ResumeRecord): void {
  validateResumeRecord(record);
  cancelPendingSave();
  store.dispatch(openResumeRecord(record));
}

export async function createEditorResume(data: ResumeData, name: string): Promise<void> {
  await flushEditor();
  const now = new Date().toISOString();
  const record: ResumeRecord = {
    id: uuidv4(), name: name.trim() || 'My Resume', data,
    createdAt: now, updatedAt: now, versions: [],
  };
  await saveResume(record);
  // The user may still be typing while the new record is being written.
  await flushEditor();
  openEditorRecord(record);
}

export async function deleteEditorResume(id: string): Promise<void> {
  await flushEditor();
  const records = await listResumes();
  if (records.length < 2) throw new Error('Create another resume before deleting the last one.');
  const replacement = records.find(record => record.id !== id);
  if (!replacement) throw new Error('No replacement resume is available.');
  validateResumeRecord(replacement);
  await deleteResume(id);
  if (store.getState().resume.activeResumeId === id) openEditorRecord(replacement);
  store.dispatch(removeResumeFromList(id));
}

export function startEditorPersistence(): () => void {
  let previous = store.getState().resume;
  if (previous.hydrated && previous.settings.autoSave && previous.saveStatus === 'dirty') {
    timer = setTimeout(() => { void flushEditor().catch(() => {}); }, 700);
  }
  const unsubscribe = store.subscribe(() => {
    const state = store.getState().resume;
    if (state.revision === previous.revision && state.hydrated === previous.hydrated) return;
    previous = state;
    cancelPendingSave();
    if (state.hydrated && state.settings.autoSave && state.saveStatus === 'dirty') {
      timer = setTimeout(() => { void flushEditor().catch(() => {}); }, 700);
    }
  });
  const beforeUnload = (event: BeforeUnloadEvent) => {
    const state = store.getState().resume;
    if (state.hydrated && state.saveStatus !== 'saved') {
      event.preventDefault();
      event.returnValue = '';
    }
  };
  const visibility = () => {
    const state = store.getState().resume;
    if (document.visibilityState === 'hidden' && state.hydrated && state.settings.autoSave && state.saveStatus !== 'saved') {
      void flushEditor().catch(() => {});
    }
  };
  window.addEventListener('beforeunload', beforeUnload);
  document.addEventListener('visibilitychange', visibility);
  return () => {
    unsubscribe();
    cancelPendingSave();
    window.removeEventListener('beforeunload', beforeUnload);
    document.removeEventListener('visibilitychange', visibility);
  };
}
