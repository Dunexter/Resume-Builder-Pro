import { openDB, IDBPDatabase } from 'idb';
import { ResumeRecord, AppSettings, CoverLetter } from '../types/resume';
import { validateAppSettings, validateCoverLetter, validateResumeData, validateResumeRecord, validateWorkspaceRecords } from '../utils/resumeSchema';

const DB_NAME = 'resume-builder-pro';
const DB_VERSION = 1;

let db: Promise<IDBPDatabase> | null = null;

async function getDB() {
  if (db) return db;
  db = openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('resumes')) {
        const resumeStore = database.createObjectStore('resumes', { keyPath: 'id' });
        resumeStore.createIndex('updatedAt', 'updatedAt');
      }
      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings', { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains('coverLetters')) {
        const clStore = database.createObjectStore('coverLetters', { keyPath: 'id' });
        clStore.createIndex('resumeId', 'resumeId');
      }
    },
  }).catch(error => { db = null; throw error; });
  return db;
}

// ── Resumes ──────────────────────────────────────────────────────────────────

export async function saveResume(record: ResumeRecord): Promise<void> {
  record = structuredClone(record);
  validateResumeRecord(record);
  const database = await getDB();
  await database.put('resumes', record);
}

/** The synchronous updater runs against the latest record under the write lock. */
export async function updateResumeRecord(
  id: string,
  update: (existing: ResumeRecord) => ResumeRecord,
): Promise<ResumeRecord> {
  const database = await getDB();
  const tx = database.transaction('resumes', 'readwrite');
  try {
    const existing = await tx.store.get(id);
    if (!existing) throw new Error(`Resume not found: ${id}`);
    validateResumeRecord(existing);
    const record = structuredClone(update(existing));
    validateResumeRecord(record);
    if (record.id !== id) throw new Error('An update cannot change the resume ID.');
    await tx.store.put(record);
    await tx.done;
    return record;
  } catch (error) {
    try { tx.abort(); } catch { /* The transaction may already be aborted. */ }
    await tx.done.catch(() => {});
    throw error;
  }
}

export async function loadResume(id: string): Promise<ResumeRecord | undefined> {
  const database = await getDB();
  return database.get('resumes', id);
}

export async function listResumes(): Promise<ResumeRecord[]> {
  const database = await getDB();
  return database.getAll('resumes');
}

export async function deleteResume(id: string): Promise<void> {
  const database = await getDB();
  const tx = database.transaction(['resumes', 'coverLetters'], 'readwrite');
  try {
    const letterIds = await tx.objectStore('coverLetters').index('resumeId').getAllKeys(id);
    await tx.objectStore('resumes').delete(id);
    for (const letterId of letterIds) await tx.objectStore('coverLetters').delete(letterId);
    await tx.done;
  } catch (error) {
    try { tx.abort(); } catch { /* Already aborted. */ }
    await tx.done.catch(() => {});
    throw error;
  }
}

// ── Settings ─────────────────────────────────────────────────────────────────

export async function saveSettings(settings: AppSettings): Promise<void> {
  settings = structuredClone(settings);
  validateAppSettings(settings);
  const database = await getDB();
  await database.put('settings', { key: 'appSettings', value: settings });
}

export async function loadSettings(): Promise<AppSettings | undefined> {
  const database = await getDB();
  const record = await database.get('settings', 'appSettings');
  return record?.value;
}

// ── Cover Letters ─────────────────────────────────────────────────────────────

export async function saveCoverLetter(cl: CoverLetter): Promise<void> {
  cl = structuredClone(cl);
  validateCoverLetter(cl);
  const database = await getDB();
  const tx = database.transaction(['resumes', 'coverLetters'], 'readwrite');
  try {
    if (!await tx.objectStore('resumes').getKey(cl.resumeId)) throw new Error('Cover letter resume not found.');
    await tx.objectStore('coverLetters').put(cl);
    await tx.done;
  } catch (error) {
    try { tx.abort(); } catch { /* Already aborted. */ }
    await tx.done.catch(() => {});
    throw error;
  }
}

export async function loadCoverLettersByResume(resumeId: string): Promise<CoverLetter[]> {
  const database = await getDB();
  return database.getAllFromIndex('coverLetters', 'resumeId', resumeId);
}

export async function listAllCoverLetters(): Promise<CoverLetter[]> {
  const database = await getDB();
  return database.getAll('coverLetters');
}

export async function deleteCoverLetter(id: string): Promise<void> {
  const database = await getDB();
  await database.delete('coverLetters', id);
}

/** Read a coherent snapshot even when an autosave or restore is in progress. */
export async function loadWorkspaceRecords() {
  const database = await getDB();
  const tx = database.transaction(['resumes', 'coverLetters', 'settings'], 'readonly');
  const [records, letters, settings] = await Promise.all([
    tx.objectStore('resumes').getAll() as Promise<ResumeRecord[]>,
    tx.objectStore('coverLetters').getAll() as Promise<CoverLetter[]>,
    tx.objectStore('settings').get('appSettings'),
  ]);
  await tx.done;
  return { records, letters, settings: settings?.value as AppSettings | undefined };
}

/** Restore all stores atomically. Merge never overwrites a local record. */
export async function restoreWorkspaceRecords(
  records: ResumeRecord[],
  letters: CoverLetter[],
  settings?: AppSettings,
  replace = false,
  options: { preserveRedactedApiKey?: boolean } = {},
): Promise<void> {
  ({ records, letters, settings } = structuredClone({ records, letters, settings }));
  validateWorkspaceRecords(records, letters);
  if (settings !== undefined) validateAppSettings(settings);
  if (replace && records.length === 0) throw new Error('Cannot replace a workspace with an empty backup.');
  const database = await getDB();
  const tx = database.transaction(['resumes', 'coverLetters', 'settings'], 'readwrite');
  try {
    const resumes = tx.objectStore('resumes');
    const coverLetters = tx.objectStore('coverLetters');
    const settingsStore = tx.objectStore('settings');
    if (settings && !settings.ai.apiKey && options.preserveRedactedApiKey !== false) {
      const current = (await settingsStore.get('appSettings'))?.value as AppSettings | undefined;
      if (current?.ai?.provider === settings.ai.provider && typeof current.ai.apiKey === 'string') {
        settings.ai.apiKey = current.ai.apiKey;
      }
    }
    if (replace) {
      await resumes.clear();
      await coverLetters.clear();
    } else {
      const [existingResumeIds, existingLetterIds] = await Promise.all([resumes.getAllKeys(), coverLetters.getAllKeys()]);
      const resumeIds = new Set([...existingResumeIds, ...records.map(record => record.id)]);
      const letterIds = new Set([...existingLetterIds, ...letters.map(letter => letter.id)]);
      const remapped = new Map<string, string>();
      for (const record of records) {
        if (existingResumeIds.includes(record.id)) {
          let next: string;
          do { next = crypto.randomUUID(); } while (resumeIds.has(next));
          resumeIds.add(next);
          remapped.set(record.id, next);
          record.id = next;
        }
      }
      for (const letter of letters) {
        const sourceId = letter.resumeId;
        letter.resumeId = remapped.get(sourceId) ?? sourceId;
        let encoded: unknown;
        try { encoded = JSON.parse(letter.id); } catch { /* Non-draft IDs are opaque. */ }
        let nextId = letter.id;
        if (Array.isArray(encoded) && encoded[0] === 'cover-letter' && remapped.has(sourceId)) {
          nextId = JSON.stringify(['cover-letter', letter.resumeId, encoded[2]]);
        }
        if (nextId !== letter.id ? letterIds.has(nextId) : existingLetterIds.includes(nextId)) {
          do { nextId = crypto.randomUUID(); } while (letterIds.has(nextId));
        }
        letterIds.add(nextId);
        letter.id = nextId;
      }
    }
    validateWorkspaceRecords(records, letters);
    if (settings !== undefined) validateAppSettings(settings);
    for (const record of records) await resumes.add(record);
    for (const letter of letters) await coverLetters.add(letter);
    if (settings) await settingsStore.put({ key: 'appSettings', value: settings });
    await tx.done;
  } catch (error) {
    try { tx.abort(); } catch { /* Already aborted. */ }
    await tx.done.catch(() => {});
    throw error;
  }
}

// ── Migration: import any existing localStorage data ──────────────────────────

export async function migrateFromLocalStorage(defaultResumeId: string): Promise<boolean> {
  const raw = localStorage.getItem('resumeData');
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    validateResumeData(data);
    const record: ResumeRecord = {
        id: defaultResumeId,
        name: data.personalInfo?.name || 'My Resume',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        data,
        versions: [],
    };
    validateResumeRecord(record);
    const database = await getDB();
    const tx = database.transaction('resumes', 'readwrite');
    try {
      if (await tx.store.getKey(defaultResumeId)) {
        await tx.done;
        return false;
      }
      await tx.store.add(record);
      await tx.done;
    } catch (error) {
      try { tx.abort(); } catch { /* Already aborted. */ }
      await tx.done.catch(() => {});
      throw error;
    }
    if (localStorage.getItem('resumeData') === raw) localStorage.removeItem('resumeData');
    return true;
  } catch {
    return false;
  }
}
