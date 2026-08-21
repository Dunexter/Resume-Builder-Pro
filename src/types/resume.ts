export interface PersonalInfo {
  name: string;
  email: string;
  phone: string;
  location: string;
  github?: string;
  linkedin?: string;
  website?: string;
  summary?: string;
}

export interface EducationEntry {
  id: string;
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  gpa?: string;
  coursework?: string;
  honors?: string;
}

export interface ExperienceEntry {
  id: string;
  company: string;
  position: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  achievements: string[];
  technologies?: string;
}

export interface ProjectEntry {
  id: string;
  title: string;
  year: string;
  description: string;
  technologies?: string;
  url?: string;
}

export interface SkillEntry {
  id: string;
  category: string;
  skills: string;
}

export interface AwardEntry {
  id: string;
  title: string;
  issuer?: string;
  date?: string;
  description: string;
}

export interface CertificationEntry {
  id: string;
  name: string;
  issuer: string;
  date: string;
  expiryDate?: string;
  credentialId?: string;
}

export interface CustomSectionEntry {
  id: string;
  title: string;
  content: string;
}

export interface CustomSection {
  id: string;
  name: string;
  entries: CustomSectionEntry[];
}

export interface SectionOrder {
  id: string;
  type: 'skills' | 'experience' | 'education' | 'projects' | 'awards' | 'certifications' | 'custom';
  name: string;
  visible: boolean;
}

export interface ResumeData {
  personalInfo: PersonalInfo;
  sections: {
    education: EducationEntry[];
    experience: ExperienceEntry[];
    skills: SkillEntry[];
    projects: ProjectEntry[];
    awards: AwardEntry[];
    certifications: CertificationEntry[];
    custom: CustomSection[];
  };
  sectionOrder: SectionOrder[];
  styling: {
    template: 'professional' | 'modern' | 'classic' | 'compact' | 'executive';
    fontSize: number;
    fontFamily: string;
    spacing: number;
    colors: {
      primary: string;
      secondary: string;
      accent: string;
    };
  };
}

export interface ResumeVersion {
  id: string;
  label: string;
  createdAt: string;
  data: ResumeData;
}

export interface ResumeRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  targetJob?: string;
  data: ResumeData;
  versions: ResumeVersion[];
  jobDescription?: string;
  jdMatchScore?: number;
}

export interface AISettings {
  provider: 'openai' | 'gemini' | 'none';
  apiKey: string;
  model?: string;
}

export interface AppSettings {
  ai: AISettings;
  darkMode: boolean;
  autoSave: boolean;
}

export interface CoverLetter {
  id: string;
  resumeId: string;
  companyName: string;
  jobTitle: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeState {
  // Multi-resume support
  resumeList: { id: string; name: string; updatedAt: string; targetJob?: string }[];
  activeResumeId: string;

  // Active resume data
  data: ResumeData;
  activeSection: string;
  isLoading: boolean;
  lastSaved: string | null;

  // JD matching
  jobDescription: string;
  jdMatchResult: JDMatchResult | null;

  // Settings
  settings: AppSettings;

  // UI state
  showTemplateGallery: boolean;
  showCoverLetterBuilder: boolean;

  // Undo/redo history (in-memory only, not persisted)
  history: {
    past: ResumeData[];
    future: ResumeData[];
  };
}

export interface JDMatchResult {
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: string[];
}

export interface ATSLintResult {
  passed: boolean;
  rules: ATSRule[];
  score: number;
}

export interface ATSRule {
  id: string;
  category: string;
  label: string;
  status: 'pass' | 'fail' | 'warn';
  detail: string;
  fix?: string;
}

export interface ContentQualityResult {
  issues: ContentIssue[];
  score: number;
}

export interface ContentIssue {
  type: 'weak_verb' | 'passive_voice' | 'no_metric' | 'filler_word' | 'too_short' | 'too_long';
  section: string;
  text: string;
  suggestion: string;
}
