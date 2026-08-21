import { ResumeData, JDMatchResult, ATSLintResult, ATSRule, ContentQualityResult, ContentIssue } from '../types/resume';
import { callAIText } from './aiClient';

// ─────────────────────────────────────────────────────────────────────────────
// Keyword extraction helpers
// ─────────────────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'and', 'or', 'in', 'of', 'to', 'a', 'an', 'is', 'are', 'was', 'were',
  'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
  'for', 'on', 'at', 'by', 'with', 'from', 'as', 'into', 'through', 'during',
  'you', 'your', 'we', 'our', 'they', 'their', 'it', 'its', 'this', 'that',
  'these', 'those', 'not', 'no', 'nor', 'but', 'so', 'yet', 'both', 'either',
  'about', 'above', 'after', 'before', 'between', 'than', 'then', 'when',
  'where', 'who', 'which', 'what', 'how', 'if', 'while', 'also', 'more',
  'well', 'just', 'such', 'any', 'all', 'each', 'every', 'some', 'other',
  'new', 'good', 'great', 'high', 'strong', 'excellent', 'experience',
  'work', 'team', 'role', 'position', 'job', 'company', 'years',
]);

// Curated tech skill patterns (bigrams + single terms that are skills)
const SKILL_PATTERNS = [
  /\b(react(?:\.?js)?|angular|vue(?:\.?js)?|next(?:\.?js)?|node(?:\.?js)?|typescript|javascript|python|java|c\+\+|c#|go|golang|rust|swift|kotlin|ruby|php|scala|r\b)\b/gi,
  /\b(aws|azure|gcp|google cloud|docker|kubernetes|k8s|terraform|ansible|jenkins|ci\/cd|devops|git(?:hub|lab)?)\b/gi,
  /\b(sql|mysql|postgresql|mongodb|redis|elasticsearch|cassandra|dynamodb|firestore|oracle)\b/gi,
  /\b(machine learning|deep learning|nlp|computer vision|tensorflow|pytorch|scikit.?learn|pandas|numpy|spark|hadoop|kafka)\b/gi,
  /\b(rest(?:ful)? api|graphql|microservices|serverless|agile|scrum|jira|figma|linux|bash|shell)\b/gi,
  /\b(product manager|project manager|data engineer|data scientist|frontend|backend|full.?stack|mobile|ios|android|devops engineer|cloud architect)\b/gi,
];

export function extractKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();

  // 1. Extract skill patterns
  for (const pattern of SKILL_PATTERNS) {
    const matches = lower.match(pattern) || [];
    matches.forEach(m => found.add(m.trim().toLowerCase()));
  }

  // 2. Extract meaningful single words and bigrams
  const words = lower.match(/\b[a-z][a-z+#.]{2,}\b/g) || [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (!STOP_WORDS.has(w) && w.length > 3) found.add(w);
    if (i < words.length - 1) {
      const bigram = `${w} ${words[i + 1]}`;
      if (!STOP_WORDS.has(words[i]) && !STOP_WORDS.has(words[i + 1])) {
        found.add(bigram);
      }
    }
  }

  // Filter: keep only substantial keywords (length > 2)
  return Array.from(found).filter(k => k.length > 2);
}

function getResumeText(data: ResumeData): string {
  const parts: string[] = [
    data.personalInfo.name,
    data.personalInfo.summary || '',
  ];
  for (const exp of data.sections.experience) {
    parts.push(exp.position, exp.company, ...exp.achievements, exp.technologies || '');
  }
  for (const edu of data.sections.education) {
    parts.push(edu.degree, edu.field, edu.institution, edu.coursework || '');
  }
  for (const s of data.sections.skills) {
    parts.push(s.category, s.skills);
  }
  for (const proj of data.sections.projects) {
    parts.push(proj.title, proj.description, proj.technologies || '');
  }
  for (const aw of data.sections.awards) {
    parts.push(aw.title, aw.description);
  }
  return parts.join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// JD Match Scoring
// ─────────────────────────────────────────────────────────────────────────────

export function matchJobDescription(data: ResumeData, jobDescription: string): JDMatchResult {
  if (!jobDescription.trim()) {
    return { score: 0, matchedKeywords: [], missingKeywords: [], suggestions: [] };
  }

  const jdKeywords = extractKeywords(jobDescription);
  const resumeText = getResumeText(data).toLowerCase();

  const matched: string[] = [];
  const missing: string[] = [];

  // Deduplicate JD keywords, keep meaningful ones
  const unique = Array.from(new Set(jdKeywords));
  for (const kw of unique) {
    if (resumeText.includes(kw.toLowerCase())) {
      matched.push(kw);
    } else {
      missing.push(kw);
    }
  }

  // Score: % of JD keywords found in resume (capped meaningful set)
  const totalMeaningful = Math.min(unique.length, 80);
  const matchedMeaningful = Math.min(matched.length, totalMeaningful);
  const rawScore = totalMeaningful === 0 ? 0 : Math.round((matchedMeaningful / totalMeaningful) * 100);
  const score = Math.min(rawScore, 100);

  const suggestions: string[] = [];
  if (missing.length > 0) {
    suggestions.push(`Add these missing keywords to your resume: ${missing.slice(0, 8).join(', ')}`);
  }
  if (score < 50) {
    suggestions.push('Your resume matches less than 50% of the job description keywords. Consider tailoring your experience bullet points.');
  }
  if (!data.personalInfo.summary) {
    suggestions.push('Add a professional summary that incorporates key terms from the job description.');
  }

  return { score, matchedKeywords: matched.slice(0, 30), missingKeywords: missing.slice(0, 30), suggestions };
}

// ─────────────────────────────────────────────────────────────────────────────
// ATS Parse-Safety Linter
// ─────────────────────────────────────────────────────────────────────────────

const STANDARD_HEADINGS = new Set([
  'work experience', 'experience', 'employment', 'professional experience',
  'education', 'academic background',
  'skills', 'technical skills', 'core competencies',
  'projects', 'personal projects', 'project work',
  'awards', 'honors', 'achievements', 'recognition',
  'certifications', 'licenses', 'certificates',
  'summary', 'professional summary', 'objective', 'career objective',
  'publications', 'volunteer', 'languages',
]);

const SAFE_FONTS = new Set(['arial', 'calibri', 'georgia', 'times new roman', 'helvetica', 'garamond', 'verdana', 'tahoma', 'trebuchet ms', 'cambria']);

const WEAK_VERBS = [
  'helped', 'assisted', 'worked on', 'was responsible for', 'responsible for',
  'participated in', 'involved in', 'contributed to', 'supported', 'did', 'made',
  'handled', 'dealt with', 'tried to', 'attempted to',
];

const FILLER_WORDS = [
  'very', 'really', 'quite', 'basically', 'literally', 'honestly',
  'actually', 'various', 'numerous', 'many', 'several', 'some', 'different',
  'a lot of', 'lots of', 'hard working', 'team player', 'go-getter',
  'results-oriented', 'self-starter', 'detail-oriented', 'passionate about',
  'dynamic', 'synergy', 'leverage', 'utilize', 'innovative', 'strategic',
];

export function lintATSCompatibility(data: ResumeData): ATSLintResult {
  const rules: ATSRule[] = [];

  // 1. Contact info completeness
  const hasEmail = !!data.personalInfo.email;
  const hasPhone = !!data.personalInfo.phone;
  const hasName = !!data.personalInfo.name;
  const hasLocation = !!data.personalInfo.location;
  rules.push({
    id: 'contact-name',
    category: 'Contact Info',
    label: 'Full name present',
    status: hasName ? 'pass' : 'fail',
    detail: hasName ? 'Full name is present.' : 'Your name is missing from the resume.',
    fix: 'Add your full name in Personal Info.',
  });
  rules.push({
    id: 'contact-email',
    category: 'Contact Info',
    label: 'Email address',
    status: hasEmail ? 'pass' : 'fail',
    detail: hasEmail ? 'Email address is present.' : 'No email address found.',
    fix: 'Add a professional email address.',
  });
  rules.push({
    id: 'contact-phone',
    category: 'Contact Info',
    label: 'Phone number',
    status: hasPhone ? 'pass' : 'fail',
    detail: hasPhone ? 'Phone number is present.' : 'No phone number found.',
    fix: 'Add a phone number for recruiters to reach you.',
  });
  rules.push({
    id: 'contact-location',
    category: 'Contact Info',
    label: 'Location (City, State)',
    status: hasLocation ? 'pass' : 'warn',
    detail: hasLocation ? 'Location is present.' : 'No location found — many ATS filter by location.',
    fix: 'Add at least City, State to your contact info.',
  });

  // 2. Font safety
  const fontLower = (data.styling.fontFamily || '').toLowerCase();
  rules.push({
    id: 'font-safe',
    category: 'Formatting',
    label: 'ATS-safe font',
    status: SAFE_FONTS.has(fontLower) ? 'pass' : 'warn',
    detail: SAFE_FONTS.has(fontLower)
      ? `"${data.styling.fontFamily}" is a widely recognized ATS-safe font.`
      : `"${data.styling.fontFamily}" may not parse correctly in all ATS.`,
    fix: 'Use Arial, Calibri, Georgia, Times New Roman, or Helvetica.',
  });

  // 3. Font size
  const fs = data.styling.fontSize;
  rules.push({
    id: 'font-size',
    category: 'Formatting',
    label: 'Font size (10–12pt)',
    status: fs >= 10 && fs <= 12 ? 'pass' : 'warn',
    detail: fs >= 10 && fs <= 12 ? `Font size ${fs}pt is optimal for ATS and readability.` : `Font size ${fs}pt may be too ${fs < 10 ? 'small' : 'large'}.`,
    fix: 'Set font size between 10–12pt in Styling.',
  });

  // 4. Standard section headings
  const sectionNames = data.sectionOrder.filter(s => s.visible).map(s => s.name.toLowerCase());
  const nonStandardSections = sectionNames.filter(n => !STANDARD_HEADINGS.has(n) && !n.startsWith('custom'));
  rules.push({
    id: 'section-headings',
    category: 'Structure',
    label: 'Standard section headings',
    status: nonStandardSections.length === 0 ? 'pass' : 'warn',
    detail: nonStandardSections.length === 0
      ? 'All visible sections use standard ATS-recognized headings.'
      : `Non-standard section names detected: ${nonStandardSections.join(', ')}`,
    fix: 'Use standard headings: "Work Experience", "Education", "Skills", "Projects".',
  });

  // 5. Content: experience section
  rules.push({
    id: 'has-experience',
    category: 'Content',
    label: 'Work experience section',
    status: data.sections.experience.length > 0 ? 'pass' : 'fail',
    detail: data.sections.experience.length > 0
      ? `${data.sections.experience.length} experience entr${data.sections.experience.length === 1 ? 'y' : 'ies'} present.`
      : 'No work experience entries found.',
    fix: 'Add at least one work experience entry.',
  });

  // 6. Quantified achievements
  const totalAchievements = data.sections.experience.flatMap(e => e.achievements.filter(a => a.trim())).length;
  const quantifiedAchievements = data.sections.experience.flatMap(e =>
    e.achievements.filter(a => /\d+/.test(a))
  ).length;
  const quantRatio = totalAchievements === 0 ? 0 : quantifiedAchievements / totalAchievements;
  rules.push({
    id: 'quantified-achievements',
    category: 'Content',
    label: 'Quantified achievements (numbers/metrics)',
    status: quantRatio >= 0.5 ? 'pass' : quantRatio > 0 ? 'warn' : 'fail',
    detail: totalAchievements === 0
      ? 'No achievement bullet points found.'
      : `${quantifiedAchievements}/${totalAchievements} bullet points contain numbers/metrics.`,
    fix: 'Add numbers to your achievements: "Increased X by 30%", "Reduced cost by $50K".',
  });

  // 7. Skills section
  const totalSkills = data.sections.skills.reduce((acc, s) => acc + s.skills.split(',').length, 0);
  rules.push({
    id: 'skills-count',
    category: 'Content',
    label: 'Skills (8+ recommended)',
    status: totalSkills >= 8 ? 'pass' : totalSkills > 0 ? 'warn' : 'fail',
    detail: totalSkills > 0 ? `${totalSkills} skills listed across ${data.sections.skills.length} categor${data.sections.skills.length === 1 ? 'y' : 'ies'}.` : 'No skills listed.',
    fix: 'Add at least 8 relevant skills organized by category.',
  });

  // 8. Education
  rules.push({
    id: 'has-education',
    category: 'Content',
    label: 'Education section',
    status: data.sections.education.length > 0 ? 'pass' : 'warn',
    detail: data.sections.education.length > 0 ? 'Education information is present.' : 'No education information.',
    fix: 'Add your highest educational qualification.',
  });

  // 9. Summary / objective
  rules.push({
    id: 'has-summary',
    category: 'Content',
    label: 'Professional summary',
    status: data.personalInfo.summary && data.personalInfo.summary.length > 50 ? 'pass' : 'warn',
    detail: data.personalInfo.summary && data.personalInfo.summary.length > 50
      ? 'Professional summary is present.'
      : 'No professional summary found (or too short).',
    fix: 'Add a 2–4 sentence professional summary with your top skills and years of experience.',
  });

  // 10. LinkedIn presence
  rules.push({
    id: 'linkedin',
    category: 'Contact Info',
    label: 'LinkedIn profile URL',
    status: data.personalInfo.linkedin ? 'pass' : 'warn',
    detail: data.personalInfo.linkedin ? 'LinkedIn URL is present.' : 'No LinkedIn URL found.',
    fix: 'Add your LinkedIn profile URL to improve recruiter visibility.',
  });

  const passed = rules.filter(r => r.status === 'pass').length;
  const score = Math.round((passed / rules.length) * 100);

  return { passed: score >= 70, rules, score };
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-category score breakdown
// ─────────────────────────────────────────────────────────────────────────────

export function getCategoryScores(rules: ATSRule[]): Record<string, number> {
  const byCategory = new Map<string, ATSRule[]>();
  for (const rule of rules) {
    const list = byCategory.get(rule.category) || [];
    list.push(rule);
    byCategory.set(rule.category, list);
  }

  const scores: Record<string, number> = {};
  for (const [category, categoryRules] of byCategory) {
    const points = categoryRules.reduce((acc, r) => {
      if (r.status === 'pass') return acc + 1;
      if (r.status === 'warn') return acc + 0.5;
      return acc;
    }, 0);
    scores[category] = Math.round((points / categoryRules.length) * 100);
  }
  return scores;
}

// ─────────────────────────────────────────────────────────────────────────────
// Content Quality Checker
// ─────────────────────────────────────────────────────────────────────────────

function buildContentIssuesForLine(line: string, section: string): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const lower = line.toLowerCase();

  // Weak verbs
  const foundWeak = WEAK_VERBS.find(v => lower.startsWith(v) || lower.includes(` ${v} `));
  if (foundWeak) {
    issues.push({
      type: 'weak_verb',
      section,
      text: line,
      suggestion: `Replace "${foundWeak}" with a strong action verb: Led, Architected, Drove, Reduced, Optimized, Delivered, Increased, Built.`,
    });
  }

  // Passive voice patterns
  if (/\bwas (done|completed|built|created|developed|implemented|managed|handled)\b/i.test(line)) {
    issues.push({
      type: 'passive_voice',
      section,
      text: line,
      suggestion: 'Rewrite in active voice: instead of "was built by me", write "Built...".',
    });
  }

  // No metric
  if (!/\d+/.test(line) && line.length > 30) {
    issues.push({
      type: 'no_metric',
      section,
      text: line,
      suggestion: 'Add a number or metric: "Reduced latency by 40%", "Served 1M+ users", "Cut costs by $20K".',
    });
  }

  // Too short
  if (line.trim().length < 20 && line.trim().length > 0) {
    issues.push({
      type: 'too_short',
      section,
      text: line,
      suggestion: 'Expand this bullet point to include context, action, and measurable result.',
    });
  }

  // Too long
  if (line.length > 220) {
    issues.push({
      type: 'too_long',
      section,
      text: line.slice(0, 80) + '...',
      suggestion: 'Shorten to 1–2 lines. Focus on the key action and outcome.',
    });
  }

  // Filler words
  const foundFiller = FILLER_WORDS.find(f => lower.includes(f.toLowerCase()));
  if (foundFiller) {
    issues.push({
      type: 'filler_word',
      section,
      text: line,
      suggestion: `Remove filler phrase "${foundFiller}". Replace with specific, concrete language.`,
    });
  }

  return issues;
}

function dedupeIssuesByText(issues: ContentIssue[]): ContentIssue[] {
  const seen = new Set<string>();
  return issues.filter(i => {
    if (seen.has(i.text)) return false;
    seen.add(i.text);
    return true;
  });
}

export function checkContentQuality(data: ResumeData): ContentQualityResult {
  const issues: ContentIssue[] = [];

  // Check achievement bullet points
  for (const exp of data.sections.experience) {
    for (const ach of exp.achievements.filter(a => a.trim())) {
      issues.push(...buildContentIssuesForLine(ach, `${exp.company} – ${exp.position}`));
    }
  }

  const unique = dedupeIssuesByText(issues);

  const totalBullets = data.sections.experience.flatMap(e => e.achievements.filter(a => a.trim())).length;
  const issueCount = unique.length;
  const score = totalBullets === 0 ? 0 : Math.max(0, Math.round(100 - (issueCount / Math.max(totalBullets, 1)) * 80));

  return { issues: unique, score };
}

// ─────────────────────────────────────────────────────────────────────────────
// Raw-text ATS analysis (for uploaded resume files: PDF / DOCX / TXT)
// ─────────────────────────────────────────────────────────────────────────────

const EXPERIENCE_HEADINGS = new Set(['work experience', 'experience', 'employment', 'professional experience']);
const EDUCATION_HEADINGS = new Set(['education', 'academic background']);
const SKILLS_HEADINGS = new Set(['skills', 'technical skills', 'core competencies']);
const SUMMARY_HEADINGS = new Set(['summary', 'professional summary', 'objective', 'career objective']);
const ALL_RAW_HEADINGS = new Set([
  ...EXPERIENCE_HEADINGS, ...EDUCATION_HEADINGS, ...SKILLS_HEADINGS, ...SUMMARY_HEADINGS,
]);

interface RawSections {
  summary: string[];
  experience: string[];
  education: string[];
  skills: string[];
}

function normalizeHeadingLine(line: string): string {
  return line.trim().toLowerCase().replace(/[:\-–—]+$/, '').trim();
}

function isBulletLine(line: string): boolean {
  return /^[-•*▪●○◦]\s+/.test(line) || /^\d+[.)]\s+/.test(line);
}

function stripBulletMarker(line: string): string {
  return line.replace(/^[-•*▪●○◦]\s+/, '').replace(/^\d+[.)]\s+/, '');
}

function splitIntoRawSections(text: string): RawSections {
  const lines = text.split(/\r?\n/);
  const sections: RawSections = { summary: [], experience: [], education: [], skills: [] };
  let current: keyof RawSections | null = null;

  for (const rawLine of lines) {
    const normalized = normalizeHeadingLine(rawLine);
    if (ALL_RAW_HEADINGS.has(normalized)) {
      if (EXPERIENCE_HEADINGS.has(normalized)) current = 'experience';
      else if (EDUCATION_HEADINGS.has(normalized)) current = 'education';
      else if (SKILLS_HEADINGS.has(normalized)) current = 'skills';
      else if (SUMMARY_HEADINGS.has(normalized)) current = 'summary';
      continue;
    }
    if (current && rawLine.trim()) {
      sections[current].push(rawLine.trim());
    }
  }
  return sections;
}

/** ATS parse-safety rules computed from raw extracted text (uploaded PDF/DOCX/TXT), not the structured builder data. */
export function lintRawResumeText(text: string): ATSLintResult {
  const rules: ATSRule[] = [];
  const trimmed = text.trim();
  const sections = splitIntoRawSections(text);

  rules.push({
    id: 'raw-extractable',
    category: 'File',
    label: 'Readable text extracted',
    status: trimmed.length >= 100 ? 'pass' : trimmed.length > 0 ? 'warn' : 'fail',
    detail: trimmed.length >= 100
      ? `Extracted ${trimmed.length.toLocaleString()} characters of text.`
      : trimmed.length > 0
        ? `Only ${trimmed.length} characters extracted — this file may be image-based or poorly formatted.`
        : 'No text could be extracted. This is likely a scanned/image-based file that ATS systems cannot read at all.',
    fix: 'Export from a text-based editor (Word, Google Docs) rather than scanning a printed resume.',
  });

  const hasEmail = /[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/.test(text);
  const hasPhone = /(\+?\d[\d\s().-]{7,}\d)/.test(text);
  rules.push({
    id: 'raw-email',
    category: 'Contact Info',
    label: 'Email address',
    status: hasEmail ? 'pass' : 'fail',
    detail: hasEmail ? 'Email address detected.' : 'No email address detected.',
    fix: 'Add a professional email address near the top of your resume.',
  });
  rules.push({
    id: 'raw-phone',
    category: 'Contact Info',
    label: 'Phone number',
    status: hasPhone ? 'pass' : 'warn',
    detail: hasPhone ? 'Phone number detected.' : 'No phone number detected.',
    fix: 'Add a phone number for recruiters to reach you.',
  });

  rules.push({
    id: 'raw-experience-section',
    category: 'Structure',
    label: 'Work experience section',
    status: sections.experience.length > 0 ? 'pass' : 'fail',
    detail: sections.experience.length > 0
      ? 'A recognizable "Experience" heading and content was found.'
      : 'No standard "Experience" section heading was detected.',
    fix: 'Use a standard heading like "Work Experience" or "Experience".',
  });
  rules.push({
    id: 'raw-education-section',
    category: 'Structure',
    label: 'Education section',
    status: sections.education.length > 0 ? 'pass' : 'warn',
    detail: sections.education.length > 0
      ? 'A recognizable "Education" heading and content was found.'
      : 'No standard "Education" section heading was detected.',
    fix: 'Use a standard heading like "Education".',
  });
  rules.push({
    id: 'raw-skills-section',
    category: 'Structure',
    label: 'Skills section',
    status: sections.skills.length > 0 ? 'pass' : 'warn',
    detail: sections.skills.length > 0
      ? 'A recognizable "Skills" heading and content was found.'
      : 'No standard "Skills" section heading was detected.',
    fix: 'Use a standard heading like "Skills" or "Technical Skills".',
  });

  const bulletLines = sections.experience.filter(isBulletLine);
  const quantified = bulletLines.filter(l => /\d/.test(l));
  const quantRatio = bulletLines.length === 0 ? 0 : quantified.length / bulletLines.length;
  rules.push({
    id: 'raw-quantified',
    category: 'Content',
    label: 'Quantified achievements (numbers/metrics)',
    status: bulletLines.length === 0 ? 'warn' : quantRatio >= 0.5 ? 'pass' : quantified.length > 0 ? 'warn' : 'fail',
    detail: bulletLines.length === 0
      ? 'No bullet points detected under Experience.'
      : `${quantified.length}/${bulletLines.length} bullet points contain numbers/metrics.`,
    fix: 'Add numbers to your achievements: "Increased X by 30%", "Reduced cost by $50K".',
  });

  const skillTokens = sections.skills.join(', ').split(',').map(s => s.trim()).filter(Boolean);
  rules.push({
    id: 'raw-skills-count',
    category: 'Content',
    label: 'Skills (8+ recommended)',
    status: skillTokens.length >= 8 ? 'pass' : skillTokens.length > 0 ? 'warn' : 'fail',
    detail: skillTokens.length > 0 ? `${skillTokens.length} skills detected.` : 'No skills detected.',
    fix: 'List at least 8 relevant skills, comma-separated.',
  });

  const hasSummary = sections.summary.join(' ').length > 50;
  rules.push({
    id: 'raw-summary',
    category: 'Content',
    label: 'Professional summary',
    status: hasSummary ? 'pass' : 'warn',
    detail: hasSummary ? 'Professional summary detected.' : 'No professional summary detected (or too short).',
    fix: 'Add a 2–4 sentence professional summary near the top.',
  });

  const wordCount = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
  rules.push({
    id: 'raw-length',
    category: 'Length',
    label: 'Resume length (~350–800 words)',
    status: wordCount >= 300 && wordCount <= 900 ? 'pass' : wordCount > 0 ? 'warn' : 'fail',
    detail: `${wordCount.toLocaleString()} words detected.`,
    fix: wordCount < 300 ? 'Add more detail to your experience and skills.' : 'Trim content to focus on your most relevant, recent experience.',
  });

  const passed = rules.filter(r => r.status === 'pass').length;
  const score = Math.round((passed / rules.length) * 100);

  return { passed: score >= 70, rules, score };
}

/** Content-quality issues (weak verbs, passive voice, missing metrics, etc.) computed from raw extracted text. */
export function checkRawContentQuality(text: string): ContentQualityResult {
  const sections = splitIntoRawSections(text);
  const bulletLines = sections.experience.filter(isBulletLine).map(stripBulletMarker);

  const issues: ContentIssue[] = [];
  for (const line of bulletLines) {
    issues.push(...buildContentIssuesForLine(line, 'Uploaded resume'));
  }

  const unique = dedupeIssuesByText(issues);
  const score = bulletLines.length === 0 ? 0 : Math.max(0, Math.round(100 - (unique.length / Math.max(bulletLines.length, 1)) * 80));

  return { issues: unique, score };
}

// ─────────────────────────────────────────────────────────────────────────────
// AI-powered helpers (uses user-supplied API key, falls back to rule-based)
// ─────────────────────────────────────────────────────────────────────────────

export async function rewriteBulletWithAI(
  bullet: string,
  context: { position: string; company: string },
  aiSettings: { provider: string; apiKey: string; model?: string }
): Promise<string> {
  if (aiSettings.provider === 'none' || !aiSettings.apiKey) {
    return rewriteBulletRuleBased(bullet);
  }

  const prompt = `You are a professional resume writer. Rewrite the following achievement bullet point to be more impactful: use a strong action verb, include measurable results if possible, and keep it under 200 characters. Return only the rewritten bullet point text.

Role: ${context.position} at ${context.company}
Original: ${bullet}
Rewritten:`;

  try {
    const result = await callAIText(prompt, aiSettings, 200);
    return result || rewriteBulletRuleBased(bullet);
  } catch (err) {
    console.error('AI rewrite failed, falling back to rule-based:', err);
  }

  return rewriteBulletRuleBased(bullet);
}

export async function generateSummaryWithAI(
  data: ResumeData,
  aiSettings: { provider: string; apiKey: string; model?: string },
  targetRole?: string
): Promise<string> {
  const yearsExp = data.sections.experience.length > 0
    ? `${data.sections.experience.length * 2}+`
    : 'several';
  const topSkills = data.sections.skills.flatMap(s => s.skills.split(',').map(sk => sk.trim())).slice(0, 6).join(', ');
  const companies = data.sections.experience.map(e => e.company).join(', ');

  if (aiSettings.provider === 'none' || !aiSettings.apiKey) {
    return generateSummaryRuleBased(data);
  }

  const prompt = `Write a professional resume summary (2-3 sentences, 60-100 words) for a candidate with the following profile. Make it ATS-optimized, specific, and impactful. Return only the summary text.

Name: ${data.personalInfo.name}
${targetRole ? `Target Role: ${targetRole}` : ''}
Experience: ${yearsExp} years at ${companies}
Top Skills: ${topSkills}`;

  try {
    const result = await callAIText(prompt, aiSettings, 200);
    return result || generateSummaryRuleBased(data);
  } catch (err) {
    console.error('AI summary failed, falling back:', err);
  }

  return generateSummaryRuleBased(data);
}

// ── Rule-based fallbacks ───────────────────────────────────────────────────────

const STRONG_VERBS = ['Led', 'Built', 'Developed', 'Architected', 'Optimized', 'Drove', 'Delivered', 'Designed', 'Implemented', 'Created'];

function rewriteBulletRuleBased(bullet: string): string {
  const trimmed = bullet.trim();
  const lower = trimmed.toLowerCase();

  // Replace weak verb at start
  for (const weak of WEAK_VERBS) {
    if (lower.startsWith(weak)) {
      const rest = trimmed.slice(weak.length);
      const strong = STRONG_VERBS[Math.floor(Math.random() * STRONG_VERBS.length)];
      return strong + rest;
    }
  }

  // Capitalize first word if not already a strong verb
  const firstWord = trimmed.split(' ')[0];
  const isStrong = STRONG_VERBS.some(v => v.toLowerCase() === firstWord.toLowerCase());
  if (!isStrong) {
    const strong = STRONG_VERBS[Math.floor(Math.random() * STRONG_VERBS.length)];
    return strong + ' ' + trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
  }

  return trimmed;
}

function generateSummaryRuleBased(data: ResumeData): string {
  const name = data.personalInfo.name || 'Professional';
  const mostRecentExp = data.sections.experience[0];
  const topSkills = data.sections.skills.flatMap(s => s.skills.split(',').map(sk => sk.trim())).slice(0, 4).join(', ');
  const role = mostRecentExp?.position || 'Software Engineer';
  const company = mostRecentExp?.company || '';

  return `Results-driven ${role}${company ? ` with experience at ${company}` : ''} and expertise in ${topSkills || 'building scalable systems'}. Proven track record of delivering high-impact solutions that drive business value. Passionate about leveraging technology to solve complex problems at scale.`;
}
