import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { blankResumeData } from '../data/sampleResume';
import type { JDMatchResult, ResumeRecord } from '../types/resume';
import resumeReducer, {
  MAX_HISTORY, loadResumeData, openResumeRecord, redo, setActiveSection,
  setJDMatchResult, setJobDescription, setSaveState, setShowTemplateGallery,
  undo, updateAISettings, updatePersonalInfo, updateSettings,
} from './resumeSlice';
import { undoRedoMiddleware } from './undoMiddleware';

const date = '2026-01-01T00:00:00.000Z';
const record = (id = 'first'): ResumeRecord => ({
  id, name: `${id} resume`, createdAt: date, updatedAt: date,
  data: { ...structuredClone(blankResumeData), personalInfo: { ...blankResumeData.personalInfo, name: id } },
  versions: [], jobDescription: `${id} job`,
});
const match: JDMatchResult = { score: 75, matchedKeywords: ['TypeScript'], missingKeywords: ['SQL'], suggestions: [] };
const makeStore = () => configureStore({
  reducer: { resume: resumeReducer },
  middleware: getDefaultMiddleware => getDefaultMiddleware().concat(undoRedoMiddleware),
});
let store: ReturnType<typeof makeStore>;

beforeEach(() => { store = makeStore(); });

describe('resume safety and history', () => {
  it('starts unhydrated and does not mark pre-hydration changes as saved editor edits', () => {
    expect(store.getState().resume).toMatchObject({ hydrated: false, revision: 0, saveStatus: 'saved', lastSaved: null });
    store.dispatch(updatePersonalInfo({ name: 'Before hydration' }));
    expect(store.getState().resume).toMatchObject({ hydrated: false, revision: 1, saveStatus: 'saved', lastSaved: null });
    store.dispatch(openResumeRecord(record()));
    expect(store.getState().resume).toMatchObject({
      hydrated: true, revision: 2, saveStatus: 'saved', lastSaved: date,
      data: record().data, history: { past: [], future: [] },
    });
  });

  it('openEditorRecord isolates both undo and redo stacks and clears stale JD/error state', async () => {
    vi.resetModules();
    const { store: editorStore } = await import('./store');
    const { openEditorRecord } = await import('../utils/editorPersistence');
    openEditorRecord(record());
    editorStore.dispatch(updatePersonalInfo({ name: 'First edit' }));
    editorStore.dispatch(updatePersonalInfo({ name: 'Second edit' }));
    editorStore.dispatch(undo());
    expect(editorStore.getState().resume.history.past).toHaveLength(1);
    expect(editorStore.getState().resume.history.future).toHaveLength(1);
    editorStore.dispatch(setJDMatchResult(match));
    editorStore.dispatch(setSaveState({ status: 'error', error: 'Old failure' }));
    openEditorRecord(record('second'));
    expect(editorStore.getState().resume).toMatchObject({
      activeResumeId: 'second', jobDescription: 'second job', jdMatchResult: null,
      saveStatus: 'saved', saveError: null, lastSaved: date, history: { past: [], future: [] },
    });
    editorStore.dispatch(undo());
    editorStore.dispatch(redo());
    expect(editorStore.getState().resume.data).toEqual(record('second').data);
    editorStore.dispatch(updatePersonalInfo({ name: 'Second resume edit' }));
    editorStore.dispatch(undo());
    expect(editorStore.getState().resume.data).toEqual(record('second').data);
    editorStore.dispatch(redo());
    expect(editorStore.getState().resume.data.personalInfo.name).toBe('Second resume edit');
  });

  it('rejects an invalid openEditorRecord before replacing the active document or history', async () => {
    vi.resetModules();
    const { store: editorStore } = await import('./store');
    const { openEditorRecord } = await import('../utils/editorPersistence');
    openEditorRecord(record());
    editorStore.dispatch(updatePersonalInfo({ name: 'Retain this edit' }));
    const before = editorStore.getState();
    expect(() => openEditorRecord({ ...record('bad'), data: {} } as ResumeRecord)).toThrow();
    expect(editorStore.getState()).toBe(before);
  });

  it('treats data replacement as one undoable edit without sharing mutable snapshots', () => {
    store.dispatch(openResumeRecord(record()));
    const imported = structuredClone(blankResumeData);
    imported.personalInfo.name = 'Imported candidate';
    store.dispatch(loadResumeData(imported));
    const snapshot = store.getState().resume.history.past[0];
    store.dispatch(updatePersonalInfo({ name: 'Edited import' }));
    expect(snapshot).toEqual(record().data);
    store.dispatch(undo());
    expect(store.getState().resume.data.personalInfo.name).toBe('Imported candidate');
    store.dispatch(undo());
    expect(store.getState().resume.data).toEqual(record().data);
    store.dispatch(redo());
    expect(store.getState().resume.data.personalInfo.name).toBe('Imported candidate');
    expect(store.getState().resume.saveStatus).toBe('dirty');
  });

  it('bounds history and clears the redo branch after a new edit', () => {
    store.dispatch(openResumeRecord(record()));
    for (let i = 0; i < MAX_HISTORY + 5; i++) store.dispatch(updatePersonalInfo({ name: `Edit ${i}` }));
    expect(store.getState().resume.history.past).toHaveLength(MAX_HISTORY);
    store.dispatch(undo());
    expect(store.getState().resume.history.future).toHaveLength(1);
    store.dispatch(updatePersonalInfo({ name: 'New branch' }));
    expect(store.getState().resume.history.future).toEqual([]);
    store.dispatch(redo());
    expect(store.getState().resume.data.personalInfo.name).toBe('New branch');
  });

  it.each([
    ['data', () => updatePersonalInfo({ name: 'Changed' })],
    ['job description', () => setJobDescription('New target job')],
    ['undo', () => undo()],
    ['redo', () => redo()],
  ])('invalidates a JD analysis and advances the revision for %s edits', (_, action) => {
    store.dispatch(openResumeRecord(record()));
    store.dispatch(updatePersonalInfo({ name: 'Undoable edit' }));
    store.dispatch(undo());
    store.dispatch(setJDMatchResult(match));
    store.dispatch(setSaveState({ status: 'error', error: 'Previous failure' }));
    const revision = store.getState().resume.revision;
    store.dispatch(action());
    expect(store.getState().resume).toMatchObject({ revision: revision + 1, saveStatus: 'dirty', saveError: null, jdMatchResult: null });
  });

  it('tracks JD and settings changes without adding resume-data undo snapshots', () => {
    store.dispatch(openResumeRecord(record()));
    store.dispatch(setJobDescription('Changed JD'));
    store.dispatch(updateSettings({ autoSave: false }));
    store.dispatch(updateAISettings({ provider: 'openai', apiKey: 'test-key' }));
    expect(store.getState().resume).toMatchObject({
      revision: 4, saveStatus: 'dirty', jobDescription: 'Changed JD', history: { past: [], future: [] },
      settings: { autoSave: false, ai: { provider: 'openai', apiKey: 'test-key' } },
    });
    store.dispatch(openResumeRecord({ ...record('second'), jobDescription: undefined }));
    expect(store.getState().resume.jobDescription).toBe('');
    expect(store.getState().resume.settings.autoSave).toBe(false);
  });

  it('does not dirty the document or history for UI, analysis, or save-status updates', () => {
    store.dispatch(openResumeRecord(record()));
    const revision = store.getState().resume.revision;
    store.dispatch(setActiveSection('experience'));
    store.dispatch(setShowTemplateGallery(true));
    store.dispatch(setJDMatchResult(match));
    store.dispatch(setSaveState({ status: 'saving' }));
    store.dispatch(setSaveState({ status: 'saved', savedAt: date }));
    expect(store.getState().resume).toMatchObject({ revision, saveStatus: 'saved', history: { past: [], future: [] }, jdMatchResult: match });
  });
});
