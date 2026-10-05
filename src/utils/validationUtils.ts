import { ResumeData } from '../types/resume';

export interface ValidationIssue {
  level: 'error' | 'warn';
  field: string;
  message: string;
}

const EMAIL_RE = /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/;
const hasText = (value?: string) => /[\p{L}\p{N}]/u.test(value || '');

export function getResumeCompletion(data: ResumeData) {
  const { personalInfo: info, sections } = data;
  const visible = (type: string) => !data.sectionOrder.some(section => section.id === type && !section.visible);
  const experience = visible('experience') && sections.experience.some(entry =>
    hasText(entry.company) && hasText(entry.position) && entry.achievements.some(hasText));
  const projects = visible('projects') && sections.projects.some(entry => hasText(entry.title) && hasText(entry.description));
  const skills = visible('skills') && sections.skills.some(entry => hasText(entry.skills));
  const education = visible('education') && sections.education.some(entry =>
    hasText(entry.institution) && (hasText(entry.degree) || hasText(entry.field)));
  return {
    contact: hasText(info.name) && EMAIL_RE.test(info.email.trim()),
    experience,
    projects,
    skills,
    substantive: experience || projects || skills || education || hasText(info.summary)
      || (visible('awards') && sections.awards.some(entry => hasText(entry.title)))
      || (visible('certifications') && sections.certifications.some(entry => hasText(entry.name)))
      || sections.custom.some(section => visible(section.id) && section.entries.some(entry => hasText(entry.content))),
  };
}

function validWebUrl(value: string): boolean {
  if (/[\s\\]/.test(value) || (/^[a-z][a-z\d+.-]*:/i.test(value) && !/^https?:\/\//i.test(value))) return false;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      && url.hostname.includes('.') && url.hostname.split('.').every(label => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label));
  } catch {
    return false;
  }
}

// Compare only unambiguous ISO dates, using ranges for year/month precision.
function dateRange(value: string): [number, number] | null {
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2] || 1);
  const day = Number(match[3] || 1);
  const start = Date.UTC(year, month - 1, day);
  const date = new Date(start);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  const end = match[3] ? start : match[2] ? Date.UTC(year, month, 0) : Date.UTC(year, 11, 31);
  return [start, end];
}

export function validateResumeForExport(data: ResumeData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { personalInfo, sections } = data;

  if (!hasText(personalInfo.name)) {
    issues.push({ level: 'error', field: 'name', message: 'Full name is required before export.' });
  }

  if (!personalInfo.email?.trim()) {
    issues.push({ level: 'error', field: 'email', message: 'Email is required before export.' });
  } else if (!EMAIL_RE.test(personalInfo.email.trim())) {
    issues.push({ level: 'error', field: 'email', message: 'Email format looks invalid. Use an address such as name@example.com.' });
  }

  if (!personalInfo.phone?.trim()) {
    issues.push({ level: 'warn', field: 'phone', message: 'Phone number is missing (many recruiters expect it).' });
  }

  if (!personalInfo.location?.trim()) {
    issues.push({ level: 'warn', field: 'location', message: 'Location is missing (ATS often filter by city/state).' });
  }

  for (const [field, label] of [['github', 'GitHub'], ['linkedin', 'LinkedIn'], ['website', 'Website / portfolio']] as const) {
    const value = personalInfo[field]?.trim();
    if (value && !validWebUrl(value)) {
      issues.push({ level: 'warn', field, message: `${label} URL looks invalid. Use a web address such as https://example.com/profile.` });
    }
  }
  for (const project of sections.projects) {
    if (project.url?.trim() && !validWebUrl(project.url.trim())) {
      issues.push({ level: 'warn', field: 'projects-url', message: `Project URL looks invalid: ${project.title.trim() || 'untitled project'}. Use an HTTP or HTTPS web address.` });
    }
  }

  const completion = getResumeCompletion(data);
  if (!completion.substantive) {
    issues.push({ level: 'error', field: 'content', message: 'Resume body is empty or contains only unfinished entries. Add education, skills, a project, experience, or other substantive content before export. Work experience is not required.' });
  } else if (!completion.experience && !completion.projects) {
    issues.push({ level: 'warn', field: 'experience', message: 'Consider adding a described project, coursework contribution, volunteering, or work experience to show your skills. Paid work experience is not required.' });
  }
  if (!completion.skills) {
    issues.push({ level: 'warn', field: 'skills', message: 'No skills listed yet. Add actual skills, not just a category heading.' });
  }

  const datedEntries = [
    ...sections.experience.filter(entry => !entry.current).map(entry => ({ field: 'experience-dates', label: entry.position || entry.company || 'role', start: entry.startDate, end: entry.endDate })),
    ...sections.education.map(entry => ({ field: 'education-dates', label: entry.institution || 'education', start: entry.startDate, end: entry.endDate })),
    ...sections.certifications.map(entry => ({ field: 'certifications-dates', label: entry.name || 'certification', start: entry.date, end: entry.expiryDate || '' })),
  ];
  for (const entry of datedEntries) {
    const start = dateRange(entry.start);
    const end = dateRange(entry.end);
    if (start && end && end[1] < start[0]) {
      issues.push({ level: 'warn', field: entry.field, message: `End / expiry date is before start / issue date: ${entry.label}. Check the date order.` });
    }
  }

  return issues;
}

export function formatValidationMessage(issues: ValidationIssue[]): string {
  const errors = issues.filter(i => i.level === 'error');
  const warns = issues.filter(i => i.level === 'warn');
  const lines: string[] = [];
  if (errors.length) {
    lines.push('Please fix before export:');
    errors.forEach(e => lines.push(`• ${e.message}`));
  }
  if (warns.length) {
    lines.push(errors.length ? '\nAlso note:' : 'Warnings:');
    warns.forEach(w => lines.push(`• ${w.message}`));
  }
  return lines.join('\n');
}
