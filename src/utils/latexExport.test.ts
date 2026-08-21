import { describe, it, expect } from 'vitest';
import { buildLatex } from './latexExport';
import { ResumeData } from '../types/resume';

const baseResume = (): ResumeData => ({
  personalInfo: {
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '555-0100',
    location: 'Austin, TX',
    summary: 'Experienced software engineer & AWS specialist.',
  },
  sections: {
    education: [],
    experience: [],
    skills: [],
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

describe('buildLatex', () => {
  it('produces a compilable-looking LaTeX document', () => {
    const tex = buildLatex(baseResume());
    expect(tex).toContain('\\documentclass');
    expect(tex).toContain('\\begin{document}');
    expect(tex).toContain('\\end{document}');
    expect(tex).toContain('Jane Doe');
  });

  it('escapes special LaTeX characters', () => {
    const tex = buildLatex(baseResume());
    expect(tex).toContain('\\&');
  });
});
