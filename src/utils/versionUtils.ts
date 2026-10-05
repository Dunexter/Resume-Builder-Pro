import { v4 as uuidv4 } from 'uuid';
import { ResumeData, ResumeRecord, ResumeVersion } from '../types/resume';
import { loadResume, updateResumeRecord } from '../db/resumeDB';

export const MAX_VERSIONS = 20;

function cloneData(data: ResumeData): ResumeData {
  return structuredClone(data);
}

export async function createSnapshot(
  resumeId: string,
  data: ResumeData,
  label?: string
): Promise<ResumeVersion[]> {
  const version: ResumeVersion = {
    id: uuidv4(),
    label: label?.trim() || `Snapshot ${new Date().toLocaleString()}`,
    createdAt: new Date().toISOString(),
    data: cloneData(data),
  };

  const updated = await updateResumeRecord(resumeId, record => ({
    ...record,
    versions: [version, ...(record.versions || [])].slice(0, MAX_VERSIONS),
    updatedAt: new Date().toISOString(),
  }));
  return updated.versions;
}

export async function listVersions(resumeId: string): Promise<ResumeVersion[]> {
  const record = await loadResume(resumeId);
  return record?.versions || [];
}

export async function deleteVersion(resumeId: string, versionId: string): Promise<ResumeVersion[]> {
  const updated = await updateResumeRecord(resumeId, record => ({
    ...record,
    versions: (record.versions || []).filter(v => v.id !== versionId),
    updatedAt: new Date().toISOString(),
  }));
  return updated.versions;
}

export async function renameVersion(
  resumeId: string,
  versionId: string,
  label: string
): Promise<ResumeVersion[]> {
  const updated = await updateResumeRecord(resumeId, record => ({
    ...record,
    versions: (record.versions || []).map(v =>
      v.id === versionId ? { ...v, label: label.trim() || v.label } : v
    ),
    updatedAt: new Date().toISOString(),
  }));
  return updated.versions;
}

/** Read a detached copy without changing the active resume or history. */
export async function getVersionData(
  resumeId: string,
  versionId: string
): Promise<ResumeData | null> {
  const record = await loadResume(resumeId);
  const v = record?.versions?.find(x => x.id === versionId);
  return v ? cloneData(v.data) : null;
}

/** Capture the target before trimming history, all under the same write lock. */
export async function restoreVersion(
  resumeId: string,
  versionId: string,
  currentData: ResumeData,
  checkEditor?: () => void,
): Promise<ResumeRecord> {
  const safetySnapshot: ResumeVersion = {
    id: uuidv4(), label: 'Before restore', createdAt: new Date().toISOString(),
    data: cloneData(currentData),
  };
  return updateResumeRecord(resumeId, record => {
    checkEditor?.();
    const target = record.versions?.find(version => version.id === versionId);
    if (!target) throw new Error('Version not found');
    return {
      ...record,
      data: cloneData(target.data),
      jdMatchScore: undefined,
      versions: [safetySnapshot, ...(record.versions || [])].slice(0, MAX_VERSIONS),
      updatedAt: new Date().toISOString(),
    };
  });
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
