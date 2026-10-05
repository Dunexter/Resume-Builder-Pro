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
  it('escapes Markdown and raw HTML in all user content', () => {
    const data = baseResume();
    data.personalInfo.name = '# [Name] *bold*';
    data.personalInfo.summary = '<script>alert(1)</script> & **injected**\n1. list';
    const md = buildMarkdown(data);
    expect(md).toContain('\\# \\[Name\\] \\*bold\\*');
    expect(md).toContain('&lt;script&gt;');
    expect(md).toContain('&amp; \\*\\*injected\\*\\*');
    expect(md).toContain('1\\. list');
    expect(md).not.toContain('<script>');
  });

  it('links only HTTP(S) destinations and encodes destination delimiters', () => {
    const data = baseResume();
    data.sectionOrder.push({ id: 'projects', type: 'projects', name: 'Projects', visible: true });
    data.sections.projects = [{ id: 'p', title: 'Link', year: '', description: '', url: 'javascript:alert(1)' }];
    expect(buildMarkdown(data)).not.toContain('](javascript:');
    data.sections.projects[0].url = 'https://example.com/a(b)?q=x';
    expect(buildMarkdown(data)).toContain('](https://example.com/a%28b%29?q=x)');
  });

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
