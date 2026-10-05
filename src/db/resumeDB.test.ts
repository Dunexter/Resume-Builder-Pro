import 'fake-indexeddb/auto';
import { IDBObjectStore } from 'fake-indexeddb';
import { openDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blankResumeData } from '../data/sampleResume';
import type { AppSettings, CoverLetter, ResumeRecord } from '../types/resume';
import { importWorkspaceBackup, isWorkspaceBackup, MAX_BACKUP_FILE_BYTES, readBackupFile, WorkspaceBackup } from '../utils/backupUtils';
import { deleteResume, listAllCoverLetters, listResumes, loadResume, loadSettings, loadWorkspaceRecords, migrateFromLocalStorage, restoreWorkspaceRecords, saveCoverLetter, saveResume, saveSettings, updateResumeRecord } from './resumeDB';

const date = '2026-01-01T00:00:00.000Z';
const resume = (id = 'r'): ResumeRecord => ({ id, name: id, createdAt: date, updatedAt: date, data: structuredClone(blankResumeData), versions: [] });
const letter = (resumeId = 'r', id = JSON.stringify(['cover-letter', resumeId, 'job'])): CoverLetter => ({ id, resumeId, companyName: '', jobTitle: '', content: 'draft', createdAt: date, updatedAt: date });
const settings = (provider: AppSettings['ai']['provider'] = 'openai', apiKey = 'local-secret'): AppSettings => ({ ai: { provider, apiKey }, darkMode: false, autoSave: true });
const backup = (): WorkspaceBackup => ({ app: 'resume-builder-pro', schemaVersion: 1, exportedAt: date, resumes: [resume()], coverLetters: [letter()] });

beforeEach(async () => {
  await listResumes();
  const db = await openDB('resume-builder-pro', 1);
  const tx = db.transaction(['resumes', 'settings', 'coverLetters'], 'readwrite');
  await Promise.all(['resumes', 'settings', 'coverLetters'].map(store => tx.objectStore(store).clear()));
  await tx.done;
  db.close();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('atomic resume persistence', () => {
  it('serializes concurrent updates without losing versions or metadata', async () => {
    await saveResume(resume());
    await Promise.all([
      updateResumeRecord('r', current => ({ ...current, jobDescription: 'new job', versions: [{ id: 'v', label: '', createdAt: date, data: current.data }] })),
      updateResumeRecord('r', current => ({ ...current, name: 'renamed' })),
    ]);
    expect(await loadResume('r')).toMatchObject({ name: 'renamed', jobDescription: 'new job', versions: [{ id: 'v' }] });
  });

  it('rejects invalid saves, invalid updaters and ID changes without modifying data', async () => {
    const original = resume();
    await saveResume(original);
    await expect(saveResume({ ...original, data: {} } as ResumeRecord)).rejects.toThrow();
    await expect(updateResumeRecord('r', current => ({ ...current, id: 'other' }))).rejects.toThrow('ID');
    await expect(updateResumeRecord('r', current => { current.name = 'lost'; throw new Error('updater failed'); })).rejects.toThrow('updater failed');
    await expect(updateResumeRecord('r', current => ({ ...current, jdMatchScore: NaN }))).rejects.toThrow();
    await expect(updateResumeRecord('missing', current => current)).rejects.toThrow('not found');
    expect(await loadResume('r')).toEqual(original);
  });

  it('deletes only the selected resume and its cover letters', async () => {
    await restoreWorkspaceRecords([resume(), resume('other')], [letter(), letter('other')]);
    await deleteResume('r');
    expect((await listResumes()).map(item => item.id)).toEqual(['other']);
    expect((await listAllCoverLetters()).map(item => item.resumeId)).toEqual(['other']);
    await expect(saveCoverLetter(letter())).rejects.toThrow('not found');
  });

  it('rolls back the cascade when deleting a cover letter fails', async () => {
    await restoreWorkspaceRecords([resume()], [letter()]);
    const original = IDBObjectStore.prototype.delete;
    vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementation(function (this: IDBObjectStore, key) {
      if (this.name === 'coverLetters') throw new Error('delete failure');
      return original.call(this, key);
    });
    await expect(deleteResume('r')).rejects.toThrow('delete failure');
    expect(await loadResume('r')).toEqual(resume());
    expect(await listAllCoverLetters()).toEqual([letter()]);
  });
});

describe('workspace backups', () => {
  it('preserves both colliding resumes and remaps deterministic cover letter IDs and references', async () => {
    await restoreWorkspaceRecords([resume()], [letter()]);
    const incoming = backup();
    incoming.resumes[0].name = 'imported';
    await expect(importWorkspaceBackup(incoming, 'merge')).resolves.toEqual({ resumesImported: 1, coverLettersImported: 1, settingsImported: false });
    const imported = (await listResumes()).find(record => record.name === 'imported')!;
    expect(imported.id).not.toBe('r');
    expect(await loadResume('r')).toEqual(resume());
    expect(await listAllCoverLetters()).toEqual(expect.arrayContaining([
      letter(), letter(imported.id),
    ]));
    expect(incoming.resumes[0].id).toBe('r');
    expect(incoming.coverLetters[0].resumeId).toBe('r');
  });

  it('preserves opaque cover-letter ID collisions independently of resume collisions', async () => {
    await restoreWorkspaceRecords([resume()], [letter('r', 'opaque')]);
    await restoreWorkspaceRecords([resume('other')], [letter('other', 'opaque')]);
    const letters = await listAllCoverLetters();
    expect(letters).toHaveLength(2);
    expect(letters.find(item => item.resumeId === 'other')!.id).not.toBe('opaque');
  });

  it.each([false, true])('rolls back all stores after an asynchronous write failure (replace=%s)', async replace => {
    await restoreWorkspaceRecords([resume()], [letter()], settings());
    const before = await loadWorkspaceRecords();
    const original = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      // Fail a real IDB request after resume/letter writes have succeeded in this transaction.
      if (this.name === 'settings') return this.add({ key: 'appSettings', value });
      return key === undefined ? original.call(this, value) : original.call(this, value, key);
    });
    await expect(restoreWorkspaceRecords([resume('incoming')], [letter('incoming')], settings('gemini', 'new-key'), replace)).rejects.toThrow();
    expect(await loadWorkspaceRecords()).toEqual(before);
  });

  it('rolls back clears and earlier writes after a synchronous request failure', async () => {
    await restoreWorkspaceRecords([resume()], [letter()], settings());
    const before = await loadWorkspaceRecords();
    const original = IDBObjectStore.prototype.add;
    vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (this: IDBObjectStore, value, key) {
      if (this.name === 'coverLetters') throw new Error('quota failure');
      return key === undefined ? original.call(this, value) : original.call(this, value, key);
    });
    await expect(restoreWorkspaceRecords([resume('new')], [letter('new')], settings('gemini', ''), true)).rejects.toThrow('quota failure');
    expect(await loadWorkspaceRecords()).toEqual(before);
  });

  it('successfully replaces records but retains settings when not requested', async () => {
    await restoreWorkspaceRecords([resume()], [letter()], settings());
    await restoreWorkspaceRecords([resume('new')], [letter('new')], undefined, true);
    expect(await listResumes()).toEqual([resume('new')]);
    expect(await listAllCoverLetters()).toEqual([letter('new')]);
    expect(await loadSettings()).toEqual(settings());
  });

  it.each([
    ['same provider', 'openai', false, 'local-secret'],
    ['different provider', 'gemini', false, ''],
    ['disabled provider', 'none', false, ''],
    ['explicit empty key', 'openai', true, ''],
  ] as const)('restores redacted settings safely: %s', async (_, provider, includesApiKey, expectedKey) => {
    await saveSettings(settings());
    const incoming = { ...backup(), settings: settings(provider, ''), includesApiKey };
    await importWorkspaceBackup(incoming, 'replace');
    expect((await loadSettings())?.ai).toEqual({ provider, apiKey: expectedKey });
    expect(incoming.settings.ai.apiKey).toBe('');
  });

  it('imports an included key and can skip settings', async () => {
    await saveSettings(settings());
    const incoming = { ...backup(), settings: settings('gemini', 'incoming-key'), includesApiKey: true };
    await importWorkspaceBackup(incoming, 'merge', { importSettings: false });
    expect(await loadSettings()).toEqual(settings());
    await importWorkspaceBackup(incoming, 'replace');
    expect(await loadSettings()).toEqual(incoming.settings);
  });

  it.each([
    ['missing app', { app: undefined }], ['wrong app', { app: 'other' }],
    ['schema', { schemaVersion: 2 }], ['date', { exportedAt: '2026-02-30' }],
    ['missing letters', { coverLetters: undefined }], ['duplicate resumes', { resumes: [resume(), resume()] }],
    ['duplicate letters', { coverLetters: [letter(), letter()] }], ['orphan', { coverLetters: [letter('missing')] }],
    ['malformed data', { resumes: [{ ...resume(), data: {} }] }],
    ['settings types', { settings: { ...settings(), autoSave: 'yes' } }],
    ['provider', { settings: { ...settings(), ai: { provider: 'other', apiKey: '' } } }],
    ['flag', { includesApiKey: 'yes' }], ['false redaction', { includesApiKey: false, settings: settings() }],
    ['oversized array', { resumes: Array.from({ length: 1001 }, (_, i) => resume(`${i}`)) }],
  ])('rejects %s before any destructive write', async (_, patch) => {
    await restoreWorkspaceRecords([resume()], [letter()], settings());
    const before = await loadWorkspaceRecords();
    const incoming = { ...backup(), ...patch };
    expect(isWorkspaceBackup(incoming)).toBe(false);
    await expect(importWorkspaceBackup(incoming, 'replace')).rejects.toThrow();
    expect(await loadWorkspaceRecords()).toEqual(before);
  });

  it('rejects empty replacement, even when called directly', async () => {
    await saveResume(resume());
    await expect(importWorkspaceBackup({ ...backup(), resumes: [], coverLetters: [] }, 'replace')).rejects.toThrow('empty');
    await expect(restoreWorkspaceRecords([], [], undefined, true)).rejects.toThrow('empty');
    expect(await loadResume('r')).toEqual(resume());
  });

  it('bounds file size before reading and rejects malformed JSON', async () => {
    const text = vi.fn();
    await expect(readBackupFile({ size: MAX_BACKUP_FILE_BYTES + 1, text } as unknown as File)).rejects.toThrow('25 MiB');
    expect(text).not.toHaveBeenCalled();
    await expect(readBackupFile({ size: 1, text: async () => '{' } as File)).rejects.toThrow('Invalid JSON');
    const valid = JSON.stringify(backup());
    await expect(readBackupFile({ size: valid.length, text: async () => valid } as File)).resolves.toEqual(backup());
  });
});

describe('localStorage migration', () => {
  function storage(raw: string) {
    const values = new Map([['resumeData', raw]]);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
    });
    return values;
  }

  it('keeps malformed data and data conflicting with an existing ID', async () => {
    const invalid = storage('{"personalInfo":{}}');
    expect(await migrateFromLocalStorage('r')).toBe(false);
    expect(invalid.has('resumeData')).toBe(true);
    const valid = storage(JSON.stringify(blankResumeData));
    await saveResume(resume());
    expect(await migrateFromLocalStorage('r')).toBe(false);
    expect(valid.has('resumeData')).toBe(true);
    expect(await loadResume('r')).toEqual(resume());
  });

  it('removes legacy data only after a successful committed migration', async () => {
    const values = storage(JSON.stringify(blankResumeData));
    expect(await migrateFromLocalStorage('r')).toBe(true);
    expect(values.has('resumeData')).toBe(false);
    expect((await loadResume('r'))?.data).toEqual(blankResumeData);
  });

  it('keeps legacy data after a failed write', async () => {
    const values = storage(JSON.stringify(blankResumeData));
    vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(() => { throw new Error('quota'); });
    expect(await migrateFromLocalStorage('r')).toBe(false);
    expect(values.has('resumeData')).toBe(true);
    expect(await loadResume('r')).toBeUndefined();
  });
});
