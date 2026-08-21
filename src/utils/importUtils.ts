import mammoth from 'mammoth';
import * as pdfjs from 'pdfjs-dist';
import { v4 as uuidv4 } from 'uuid';
import { ResumeData, ResumeRecord } from '../types/resume';
import { blankResumeData } from '../data/sampleResume';

// Vite-friendly worker for pdf.js
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/;

const HEADING_MAP: { pattern: RegExp; type: string }[] = [
  { pattern: /^(work\s+)?experience|employment|professional\s+experience$/i, type: 'experience' },
  { pattern: /^education|academic/i, type: 'education' },
  { pattern: /^skills|technical\s+skills|core\s+competencies$/i, type: 'skills' },
  { pattern: /^projects|personal\s+projects$/i, type: 'projects' },
  { pattern: /^awards|honors|achievements|recognition$/i, type: 'awards' },
  { pattern: /^certifications|certificates|licenses$/i, type: 'certifications' },
  { pattern: /^summary|professional\s+summary|objective|profile$/i, type: 'summary' },
];

function normalizeLines(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function detectHeading(line: string): string | null {
  const cleaned = line.replace(/[:\-–—]+$/, '').trim();
  if (cleaned.length > 40) return null;
  for (const h of HEADING_MAP) {
    if (h.pattern.test(cleaned)) return h.type;
  }
  // ALL CAPS short lines often section headers
  if (cleaned.length >= 4 && cleaned.length <= 30 && cleaned === cleaned.toUpperCase() && /[A-Z]/.test(cleaned)) {
    for (const h of HEADING_MAP) {
      if (h.pattern.test(cleaned.toLowerCase())) return h.type;
    }
  }
  return null;
}

function isBullet(line: string): boolean {
  return /^[•\-\*–—▪◦]\s+/.test(line) || /^\d+[.)]\s+/.test(line);
}

function stripBullet(line: string): string {
  return line.replace(/^[•\-\*–—▪◦]\s+/, '').replace(/^\d+[.)]\s+/, '').trim();
}

/** Heuristic text → structured ResumeData (best-effort). */
export function parseResumeText(text: string): ResumeData {
  const data: ResumeData = structuredClone(blankResumeData);
  const lines = normalizeLines(text);
  if (!lines.length) return data;

  // Name: first substantial line that is not email/phone/heading
  for (const line of lines.slice(0, 8)) {
    if (EMAIL_RE.test(line) || PHONE_RE.test(line)) continue;
    if (detectHeading(line)) continue;
    if (line.length >= 3 && line.length <= 60) {
      data.personalInfo.name = line;
      break;
    }
  }

  const blob = lines.join(' ');
  const email = blob.match(EMAIL_RE);
  if (email) data.personalInfo.email = email[0];
  const phone = blob.match(PHONE_RE);
  if (phone && phone[0].replace(/\D/g, '').length >= 10) {
    data.personalInfo.phone = phone[0].trim();
  }

  // LinkedIn / GitHub hints
  for (const line of lines) {
    if (/linkedin\.com/i.test(line) && !data.personalInfo.linkedin) {
      data.personalInfo.linkedin = line.replace(/^.*?(linkedin\.com\S+)/i, '$1').replace(/[,;].*$/, '');
    }
    if (/github\.com/i.test(line) && !data.personalInfo.github) {
      data.personalInfo.github = line.replace(/^.*?(github\.com\S+)/i, '$1').replace(/[,;].*$/, '');
    }
  }

  let section: string | null = null;
  const summaryLines: string[] = [];
  let currentExp: { company: string; position: string; achievements: string[]; technologies?: string } | null = null;
  let currentEdu: { institution: string; degree: string; field: string } | null = null;
  let currentProj: { title: string; description: string } | null = null;

  const flushExp = () => {
    if (currentExp && (currentExp.company || currentExp.achievements.length)) {
      data.sections.experience.push({
        id: uuidv4(),
        company: currentExp.company || 'Unknown',
        position: currentExp.position || '',
        location: '',
        startDate: '',
        endDate: '',
        current: false,
        achievements: currentExp.achievements.length ? currentExp.achievements : [''],
        technologies: currentExp.technologies || '',
      });
    }
    currentExp = null;
  };

  const flushEdu = () => {
    if (currentEdu && currentEdu.institution) {
      data.sections.education.push({
        id: uuidv4(),
        institution: currentEdu.institution,
        degree: currentEdu.degree,
        field: currentEdu.field,
        startDate: '',
        endDate: '',
        gpa: '',
        coursework: '',
        honors: '',
      });
    }
    currentEdu = null;
  };

  const flushProj = () => {
    if (currentProj && currentProj.title) {
      data.sections.projects.push({
        id: uuidv4(),
        title: currentProj.title,
        year: '',
        description: currentProj.description,
        technologies: '',
        url: '',
      });
    }
    currentProj = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const heading = detectHeading(line);
    if (heading) {
      flushExp();
      flushEdu();
      flushProj();
      section = heading;
      continue;
    }

    // Skip name/contact lines at top before any section
    if (!section) {
      if (line === data.personalInfo.name) continue;
      if (EMAIL_RE.test(line) || PHONE_RE.test(line)) continue;
      if (/linkedin|github/i.test(line)) continue;
      // treat as summary-ish preamble
      if (line.length > 40) summaryLines.push(line);
      continue;
    }

    if (section === 'summary') {
      summaryLines.push(line);
      continue;
    }

    if (section === 'experience') {
      if (isBullet(line)) {
        if (!currentExp) currentExp = { company: '', position: '', achievements: [] };
        currentExp.achievements.push(stripBullet(line));
        continue;
      }
      if (/^tech(nologies| stack)?:/i.test(line)) {
        if (currentExp) currentExp.technologies = line.replace(/^tech(nologies| stack)?:\s*/i, '');
        continue;
      }
      // New job line: "Company — Role" or "Role at Company"
      if (!isBullet(line) && line.length < 120) {
        flushExp();
        const parts = line.split(/\s+[—–\-|]\s+|\s+at\s+/i);
        if (parts.length >= 2) {
          currentExp = { company: parts[0].trim(), position: parts.slice(1).join(' ').trim(), achievements: [] };
        } else {
          currentExp = { company: line, position: '', achievements: [] };
        }
      }
      continue;
    }

    if (section === 'education') {
      if (isBullet(line)) continue;
      if (!currentEdu) {
        currentEdu = { institution: line, degree: '', field: '' };
      } else if (!currentEdu.degree) {
        const m = line.match(/(.+?)\s+in\s+(.+)/i);
        if (m) {
          currentEdu.degree = m[1].trim();
          currentEdu.field = m[2].trim();
        } else {
          currentEdu.degree = line;
        }
        flushEdu();
      }
      continue;
    }

    if (section === 'skills') {
      const m = line.match(/^([^:]+):\s*(.+)$/);
      if (m) {
        data.sections.skills.push({ id: uuidv4(), category: m[1].trim(), skills: m[2].trim() });
      } else {
        data.sections.skills.push({ id: uuidv4(), category: 'Skills', skills: line });
      }
      continue;
    }

    if (section === 'projects') {
      if (isBullet(line)) {
        if (currentProj) currentProj.description += (currentProj.description ? ' ' : '') + stripBullet(line);
        continue;
      }
      flushProj();
      currentProj = { title: line, description: '' };
      continue;
    }

    if (section === 'awards') {
      data.sections.awards.push({
        id: uuidv4(),
        title: stripBullet(line),
        issuer: '',
        date: '',
        description: '',
      });
      continue;
    }

    if (section === 'certifications') {
      data.sections.certifications.push({
        id: uuidv4(),
        name: stripBullet(line),
        issuer: '',
        date: '',
      });
    }
  }

  flushExp();
  flushEdu();
  flushProj();

  if (summaryLines.length) {
    data.personalInfo.summary = summaryLines.join(' ').slice(0, 800);
  }

  // Ensure section visibility for non-empty sections
  for (const s of data.sectionOrder) {
    if (s.type === 'certifications' && data.sections.certifications.length) s.visible = true;
  }

  return data;
}

export async function extractTextFromDocx(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value || '';
}

export async function extractTextFromPdf(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items
      .map((item) => ('str' in item ? String((item as { str: string }).str) : ''))
      .filter(Boolean);
    parts.push(strings.join(' '));
  }
  const text = parts.join('\n');
  if (!text.trim()) {
    throw new Error('No extractable text in this PDF (it may be a scan/image-only file).');
  }
  return text;
}

export function parseJsonResume(raw: string): ResumeData {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid JSON.');

  const obj = parsed as Record<string, unknown>;

  // Workspace backup
  if (Array.isArray(obj.resumes) && obj.resumes.length > 0) {
    const first = obj.resumes[0] as ResumeRecord;
    if (first?.data) return first.data as ResumeData;
  }

  // ResumeRecord
  if (obj.data && typeof obj.data === 'object' && (obj.data as ResumeData).personalInfo) {
    return obj.data as ResumeData;
  }

  // ResumeData
  if (obj.personalInfo && obj.sections) {
    return obj as unknown as ResumeData;
  }

  throw new Error('JSON is not a ResumeBuilder Pro resume or backup file.');
}

export type ImportSource = 'json' | 'docx' | 'pdf' | 'unknown';

export function detectSource(file: File): ImportSource {
  const name = file.name.toLowerCase();
  if (name.endsWith('.json') || file.type === 'application/json') return 'json';
  if (name.endsWith('.docx') || file.type.includes('wordprocessingml')) return 'docx';
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
  return 'unknown';
}

export async function importResumeFile(file: File): Promise<{ data: ResumeData; source: ImportSource; warnings: string[] }> {
  const source = detectSource(file);
  const warnings: string[] = [];

  if (source === 'json') {
    const text = await file.text();
    const data = parseJsonResume(text);
    return { data, source, warnings };
  }

  if (source === 'docx') {
    const text = await extractTextFromDocx(file);
    if (!text.trim()) throw new Error('Could not extract text from this DOCX file.');
    warnings.push('DOCX import is heuristic — review and edit fields after import.');
    return { data: parseResumeText(text), source, warnings };
  }

  if (source === 'pdf') {
    const text = await extractTextFromPdf(file);
    warnings.push('PDF import is heuristic — review and edit fields after import.');
    return { data: parseResumeText(text), source, warnings };
  }

  throw new Error('Unsupported file type. Use .json, .docx, or .pdf');
}
