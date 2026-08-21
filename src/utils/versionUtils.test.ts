import { describe, it, expect } from 'vitest';
import { diffResumeData } from './versionUtils';
import { ResumeData } from '../types/resume';

const baseResume = (): ResumeData => ({
  personalInfo: {
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '',
    location: '',
    linkedin: '',
    summary: 'Original summary',
  },
  sections: {
    education: [],
    experience: [],
    skills: [{ id: 's1', category: 'Languages', skills: 'TypeScript' }],
    projects: [],
    awards: [],
    certifications: [],
    custom: [],
  },
  sectionOrder: [],
  styling: {
    template: 'professional',
    fontSize: 11,
    fontFamily: 'Arial',
    spacing: 1.2,
    colors: { primary: '#1C033C', secondary: '#371e77', accent: '#6d28d9' },
  },
});

describe('diffResumeData', () => {
  it('returns no diffs for identical data', () => {
    const data = baseResume();
    expect(diffResumeData(data, structuredClone(data))).toEqual([]);
  });

  it('detects a changed primitive field', () => {
    const a = baseResume();
    const b = baseResume();
    b.personalInfo.summary = 'Updated summary';
    const diffs = diffResumeData(a, b);
    expect(diffs.some(d => d.path === 'personalInfo.summary' && d.after === 'Updated summary')).toBe(true);
  });

  it('detects a changed array element', () => {
    const a = baseResume();
    const b = baseResume();
    b.sections.skills[0].skills = 'TypeScript, React';
    const diffs = diffResumeData(a, b);
    expect(diffs.some(d => d.path.includes('sections.skills[0].skills'))).toBe(true);
  });
});
