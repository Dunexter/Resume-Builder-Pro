import type { AppSettings, CoverLetter, ResumeData, ResumeRecord, ResumeVersion } from '../types/resume';

export const MAX_WORKSPACE_RECORDS = 1000;
export const MAX_BACKUP_FILE_BYTES = 25 * 1024 * 1024;
const MAX_TEXT_LENGTH = 200_000;
const SECTION_TYPES = ['education', 'experience', 'skills', 'projects', 'awards', 'certifications'] as const;

function fail(path: string, reason: string): never {
  throw new Error(`Invalid ${path}: ${reason}.`);
}

function object(value: unknown, path: string, fields: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(path, 'expected an object');
  for (const key of Object.keys(value)) {
    if (!fields.includes(key)) fail(`${path}.${key}`, 'unknown field');
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, path: string, max = MAX_TEXT_LENGTH): asserts value is string {
  if (typeof value !== 'string' || value.length > max) fail(path, `expected a string of at most ${max} characters`);
}

function id(value: unknown, path: string, max = 512): asserts value is string {
  text(value, path, max);
  if (!value.trim() || [...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) {
    fail(path, 'expected a nonempty ID without control characters');
  }
}

function strings(value: Record<string, unknown>, path: string, required: string[], optional: string[] = []) {
  for (const key of required) text(value[key], `${path}.${key}`);
  for (const key of optional) if (value[key] !== undefined) text(value[key], `${path}.${key}`);
}

function boolean(value: unknown, path: string) {
  if (typeof value !== 'boolean') fail(path, 'expected a boolean');
}

function number(value: unknown, path: string, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    fail(path, `expected a finite number between ${min} and ${max}`);
  }
}

function choice(value: unknown, path: string, choices: readonly string[]) {
  if (typeof value !== 'string' || !choices.includes(value)) fail(path, `expected one of ${choices.join(', ')}`);
}

export function validateTimestamp(value: unknown, path = 'timestamp'): asserts value is string {
  text(value, path, 40);
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value) ||
      !Number.isFinite(Date.parse(value))) fail(path, 'expected an ISO date');
  const day = value.slice(0, 10);
  if (new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) fail(path, 'invalid calendar date');
}

function array(value: unknown, path: string, max = MAX_WORKSPACE_RECORDS): unknown[] {
  if (!Array.isArray(value) || value.length > max) fail(path, `expected an array of at most ${max} items`);
  return value;
}

function entries(value: unknown, path: string, check: (entry: unknown, path: string) => void, max = MAX_WORKSPACE_RECORDS) {
  const seen = new Set<string>();
  for (const [i, entry] of array(value, path, max).entries()) {
    const location = `${path}[${i}]`;
    check(entry, location);
    const key = (entry as { id: string }).id;
    if (seen.has(key)) fail(location, 'duplicate ID');
    seen.add(key);
  }
}

function fields(value: unknown, path: string, required: string[], optional: string[] = [], extra: string[] = []) {
  const entry = object(value, path, ['id', ...required, ...optional, ...extra]);
  id(entry.id, `${path}.id`);
  strings(entry, path, required, optional);
  return entry;
}

export function validateResumeData(value: unknown): asserts value is ResumeData {
  const data = object(value, 'resume data', ['personalInfo', 'sections', 'sectionOrder', 'styling']);
  const personal = object(data.personalInfo, 'personalInfo', ['name', 'email', 'phone', 'location', 'github', 'linkedin', 'website', 'summary']);
  strings(personal, 'personalInfo', ['name', 'email', 'phone', 'location'], ['github', 'linkedin', 'website', 'summary']);
  const sections = object(data.sections, 'sections', [...SECTION_TYPES, 'custom']);
  entries(sections.education, 'education', (entry, path) => {
    fields(entry, path, ['institution', 'degree', 'field', 'startDate', 'endDate'], ['gpa', 'coursework', 'honors']);
  });
  entries(sections.experience, 'experience', (entry, path) => {
    const exp = fields(entry, path, ['company', 'position', 'location', 'startDate', 'endDate'], ['technologies'], ['current', 'achievements']);
    boolean(exp.current, `${path}.current`);
    for (const achievement of array(exp.achievements, `${path}.achievements`)) text(achievement, `${path}.achievements`);
  });
  entries(sections.skills, 'skills', (entry, path) => { fields(entry, path, ['category', 'skills']); });
  entries(sections.projects, 'projects', (entry, path) => { fields(entry, path, ['title', 'year', 'description'], ['technologies', 'url']); });
  entries(sections.awards, 'awards', (entry, path) => { fields(entry, path, ['title', 'description'], ['issuer', 'date']); });
  entries(sections.certifications, 'certifications', (entry, path) => { fields(entry, path, ['name', 'issuer', 'date'], ['expiryDate', 'credentialId']); });
  const customIds = new Set<string>();
  entries(sections.custom, 'custom', (entry, path) => {
    const section = fields(entry, path, ['name'], [], ['entries']);
    if ((SECTION_TYPES as readonly unknown[]).includes(section.id)) fail(path, 'custom ID conflicts with a built-in section');
    customIds.add(section.id as string);
    entries(section.entries, `${path}.entries`, (item, location) => { fields(item, location, ['title', 'content']); });
  });
  entries(data.sectionOrder, 'sectionOrder', (entry, path) => {
    const section = fields(entry, path, ['name'], [], ['type', 'visible']);
    choice(section.type, `${path}.type`, [...SECTION_TYPES, 'custom']);
    boolean(section.visible, `${path}.visible`);
    if (section.type === 'custom' ? !customIds.has(section.id as string) : section.id !== section.type) {
      fail(path, 'section reference does not exist');
    }
  });
  const styling = object(data.styling, 'styling', ['template', 'fontSize', 'fontFamily', 'spacing', 'colors']);
  choice(styling.template, 'styling.template', ['professional', 'modern', 'classic', 'compact', 'executive']);
  text(styling.fontFamily, 'styling.fontFamily', 200);
  if (!styling.fontFamily.trim()) fail('styling.fontFamily', 'expected a font family');
  number(styling.fontSize, 'styling.fontSize', 6, 72);
  number(styling.spacing, 'styling.spacing', 0.5, 5);
  const colors = object(styling.colors, 'styling.colors', ['primary', 'secondary', 'accent']);
  for (const key of ['primary', 'secondary', 'accent']) {
    if (typeof colors[key] !== 'string' || !/^#[\da-f]{6}$/i.test(colors[key])) fail(`styling.colors.${key}`, 'expected a six-digit hex color');
  }
}

export function validateResumeVersion(value: unknown): asserts value is ResumeVersion {
  const version = fields(value, 'version', ['label'], [], ['createdAt', 'data']);
  validateTimestamp(version.createdAt, 'version.createdAt');
  validateResumeData(version.data);
}

export function validateResumeRecord(value: unknown): asserts value is ResumeRecord {
  const record = fields(value, 'resume', ['name'], ['targetJob', 'jobDescription'], ['createdAt', 'updatedAt', 'data', 'versions', 'jdMatchScore']);
  validateTimestamp(record.createdAt, 'resume.createdAt');
  validateTimestamp(record.updatedAt, 'resume.updatedAt');
  if (record.jdMatchScore !== undefined) number(record.jdMatchScore, 'resume.jdMatchScore', 0, 100);
  validateResumeData(record.data);
  entries(record.versions, 'versions', validateResumeVersion, 100);
}

export function validateAppSettings(value: unknown): asserts value is AppSettings {
  const settings = object(value, 'settings', ['ai', 'darkMode', 'autoSave']);
  boolean(settings.darkMode, 'settings.darkMode');
  boolean(settings.autoSave, 'settings.autoSave');
  const ai = object(settings.ai, 'settings.ai', ['provider', 'apiKey', 'model']);
  choice(ai.provider, 'settings.ai.provider', ['openai', 'gemini', 'none']);
  strings(ai, 'settings.ai', ['apiKey'], ['model']);
}

export function validateCoverLetter(value: unknown): asserts value is CoverLetter {
  const letter = object(value, 'cover letter', ['id', 'resumeId', 'companyName', 'jobTitle', 'content', 'createdAt', 'updatedAt', 'style']);
  // Draft IDs contain the complete job description, not just a UUID.
  id(letter.id, 'cover letter.id', MAX_TEXT_LENGTH + 1024);
  id(letter.resumeId, 'cover letter.resumeId');
  strings(letter, 'cover letter', ['companyName', 'jobTitle', 'content']);
  if (letter.style !== undefined) choice(letter.style, 'cover letter.style', ['standard', 'concise', 'story']);
  validateTimestamp(letter.createdAt, 'cover letter.createdAt');
  validateTimestamp(letter.updatedAt, 'cover letter.updatedAt');
  let encoded: unknown;
  try { encoded = JSON.parse(letter.id); } catch { /* Ordinary UUID IDs are also persisted. */ }
  if (Array.isArray(encoded) && encoded[0] === 'cover-letter' &&
      (encoded.length !== 3 || encoded[1] !== letter.resumeId || typeof encoded[2] !== 'string')) {
    fail('cover letter.id', 'draft ID must reference its resume');
  }
}

export function validateWorkspaceRecords(records: unknown, letters: unknown): asserts records is ResumeRecord[] {
  entries(records, 'resumes', validateResumeRecord);
  entries(letters, 'coverLetters', validateCoverLetter);
  const ids = new Set((records as ResumeRecord[]).map(record => record.id));
  for (const letter of letters as CoverLetter[]) {
    if (!ids.has(letter.resumeId)) fail('cover letter.resumeId', 'resume is not in the backup');
  }
}
