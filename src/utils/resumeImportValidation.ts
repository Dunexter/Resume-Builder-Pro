import { ResumeData } from '../types/resume';
import { MAX_IMPORT_TEXT_LENGTH } from './resumeFileParser';

const fields: Record<string, string[]> = {
  education: ['institution', 'degree', 'field', 'startDate', 'endDate', 'gpa', 'coursework', 'honors'],
  experience: ['company', 'position', 'location', 'startDate', 'endDate', 'technologies'],
  skills: ['category', 'skills'],
  projects: ['title', 'year', 'description', 'technologies', 'url'],
  certifications: ['name', 'issuer', 'date', 'expiryDate', 'credentialId'],
  awards: ['title', 'issuer', 'date', 'description'],
};

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a resume object.');
  return value as Record<string, unknown>;
}

function strings(value: unknown, allowed: string[]): Record<string, string> {
  const input = object(value);
  const output: Record<string, string> = {};
  for (const [key, field] of Object.entries(input)) {
    if (!allowed.includes(key)) throw new Error(`Unexpected field: ${key}`);
    if (typeof field !== 'string' || field.length > MAX_IMPORT_TEXT_LENGTH) throw new Error(`Invalid text field: ${key}`);
    if (['startDate', 'endDate', 'date', 'expiryDate'].includes(key) && field && !/^\d{4}-(0[1-9]|1[0-2])$/.test(field)) {
      throw new Error(`Invalid ${key}: use YYYY-MM or an empty string.`);
    }
    if (['url', 'website', 'github', 'linkedin'].includes(key) && /^\s*(?:javascript|data|vbscript|file):/i.test(field)) throw new Error(`Unsafe link in ${key}`);
    output[key] = field;
  }
  return output;
}

/** Import-only schema: never accept provider-supplied styling or unchecked nested values. */
export function validateImportCandidate(value: unknown): Partial<ResumeData> {
  const root = object(value);
  if (JSON.stringify(root).length > MAX_IMPORT_TEXT_LENGTH * 3) throw new Error('Structured candidate is too large.');
  if (Object.keys(root).some(k => !['personalInfo', 'sections'].includes(k))) throw new Error('Candidate must contain only personalInfo and sections.');
  if (!root.personalInfo && !root.sections) throw new Error('No resume fields found in candidate.');
  const result: Record<string, unknown> = {};
  if (root.personalInfo !== undefined) result.personalInfo = strings(root.personalInfo, ['name', 'email', 'phone', 'location', 'github', 'linkedin', 'website', 'summary']);
  if (root.sections !== undefined) {
    const sections = object(root.sections);
    const output: Record<string, unknown> = {};
    for (const [key, entries] of Object.entries(sections)) {
      if (!Object.prototype.hasOwnProperty.call(fields, key) && key !== 'custom') throw new Error(`Unexpected section: ${key}`);
      if (!Array.isArray(entries) || entries.length > 200) throw new Error(`Invalid or oversized section: ${key}`);
      output[key] = entries.map(entry => {
        const item = object(entry);
        if (key === 'custom') {
          const { entries: children, ...rest } = item;
          const base = strings(rest, ['id', 'name']);
          if (!Array.isArray(children) || children.length > 200) throw new Error('Invalid custom entries.');
          return { ...base, entries: children.map(child => strings(child, ['id', 'title', 'content'])) };
        }
        const { current, achievements, ...rest } = item;
        const base = strings(rest, ['id', ...fields[key]]);
        if (key === 'experience') {
          if (current !== undefined && typeof current !== 'boolean') throw new Error('Experience current must be boolean.');
          if (achievements !== undefined && (!Array.isArray(achievements) || achievements.length > 200 || achievements.some(a => typeof a !== 'string' || a.length > MAX_IMPORT_TEXT_LENGTH))) throw new Error('Achievements must be a list of strings.');
          return { ...base, current: current ?? false, achievements: achievements ?? [] };
        }
        if (current !== undefined || achievements !== undefined) throw new Error(`Unexpected experience fields in ${key}`);
        return base;
      });
    }
    result.sections = output;
  }
  // All accepted fields have been reconstructed and checked above; defaults are applied by the builder.
  return result as Partial<ResumeData>;
}
