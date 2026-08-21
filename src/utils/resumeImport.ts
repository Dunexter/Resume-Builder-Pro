import { v4 as uuidv4 } from 'uuid';
import { blankResumeData } from '../data/sampleResume';
import {
  ResumeData,
  PersonalInfo,
  EducationEntry,
  ExperienceEntry,
  SkillEntry,
  ProjectEntry,
  CertificationEntry,
  AwardEntry,
} from '../types/resume';
import { callAIText, parseAIJson, AISettingsLike } from './aiClient';
import { humanizeAIError } from './aiErrors';

export interface ImportResumeResult {
  data: ResumeData;
  /** Whether AI was used to parse the file (more accurate) vs. a basic heuristic parser. */
  usedAI: boolean;
  /** Set when AI parsing was attempted but failed and we fell back to the heuristic parser. */
  warning?: string;
}

const BULLET_RE = /^[•\-*‣▪·◦]\s*/;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
const LINKEDIN_RE = /(https?:\/\/)?(www\.)?linkedin\.com\/[^\s,|]+/i;
const GITHUB_RE = /(https?:\/\/)?(www\.)?github\.com\/[^\s,|]+/i;
const WEBSITE_RE = /(https?:\/\/)?(www\.)?[a-z0-9-]+\.(com|dev|io|me|net|org|co)(\/[^\s,|]*)?/i;
const LOCATION_RE = /^[A-Za-z][A-Za-z.\s]+,\s*[A-Za-z]{2,}(\s\d{5})?$/;

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};
const MONTH_NAMES = 'jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december';
const DATE_TOKEN = `(?:(?:${MONTH_NAMES})\\.?\\s+)?\\d{4}`;
const DATE_RANGE_RE = new RegExp(`(${DATE_TOKEN})\\s*(?:-|–|—|to)\\s*(${DATE_TOKEN}|present|current)`, 'i');

const SECTION_ALIASES: Record<string, string[]> = {
  summary: ['summary', 'professional summary', 'objective', 'profile', 'about me', 'about'],
  experience: ['experience', 'work experience', 'professional experience', 'employment history', 'work history', 'relevant experience'],
  education: ['education', 'academic background', 'academics'],
  skills: ['skills', 'technical skills', 'core competencies', 'skills & tools', 'key skills', 'skills and tools'],
  projects: ['projects', 'personal projects', 'academic projects', 'key projects'],
  certifications: ['certifications', 'certificates', 'licenses & certifications', 'licenses', 'certifications & licenses'],
  awards: ['awards', 'honors', 'honors & awards', 'achievements', 'awards & recognition'],
};

function normalizeDateToken(raw: string): string {
  const s = raw.trim();
  if (/^present$|^current$/i.test(s)) return '';
  const monthYear = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{4})$/);
  if (monthYear) {
    const m = MONTHS[monthYear[1].slice(0, 3).toLowerCase()];
    if (m) return `${monthYear[2]}-${m}`;
  }
  const yearOnly = s.match(/^(\d{4})$/);
  if (yearOnly) return `${yearOnly[1]}-01`;
  return '';
}

function isOngoing(raw: string): boolean {
  return /^present$|^current$/i.test(raw.trim());
}

function findHeaderIndex(line: string): string | null {
  const normalized = line.toLowerCase().replace(/[:\-–—]+$/, '').trim();
  if (!normalized || normalized.length > 40) return null;
  for (const [key, aliases] of Object.entries(SECTION_ALIASES)) {
    if (aliases.includes(normalized)) return key;
  }
  return null;
}

interface SectionBlock {
  key: string;
  lines: string[];
}

function splitIntoSections(lines: string[]): { header: string[]; blocks: SectionBlock[] } {
  const boundaries: { index: number; key: string }[] = [];
  lines.forEach((line, i) => {
    const key = findHeaderIndex(line);
    if (key) boundaries.push({ index: i, key });
  });

  const header = boundaries.length ? lines.slice(0, boundaries[0].index) : lines.slice(0, Math.min(lines.length, 6));
  const blocks: SectionBlock[] = boundaries.map((b, i) => {
    const end = i + 1 < boundaries.length ? boundaries[i + 1].index : lines.length;
    return { key: b.key, lines: lines.slice(b.index + 1, end).map(l => l.trim()).filter(Boolean) };
  });
  return { header, blocks };
}

function extractContactInfo(text: string, headerLines: string[]): PersonalInfo {
  const email = text.match(EMAIL_RE)?.[0] || '';
  const phone = text.match(PHONE_RE)?.[0] || '';
  const linkedin = text.match(LINKEDIN_RE)?.[0] || '';
  const github = text.match(GITHUB_RE)?.[0] || '';
  let website = '';
  const urlCandidates = text.match(new RegExp(WEBSITE_RE, 'gi')) || [];
  for (const candidate of urlCandidates) {
    if (!/linkedin\.com|github\.com/i.test(candidate) && !email.includes(candidate)) {
      website = candidate;
      break;
    }
  }

  const nonEmptyHeaderLines = headerLines.map(l => l.trim()).filter(Boolean);
  const name = nonEmptyHeaderLines.find(
    l => l.length < 60 && !EMAIL_RE.test(l) && !PHONE_RE.test(l) && !LINKEDIN_RE.test(l) && !GITHUB_RE.test(l)
  ) || '';
  const location = nonEmptyHeaderLines.find(l => LOCATION_RE.test(l)) || '';

  return { name, email, phone, location, linkedin, github, website, summary: '' };
}

function parseSkillsSection(lines: string[]): SkillEntry[] {
  const nonEmpty = lines.filter(Boolean);
  if (!nonEmpty.length) return [];

  const categorized = nonEmpty.filter(l => /:/.test(l) && l.indexOf(':') < 40);
  if (categorized.length >= Math.max(1, Math.ceil(nonEmpty.length * 0.5))) {
    return categorized.map(l => {
      const idx = l.indexOf(':');
      return {
        id: uuidv4(),
        category: l.slice(0, idx).trim(),
        skills: l.slice(idx + 1).trim().replace(BULLET_RE, ''),
      };
    });
  }

  const joined = nonEmpty.join(', ').replace(BULLET_RE, '').replace(/[•▪·]/g, ',');
  const tokens = joined.split(/,|\|/).map(s => s.trim()).filter(Boolean);
  return tokens.length ? [{ id: uuidv4(), category: 'Skills', skills: tokens.join(', ') }] : [];
}

function parseExperienceSection(lines: string[]): ExperienceEntry[] {
  const entries: ExperienceEntry[] = [];
  let pendingHeader: string[] = [];
  let currentEntry: ExperienceEntry | null = null;

  for (const line of lines) {
    if (!line) continue;

    if (BULLET_RE.test(line)) {
      if (currentEntry) currentEntry.achievements.push(line.replace(BULLET_RE, '').trim());
      continue;
    }

    const dateMatch = line.match(DATE_RANGE_RE);
    if (dateMatch) {
      const headerText = pendingHeader.join(' ').trim();
      pendingHeader = [];
      const parts = headerText.split(/\s{2,}|,|\||–|—|\bat\b/i).map(s => s.trim()).filter(Boolean);
      const current = isOngoing(dateMatch[2]);
      currentEntry = {
        id: uuidv4(),
        company: parts[1] || '',
        position: parts[0] || headerText,
        location: '',
        startDate: normalizeDateToken(dateMatch[1]),
        endDate: current ? '' : normalizeDateToken(dateMatch[2]),
        current,
        achievements: [],
        technologies: '',
      };
      entries.push(currentEntry);
      continue;
    }

    // Not a bullet or date line — belongs to the header of the NEXT entry.
    pendingHeader.push(line);
  }

  return entries;
}

function parseEducationSection(lines: string[]): EducationEntry[] {
  const entries: EducationEntry[] = [];
  let pendingHeader: string[] = [];

  for (const line of lines) {
    if (!line || BULLET_RE.test(line)) continue;

    const rangeMatch = line.match(DATE_RANGE_RE);
    const yearMatch = !rangeMatch ? line.match(/\b((19|20)\d{2})\b/) : null;
    const isDateLine = !!rangeMatch || (!!yearMatch && pendingHeader.length > 0);

    if (isDateLine) {
      const headerText = pendingHeader.join(' ').trim();
      pendingHeader = [];
      let startDate = '';
      let endDate = '';
      if (rangeMatch) {
        startDate = normalizeDateToken(rangeMatch[1]);
        endDate = isOngoing(rangeMatch[2]) ? '' : normalizeDateToken(rangeMatch[2]);
      } else if (yearMatch) {
        endDate = normalizeDateToken(yearMatch[1]);
      }

      if (headerText) {
        const parts = headerText.split(/\s{2,}|,|\|/).map(s => s.trim()).filter(Boolean);
        entries.push({
          id: uuidv4(),
          institution: parts[0] || headerText,
          degree: parts[1] || '',
          field: parts[2] || '',
          startDate,
          endDate,
          gpa: '',
          coursework: '',
          honors: '',
        });
      }
      continue;
    }

    pendingHeader.push(line);
  }

  return entries;
}


function parseProjectsSection(lines: string[]): ProjectEntry[] {
  const projects: ProjectEntry[] = [];
  let current: { title: string; year: string; descriptionLines: string[] } | null = null;

  for (const line of lines) {
    if (!line) continue;
    if (BULLET_RE.test(line)) {
      if (current) current.descriptionLines.push(line.replace(BULLET_RE, '').trim());
      continue;
    }
    if (current) projects.push(finalizeProject(current));
    const yearMatch = line.match(/\((\d{4})\)/) || line.match(/\b((19|20)\d{2})\b/);
    current = { title: line.replace(/\(\d{4}\)/, '').trim(), year: yearMatch ? yearMatch[1] : '', descriptionLines: [] };
  }
  if (current) projects.push(finalizeProject(current));
  return projects;
}

function finalizeProject(p: { title: string; year: string; descriptionLines: string[] }): ProjectEntry {
  return {
    id: uuidv4(),
    title: p.title,
    year: p.year,
    description: p.descriptionLines.join(' '),
    technologies: '',
    url: '',
  };
}

function parseCertificationsSection(lines: string[]): CertificationEntry[] {
  return lines.filter(Boolean).map(line => {
    const clean = line.replace(BULLET_RE, '').trim();
    const yearMatch = clean.match(/\b((19|20)\d{2})\b/);
    const parts = clean.split(/,|\|/).map(s => s.trim()).filter(Boolean);
    return {
      id: uuidv4(),
      name: parts[0] || clean,
      issuer: parts[1] || '',
      date: yearMatch ? normalizeDateToken(yearMatch[1]) : '',
    };
  });
}

function parseAwardsSection(lines: string[]): AwardEntry[] {
  return lines.filter(Boolean).map(line => {
    const clean = line.replace(BULLET_RE, '').trim();
    const parts = clean.split(/,|\|/).map(s => s.trim()).filter(Boolean);
    return {
      id: uuidv4(),
      title: parts[0] || clean,
      issuer: parts[1] || '',
      date: '',
      description: parts.slice(2).join(', '),
    };
  });
}

/**
 * Best-effort, fully offline parser that extracts structured resume fields from raw text
 * using regex/heuristics (section headers, date ranges, bullet points, contact patterns).
 * Accuracy varies a lot by resume layout — this is a starting point the user is expected
 * to review and correct, not a guaranteed-accurate transcription.
 */
export function heuristicParseResume(text: string): Partial<ResumeData> {
  const lines = text.replace(/\r\n/g, '\n').split('\n').map(l => l.trim());
  const { header, blocks } = splitIntoSections(lines);
  const personalInfo = extractContactInfo(text, header);

  const summaryBlock = blocks.find(b => b.key === 'summary');
  if (summaryBlock) {
    personalInfo.summary = summaryBlock.lines.join(' ').trim();
  } else {
    // No explicit "Summary" header — if the header area has a trailing paragraph, use it.
    const paragraph = header.map(l => l.trim()).filter(l => l && l.split(' ').length > 8);
    if (paragraph.length) personalInfo.summary = paragraph.join(' ');
  }

  const experience = blocks.filter(b => b.key === 'experience').flatMap(b => parseExperienceSection(b.lines));
  const education = blocks.filter(b => b.key === 'education').flatMap(b => parseEducationSection(b.lines));
  const skills = blocks.filter(b => b.key === 'skills').flatMap(b => parseSkillsSection(b.lines));
  const projects = blocks.filter(b => b.key === 'projects').flatMap(b => parseProjectsSection(b.lines));
  const certifications = blocks.filter(b => b.key === 'certifications').flatMap(b => parseCertificationsSection(b.lines));
  const awards = blocks.filter(b => b.key === 'awards').flatMap(b => parseAwardsSection(b.lines));

  return {
    personalInfo,
    sections: { education, experience, skills, projects, awards, certifications, custom: [] },
  };
}

const AI_IMPORT_SCHEMA = `{
  "personalInfo": { "name": "", "email": "", "phone": "", "location": "", "linkedin": "", "github": "", "website": "", "summary": "" },
  "sections": {
    "experience": [{ "company": "", "position": "", "location": "", "startDate": "YYYY-MM", "endDate": "YYYY-MM", "current": false, "achievements": ["..."], "technologies": "" }],
    "education": [{ "institution": "", "degree": "", "field": "", "startDate": "YYYY-MM", "endDate": "YYYY-MM", "gpa": "", "honors": "" }],
    "skills": [{ "category": "", "skills": "comma, separated, list" }],
    "projects": [{ "title": "", "year": "", "description": "", "technologies": "", "url": "" }],
    "certifications": [{ "name": "", "issuer": "", "date": "YYYY-MM" }],
    "awards": [{ "title": "", "issuer": "", "date": "", "description": "" }]
  }
}`;

/**
 * Uses the user's configured AI provider to parse resume text into structured fields.
 * More robust than the heuristic parser for unusual layouts, but requires an API key.
 */
export async function aiParseResume(text: string, aiSettings: AISettingsLike): Promise<Partial<ResumeData>> {
  const prompt = `Extract structured resume data from the raw resume text below. Only use information explicitly present in the text — never invent employers, dates, schools, or numbers that aren't there. Use "" for unknown string fields and [] for unknown lists. Dates must be formatted "YYYY-MM" (use "-01" for the month when only a year is given); for an ongoing/current role or program, set "current": true and leave "endDate" as "".

Respond with ONLY a JSON object in exactly this shape, no markdown, no commentary:
${AI_IMPORT_SCHEMA}

Resume text:
"""
${text.slice(0, 12000)}
"""`;

  const raw = await callAIText(prompt, aiSettings, 2500);
  return parseAIJson<Partial<ResumeData>>(raw);
}

function withId<T extends { id?: string }>(item: T): T & { id: string } {
  return { ...item, id: item.id || uuidv4() };
}

/** Fills in defaults/ids for whatever the parser found, producing a complete, ready-to-load ResumeData. */
export function buildResumeDataFromParsed(parsed: Partial<ResumeData>): ResumeData {
  const personalInfo: PersonalInfo = { ...blankResumeData.personalInfo, ...parsed.personalInfo };

  const education = (parsed.sections?.education || []).map(e => withId({
    institution: '', degree: '', field: '', startDate: '', endDate: '', gpa: '', coursework: '', honors: '', ...e,
  }));
  const experience = (parsed.sections?.experience || []).map(e => withId({
    company: '', position: '', location: '', startDate: '', endDate: '', current: false, technologies: '', ...e,
    achievements: Array.isArray(e.achievements) ? e.achievements.filter(Boolean) : [],
  }));
  const skills = (parsed.sections?.skills || []).map(s => withId({ category: '', skills: '', ...s }));
  const projects = (parsed.sections?.projects || []).map(p => withId({
    title: '', year: '', description: '', technologies: '', url: '', ...p,
  }));
  const certifications = (parsed.sections?.certifications || []).map(c => withId({
    name: '', issuer: '', date: '', ...c,
  }));
  const awards = (parsed.sections?.awards || []).map(a => withId({
    title: '', issuer: '', date: '', description: '', ...a,
  }));

  const sectionOrder = blankResumeData.sectionOrder.map(so => {
    if (so.type === 'certifications' && certifications.length > 0) return { ...so, visible: true };
    return { ...so };
  });

  return {
    personalInfo,
    sections: { education, experience, skills, projects, awards, certifications, custom: [] },
    sectionOrder,
    styling: { ...blankResumeData.styling, colors: { ...blankResumeData.styling.colors } },
  };
}

/**
 * Top-level entry point: parses raw resume text into a ready-to-load ResumeData, preferring
 * the user's configured AI provider for accuracy and falling back to the offline heuristic
 * parser if no key is set or the AI call fails.
 */
export async function importResumeFromText(text: string, aiSettings: AISettingsLike): Promise<ImportResumeResult> {
  const cleaned = text.replace(/\r\n/g, '\n').trim();
  if (!cleaned) {
    throw new Error('No readable text could be found in this file.');
  }

  if (aiSettings.provider !== 'none' && aiSettings.apiKey) {
    try {
      const parsed = await aiParseResume(cleaned, aiSettings);
      return { data: buildResumeDataFromParsed(parsed), usedAI: true };
    } catch (err) {
      const heuristic = heuristicParseResume(cleaned);
      return {
        data: buildResumeDataFromParsed(heuristic),
        usedAI: false,
        warning: `AI parsing failed (${humanizeAIError(err)}) — used basic text parsing instead. Please review fields carefully.`,
      };
    }
  }

  const heuristic = heuristicParseResume(cleaned);
  return { data: buildResumeDataFromParsed(heuristic), usedAI: false };
}
