import { describe, it, expect } from 'vitest';
import { buildMarkdown } from './markdownExport';
import { ResumeData } from '../types/resume';

const baseResume = (): ResumeData => ({
  personalInfo: {
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '555-0100',
    location: 'Austin, TX',
    summary: 'Experienced software engineer.',
  },
  sections: {
    education: [],
    experience: [
      {
        id: 'x1',
        company: 'Acme',
        position: 'Software Engineer',
        location: 'Remote',
        startDate: '2020-01',
        endDate: '',
        current: true,
        achievements: ['Built payment APIs.'],
        technologies: 'TypeScript, React',
      },
    ],
    skills: [{ id: 's1', category: 'Languages', skills: 'TypeScript, Python' }],
    projects: [],
    awards: [],
    certifications: [],
    custom: [],
  },
  sectionOrder: [
    { id: 'experience', type: 'experience', name: 'Work Experience', visible: true },
    { id: 'skills', type: 'skills', name: 'Skills', visible: true },
  ],
  styling: {
    template: 'professional',
    fontSize: 11,
    fontFamily: 'Arial',
    spacing: 1.2,
    colors: { primary: '#1C033C', secondary: '#371e77', accent: '#6d28d9' },
  },
});

describe('buildMarkdown', () => {
  it('includes name and summary', () => {
    const md = buildMarkdown(baseResume());
    expect(md).toContain('# Jane Doe');
    expect(md).toContain('Experienced software engineer.');
  });

  it('includes experience and skills sections', () => {
    const md = buildMarkdown(baseResume());
    expect(md).toContain('Acme');
    expect(md).toContain('Built payment APIs.');
    expect(md).toContain('TypeScript, Python');
  });

  it('skips hidden sections', () => {
    const data = baseResume();
    data.sectionOrder[1].visible = false;
    const md = buildMarkdown(data);
    expect(md).not.toContain('TypeScript, Python');
  });
});
