import { v4 as uuidv4 } from 'uuid';
import { ResumeData, ResumeRecord, ResumeVersion } from '../types/resume';
import { loadResume, saveResume } from '../db/resumeDB';

export const MAX_VERSIONS = 20;

function cloneData(data: ResumeData): ResumeData {
  return structuredClone(data);
}

export async function createSnapshot(
  resumeId: string,
  data: ResumeData,
  label?: string
): Promise<ResumeVersion[]> {
  const record = await loadResume(resumeId);
  if (!record) throw new Error('Resume not found');

  const version: ResumeVersion = {
    id: uuidv4(),
    label: label?.trim() || `Snapshot ${new Date().toLocaleString()}`,
    createdAt: new Date().toISOString(),
    data: cloneData(data),
  };

  let versions = [version, ...(record.versions || [])];
  if (versions.length > MAX_VERSIONS) {
    versions = versions.slice(0, MAX_VERSIONS);
  }

  const updated: ResumeRecord = {
    ...record,
    data,
    versions,
    updatedAt: new Date().toISOString(),
  };
  await saveResume(updated);
  return versions;
}

export async function listVersions(resumeId: string): Promise<ResumeVersion[]> {
  const record = await loadResume(resumeId);
  return record?.versions || [];
}

export async function deleteVersion(resumeId: string, versionId: string): Promise<ResumeVersion[]> {
  const record = await loadResume(resumeId);
  if (!record) return [];
  const versions = (record.versions || []).filter(v => v.id !== versionId);
  await saveResume({ ...record, versions, updatedAt: new Date().toISOString() });
  return versions;
}

export async function renameVersion(
  resumeId: string,
  versionId: string,
  label: string
): Promise<ResumeVersion[]> {
  const record = await loadResume(resumeId);
  if (!record) return [];
  const versions = (record.versions || []).map(v =>
    v.id === versionId ? { ...v, label: label.trim() || v.label } : v
  );
  await saveResume({ ...record, versions });
  return versions;
}

/** Restore returns the version data; caller should load into Redux and persist. */
export async function getVersionData(
  resumeId: string,
  versionId: string
): Promise<ResumeData | null> {
  const record = await loadResume(resumeId);
  const v = record?.versions?.find(x => x.id === versionId);
  return v ? cloneData(v.data) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Diffing
// ─────────────────────────────────────────────────────────────────────────────

export interface DiffEntry {
  path: string;
  before: unknown;
  after: unknown;
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

/** Generic recursive field-by-field diff between two ResumeData snapshots. */
export function diffResumeData(a: ResumeData, b: ResumeData): DiffEntry[] {
  const diffs: DiffEntry[] = [];

  const walk = (path: string, x: unknown, y: unknown) => {
    if (x === y) return;

    if (isPlainObject(x) && isPlainObject(y)) {
      const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
      for (const key of keys) {
        walk(path ? `${path}.${key}` : key, x[key], y[key]);
      }
      return;
    }

    if (Array.isArray(x) && Array.isArray(y)) {
      const len = Math.max(x.length, y.length);
      for (let i = 0; i < len; i++) {
        walk(`${path}[${i}]`, x[i], y[i]);
      }
      return;
    }

    if (JSON.stringify(x) !== JSON.stringify(y)) {
      diffs.push({ path, before: x, after: y });
    }
  };

  walk('', a, b);
  return diffs;
}
