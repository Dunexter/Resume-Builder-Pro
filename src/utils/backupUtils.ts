import { AppSettings, CoverLetter, ResumeRecord } from '../types/resume';
import { loadWorkspaceRecords, restoreWorkspaceRecords } from '../db/resumeDB';
import { MAX_BACKUP_FILE_BYTES, validateAppSettings, validateTimestamp, validateWorkspaceRecords } from './resumeSchema';

export { MAX_BACKUP_FILE_BYTES } from './resumeSchema';

export const BACKUP_SCHEMA_VERSION = 1;

export interface WorkspaceBackup {
  schemaVersion: number;
  exportedAt: string;
  app: string;
  resumes: ResumeRecord[];
  settings?: AppSettings;
  coverLetters: CoverLetter[];
  /** True when AI API key was included in this file */
  includesApiKey?: boolean;
}

function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function redactSettings(settings: AppSettings | undefined, includeApiKey: boolean): AppSettings | undefined {
  if (!settings) return undefined;
  if (includeApiKey) return settings;
  return {
    ...settings,
    ai: {
      ...settings.ai,
      apiKey: '',
    },
  };
}

/** Build and download a full workspace backup JSON file. */
export async function exportWorkspaceBackup(options?: { includeApiKey?: boolean }): Promise<void> {
  const includeApiKey = options?.includeApiKey === true;
  const { records: resumes, settings, letters: coverLetters } = await loadWorkspaceRecords();

  const backup: WorkspaceBackup = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'resume-builder-pro',
    resumes,
    settings: redactSettings(settings, includeApiKey),
    coverLetters,
    includesApiKey: includeApiKey && !!settings?.ai?.apiKey,
  };

  validateWorkspaceBackup(backup);
  if (new Blob([JSON.stringify(backup, null, 2)]).size > MAX_BACKUP_FILE_BYTES) {
    throw new Error('Workspace exceeds the backup file size limit.');
  }
  const stamp = new Date().toISOString().slice(0, 10);
  downloadJson(`resume-builder-pro-backup-${stamp}.json`, backup);
}

export function validateWorkspaceBackup(value: unknown): asserts value is WorkspaceBackup {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid workspace backup.');
  const v = value as Record<string, unknown>;
  const fields = ['schemaVersion', 'exportedAt', 'app', 'resumes', 'settings', 'coverLetters', 'includesApiKey'];
  if (Object.keys(v).some(key => !fields.includes(key))) throw new Error('Unknown workspace backup field.');
  if (v.app !== 'resume-builder-pro') throw new Error('Not a ResumeBuilder Pro backup.');
  if (v.schemaVersion !== BACKUP_SCHEMA_VERSION) throw new Error('Unsupported backup schema version.');
  validateTimestamp(v.exportedAt, 'backup.exportedAt');
  validateWorkspaceRecords(v.resumes, v.coverLetters);
  if (v.settings !== undefined) validateAppSettings(v.settings);
  if (v.includesApiKey !== undefined && typeof v.includesApiKey !== 'boolean') {
    throw new Error('Invalid backup includesApiKey flag.');
  }
  if (v.includesApiKey === false && (v.settings as AppSettings | undefined)?.ai.apiKey) {
    throw new Error('Backup declares redacted settings but contains an API key.');
  }
}

export function isWorkspaceBackup(value: unknown): value is WorkspaceBackup {
  try { validateWorkspaceBackup(value); return true; } catch { return false; }
}

export type ImportMode = 'merge' | 'replace';

export interface ImportResult {
  resumesImported: number;
  coverLettersImported: number;
  settingsImported: boolean;
}

/**
 * Import a workspace backup.
 * - merge: preserve local records and remap colliding incoming IDs
 * - replace: atomically replace resumes and cover letters
 */
export async function importWorkspaceBackup(
  backup: unknown,
  mode: ImportMode,
  options?: { importSettings?: boolean }
): Promise<ImportResult> {
  validateWorkspaceBackup(backup);
  if (new Blob([JSON.stringify(backup)]).size > MAX_BACKUP_FILE_BYTES) throw new Error('Backup exceeds the file size limit.');
  if (mode !== 'merge' && mode !== 'replace') throw new Error('Invalid backup import mode.');
  const settingsImported = options?.importSettings !== false && backup.settings !== undefined;
  await restoreWorkspaceRecords(backup.resumes, backup.coverLetters,
    settingsImported ? backup.settings : undefined, mode === 'replace',
    { preserveRedactedApiKey: backup.includesApiKey !== true });

  return {
    resumesImported: backup.resumes.length,
    coverLettersImported: backup.coverLetters.length,
    settingsImported,
  };
}

export async function readBackupFile(file: File): Promise<WorkspaceBackup> {
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_BACKUP_FILE_BYTES) {
    throw new Error('Backup file must be nonempty and no larger than 25 MiB.');
  }
  const text = await file.text();
  if (new Blob([text]).size > MAX_BACKUP_FILE_BYTES) throw new Error('Backup exceeds the file size limit.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON file.');
  }
  validateWorkspaceBackup(parsed);
  return parsed;
}
