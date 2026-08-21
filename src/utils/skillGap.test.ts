import { describe, it, expect } from 'vitest';
import { analyzeSkillGaps } from './skillGap';
import { ResumeData } from '../types/resume';

const baseResume = (skills: string): ResumeData => ({
  personalInfo: {
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '+1 555 0100',
    location: 'Austin, TX',
    linkedin: '',
    summary: '',
  },
  sections: {
    education: [],
    experience: [],
    skills: skills ? [{ id: 's1', category: 'Languages', skills }] : [],
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

describe('analyzeSkillGaps', () => {
  it('returns no gaps for empty skills', () => {
    expect(analyzeSkillGaps(baseResume(''))).toEqual([]);
  });

  it('identifies a relevant cluster and its missing skills', () => {
    const gaps = analyzeSkillGaps(baseResume('React, JavaScript'));
    const frontend = gaps.find(g => g.cluster === 'Frontend');
    expect(frontend).toBeDefined();
    expect(frontend?.matched).toEqual(expect.arrayContaining(['react', 'javascript']));
    expect(frontend?.missing.length).toBeGreaterThan(0);
  });

  it('does not report clusters with no matched skills', () => {
    const gaps = analyzeSkillGaps(baseResume('React'));
    expect(gaps.find(g => g.cluster === 'Data & ML')).toBeUndefined();
  });
});
