// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blankResumeData } from '../data/sampleResume';
import { setJobDescription, updatePersonalInfo, updateSettings } from '../store/resumeSlice';
import type { ResumeRecord } from '../types/resume';

const date = '2026-01-01T00:00:00.000Z';
const record = (id = 'first'): ResumeRecord => ({
  id, name: `${id} resume`, createdAt: date, updatedAt: date,
  data: structuredClone(blankResumeData), versions: [], jobDescription: `${id} job`,
});

let store: typeof import('../store/store')['store'];
let db: typeof import('../db/resumeDB');
let persistence: typeof import('./editorPersistence');
let stop: (() => void) | undefined;

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new IDBFactory());
  // Leave IndexedDB's asynchronous request scheduling real while controlling debounce time.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  ({ store } = await import('../store/store'));
  db = await import('../db/resumeDB');
  persistence = await import('./editorPersistence');
});

afterEach(async () => {
  stop?.();
  stop = undefined;
  await persistence.flushEditor().catch(() => {});
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function open(records = [record()]) {
  for (const item of records) await db.saveResume(item);
  persistence.openEditorRecord(records[0]);
  stop = persistence.startEditorPersistence();
}

describe('editor persistence with IndexedDB', () => {
  it('does not write defaults or pre-hydration edits, even on explicit flush or hiding the page', async () => {
    const existing = record('default-resume');
    existing.data.personalInfo.name = 'Previously saved';
    await db.saveResume(existing);
    stop = persistence.startEditorPersistence();
    store.dispatch(updatePersonalInfo({ name: 'Not hydrated' }));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(1000);
    await persistence.flushEditor();
    expect(store.getState().resume.hydrated).toBe(false);
    expect(await db.listResumes()).toEqual([existing]);
    expect(await db.loadSettings()).toBeUndefined();
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('debounces hydrated edits and saves only the latest document and settings', async () => {
    await open();
    store.dispatch(updatePersonalInfo({ name: 'First keystrokes' }));
    await vi.advanceTimersByTimeAsync(699);
    expect((await db.loadResume('first'))?.data.personalInfo.name).toBe('');
    store.dispatch(updatePersonalInfo({ name: 'Final keystrokes' }));
    store.dispatch(updateSettings({ darkMode: true }));
    await vi.advanceTimersByTimeAsync(699);
    expect(store.getState().resume.saveStatus).toBe('dirty');
    expect((await db.loadResume('first'))?.data.personalInfo.name).toBe('');
    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(() => expect(store.getState().resume.saveStatus).toBe('saved'));
    const saved = await db.loadResume('first');
    expect(saved?.data.personalInfo.name).toBe('Final keystrokes');
    expect(await db.loadSettings()).toEqual(store.getState().resume.settings);
    expect(store.getState().resume.lastSaved).toBe(saved?.updatedAt);
    expect(store.getState().resume.saveError).toBeNull();
  });

  it('flushes final outgoing edits before creating and opening a new resume', async () => {
    await open();
    store.dispatch(updatePersonalInfo({ name: 'Final outgoing edit' }));
    store.dispatch(setJobDescription('Outgoing job description'));
    const incoming = structuredClone(blankResumeData);
    incoming.personalInfo.name = 'New candidate';
    await persistence.createEditorResume(incoming, '  New resume  ');
    const state = store.getState().resume;
    expect(state.activeResumeId).not.toBe('first');
    expect(state).toMatchObject({ data: incoming, jobDescription: '', saveStatus: 'saved', history: { past: [], future: [] } });
    expect(await db.loadResume('first')).toMatchObject({
      data: { personalInfo: { name: 'Final outgoing edit' } }, jobDescription: 'Outgoing job description',
    });
    expect(await db.loadResume(state.activeResumeId)).toMatchObject({ name: 'New resume', data: incoming, versions: [] });
    await vi.advanceTimersByTimeAsync(1000);
    expect(await db.listResumes()).toHaveLength(2);
  });

  it('preserves metadata and versions updated outside the editor while invalidating a stale JD score', async () => {
    await open();
    const version = { id: 'v1', label: 'Before edits', createdAt: date, data: structuredClone(blankResumeData) };
    await db.updateResumeRecord('first', current => ({
      ...current, name: 'Renamed elsewhere', targetJob: 'Staff engineer', versions: [version], jdMatchScore: 91,
    }));
    store.dispatch(updatePersonalInfo({ summary: 'Latest summary' }));
    await persistence.flushEditor();
    const saved = await db.loadResume('first');
    expect(saved).toMatchObject({
      id: 'first', name: 'Renamed elsewhere', targetJob: 'Staff engineer', createdAt: date,
      versions: [version], data: { personalInfo: { summary: 'Latest summary' } },
    });
    expect(saved?.jdMatchScore).toBeUndefined();
  });

  it('preserves outgoing edits made while the new resume is being saved', async () => {
    await open();
    store.dispatch(updatePersonalInfo({ name: 'Before create' }));
    const original = IDBObjectStore.prototype.put;
    let edited = false;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      const request = key === undefined ? original.call(this, value) : original.call(this, value, key);
      if (!edited && this.name === 'resumes' && (value as ResumeRecord).id !== 'first') {
        edited = true;
        store.dispatch(updatePersonalInfo({ name: 'Final edit during create' }));
      }
      return request;
    });
    await persistence.createEditorResume(structuredClone(blankResumeData), 'New resume');
    expect(edited).toBe(true);
    expect(store.getState().resume.activeResumeId).not.toBe('first');
    expect((await db.loadResume('first'))?.data.personalInfo.name).toBe('Final edit during create');
  });

  it('schedules existing unsaved edits when persistence starts after hydration', async () => {
    await db.saveResume(record());
    persistence.openEditorRecord(record());
    store.dispatch(updatePersonalInfo({ name: 'Edited before subscription' }));
    stop = persistence.startEditorPersistence();
    await vi.advanceTimersByTimeAsync(1000);
    await vi.waitFor(async () => {
      expect((await db.loadResume('first'))?.data.personalInfo.name).toBe('Edited before subscription');
      expect(store.getState().resume.saveStatus).toBe('saved');
    });
  });

  it('cancels a pending autosave when autosave is disabled, but still permits manual saving', async () => {
    await open();
    store.dispatch(updatePersonalInfo({ name: 'Manual only' }));
    await vi.advanceTimersByTimeAsync(500);
    store.dispatch(updateSettings({ autoSave: false }));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(2000);
    expect((await db.loadResume('first'))?.data.personalInfo.name).toBe('');
    expect(store.getState().resume.saveStatus).toBe('dirty');
    await persistence.flushEditor();
    expect((await db.loadResume('first'))?.data.personalInfo.name).toBe('Manual only');
    expect((await db.loadSettings())?.autoSave).toBe(false);
  });

  it('flushes on visibility loss and warns before unload only while unsaved', async () => {
    await open();
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    store.dispatch(updatePersonalInfo({ name: 'Before backgrounding' }));
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => expect(store.getState().resume.saveStatus).toBe('saved'));
    expect((await db.loadResume('first'))?.data.personalInfo.name).toBe('Before backgrounding');
  });

  it('removes listeners and cancels the pending timer on teardown', async () => {
    await open();
    store.dispatch(updatePersonalInfo({ name: 'Not saved after stop' }));
    stop!();
    stop = undefined;
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    await vi.advanceTimersByTimeAsync(1000);
    expect(event.defaultPrevented).toBe(false);
    expect((await db.loadResume('first'))?.data.personalInfo.name).toBe('');
  });

  it.each(['resumes', 'settings'])('reports a failed %s write, retains edits, and recovers on retry', async failingStore => {
    await open();
    store.dispatch(updatePersonalInfo({ name: 'Keep my edit' }));
    const original = IDBObjectStore.prototype.put;
    const failure = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      if (this.name === failingStore) throw new Error('Storage quota exceeded');
      return key === undefined ? original.call(this, value) : original.call(this, value, key);
    });
    await expect(persistence.flushEditor()).rejects.toThrow('Storage quota exceeded');
    expect(store.getState().resume).toMatchObject({
      saveStatus: 'error', saveError: 'Storage quota exceeded', lastSaved: date,
      data: { personalInfo: { name: 'Keep my edit' } },
    });
    if (failingStore === 'resumes') expect(await db.loadResume('first')).toEqual(record());
    failure.mockRestore();
    await persistence.flushEditor();
    expect(store.getState().resume).toMatchObject({ saveStatus: 'saved', saveError: null });
    expect((await db.loadResume('first'))?.data.personalInfo.name).toBe('Keep my edit');
  });

  it('surfaces an autosave failure without an unhandled rejection or automatic retry loop', async () => {
    await open();
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => { throw new Error('Autosave failed'); });
    store.dispatch(updatePersonalInfo({ name: 'Unsaved' }));
    await vi.advanceTimersByTimeAsync(700);
    await vi.waitFor(() => expect(store.getState().resume.saveStatus).toBe('error'));
    await vi.advanceTimersByTimeAsync(2000);
    expect(store.getState().resume.saveError).toBe('Autosave failed');
    expect(IDBObjectStore.prototype.put).toHaveBeenCalledTimes(1);
  });

  it('handles an asynchronous IndexedDB request failure without committing partial resume edits', async () => {
    await open();
    store.dispatch(updatePersonalInfo({ name: 'Aborted edit' }));
    const original = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      // An add with the existing resume ID fails asynchronously and aborts the transaction.
      if (this.name === 'resumes') return this.add(value);
      return key === undefined ? original.call(this, value) : original.call(this, value, key);
    });
    await expect(persistence.flushEditor()).rejects.toMatchObject({ name: 'ConstraintError' });
    expect(await db.loadResume('first')).toEqual(record());
    expect(store.getState().resume).toMatchObject({
      saveStatus: 'error', lastSaved: date, data: { personalInfo: { name: 'Aborted edit' } },
    });
    expect(store.getState().resume.saveError).toBeTruthy();
  });

  it('does not create or switch documents if the outgoing flush fails', async () => {
    await open();
    store.dispatch(updatePersonalInfo({ name: 'Must not lose' }));
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => { throw new Error('Write failed'); });
    await expect(persistence.createEditorResume(structuredClone(blankResumeData), 'New')).rejects.toThrow('Write failed');
    expect(store.getState().resume.activeResumeId).toBe('first');
    expect(store.getState().resume.data.personalInfo.name).toBe('Must not lose');
    expect(await db.listResumes()).toEqual([record()]);
  });

  it.each(['resumes', 'settings'])('retains edits made during a %s write and serializes overlapping flushes', async editedDuring => {
    await open();
    store.dispatch(updatePersonalInfo({ name: 'Initial edit' }));
    const original = IDBObjectStore.prototype.put;
    let injected = false;
    const committedNames: string[] = [];
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      const request = key === undefined ? original.call(this, value) : original.call(this, value, key);
      if (this.name === 'resumes') committedNames.push((value as ResumeRecord).data.personalInfo.name);
      if (this.name === editedDuring && !injected) {
        injected = true;
        expect(store.getState().resume.saveStatus).toBe('saving');
        store.dispatch(updatePersonalInfo({ name: 'Edit during save' }));
        store.dispatch(setJobDescription('JD during save'));
        store.dispatch(updateSettings({ darkMode: true }));
      }
      return request;
    });
    await Promise.all([persistence.flushEditor(), persistence.flushEditor()]);
    expect(injected).toBe(true);
    expect(committedNames[0]).toBe('Initial edit');
    expect(committedNames.slice(1)).toEqual(expect.arrayContaining(['Edit during save']));
    expect(await db.loadResume('first')).toMatchObject({
      data: { personalInfo: { name: 'Edit during save' } }, jobDescription: 'JD during save',
    });
    expect((await db.loadSettings())?.darkMode).toBe(true);
    expect(store.getState().resume.saveStatus).toBe('saved');
  });

  it('deletes the active resume without a pending autosave resurrecting it', async () => {
    await open([record(), record('second')]);
    store.dispatch(updatePersonalInfo({ name: 'Pending deletion' }));
    await persistence.deleteEditorResume('first');
    expect(store.getState().resume).toMatchObject({ activeResumeId: 'second', jobDescription: 'second job', history: { past: [], future: [] } });
    expect(store.getState().resume.resumeList.some(item => item.id === 'first')).toBe(false);
    await vi.advanceTimersByTimeAsync(2000);
    await persistence.flushEditor();
    expect(await db.loadResume('first')).toBeUndefined();
    expect((await db.listResumes()).map(item => item.id)).toEqual(['second']);
  });

  it('rejects stale saves of a record deleted outside the editor rather than recreating it', async () => {
    await open();
    store.dispatch(updatePersonalInfo({ name: 'Stale edit' }));
    await db.deleteResume('first');
    await expect(persistence.flushEditor()).rejects.toThrow('not found');
    expect(await db.listResumes()).toEqual([]);
    expect(store.getState().resume.saveStatus).toBe('error');
  });

  it('refuses to delete the last resume and leaves its final edits persisted', async () => {
    await open();
    store.dispatch(updatePersonalInfo({ name: 'Only resume' }));
    await expect(persistence.deleteEditorResume('first')).rejects.toThrow('last one');
    expect(store.getState().resume.activeResumeId).toBe('first');
    expect((await db.loadResume('first'))?.data.personalInfo.name).toBe('Only resume');
  });

  it('keeps job descriptions scoped to their persisted resume across switches and creation', async () => {
    await open([record(), record('second')]);
    store.dispatch(setJobDescription('First updated job'));
    await persistence.flushEditor();
    persistence.openEditorRecord((await db.loadResume('second'))!);
    expect(store.getState().resume.jobDescription).toBe('second job');
    store.dispatch(setJobDescription('Second updated job'));
    await persistence.flushEditor();
    persistence.openEditorRecord((await db.loadResume('first'))!);
    expect(store.getState().resume.jobDescription).toBe('First updated job');
    await persistence.createEditorResume(structuredClone(blankResumeData), '');
    expect(store.getState().resume.jobDescription).toBe('');
    expect(await db.loadResume(store.getState().resume.activeResumeId)).toMatchObject({ name: 'My Resume' });
    expect((await db.loadResume('second'))?.jobDescription).toBe('Second updated job');
  });
});
