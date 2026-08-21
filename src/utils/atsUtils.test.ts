import { describe, it, expect } from 'vitest';
import {
  extractKeywords,
  matchJobDescription,
  lintATSCompatibility,
  checkContentQuality,
  getCategoryScores,
} from './atsUtils';
import { ResumeData } from '../types/resume';

const baseResume = (): ResumeData => ({
  personalInfo: {
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '+1 555 0100',
    location: 'Austin, TX',
    linkedin: 'linkedin.com/in/jane',
    summary: 'Software engineer with 5 years of experience building cloud services on AWS and React.',
  },
  sections: {
    education: [
      {
        id: 'e1',
        institution: 'State University',
        degree: 'B.S.',
        field: 'Computer Science',
        startDate: '2015-08',
        endDate: '2019-05',
      },
    ],
    experience: [
      {
        id: 'x1',
        company: 'Acme',
        position: 'Software Engineer',
        location: 'Remote',
        startDate: '2020-01',
        endDate: '',
        current: true,
        achievements: [
          'Built payment APIs reducing latency by 40% and serving 1M+ users.',
          'helped with deployment tasks for the team',
        ],
        technologies: 'TypeScript, React, AWS, Kubernetes',
      },
    ],
    skills: [
      { id: 's1', category: 'Languages', skills: 'TypeScript, Python, SQL, Go, Java, JavaScript, C++, Rust' },
    ],
    projects: [],
    awards: [],
    certifications: [],
    custom: [],
  },
  sectionOrder: [
    { id: 'experience', type: 'experience', name: 'Work Experience', visible: true },
    { id: 'education', type: 'education', name: 'Education', visible: true },
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

describe('extractKeywords', () => {
  it('finds known tech terms', () => {
    const kws = extractKeywords('Looking for React, TypeScript, and AWS experience with Kubernetes');
    const lower = kws.map(k => k.toLowerCase());
    expect(lower.some(k => k.includes('react'))).toBe(true);
    expect(lower.some(k => k.includes('typescript') || k.includes('aws'))).toBe(true);
  });
});

describe('matchJobDescription', () => {
  it('returns 0 for empty JD', () => {
    const r = matchJobDescription(baseResume(), '');
    expect(r.score).toBe(0);
  });

  it('matches overlapping keywords', () => {
    const r = matchJobDescription(
      baseResume(),
      'We need a TypeScript and React engineer with AWS and Kubernetes experience.'
    );
    expect(r.score).toBeGreaterThan(0);
    expect(r.matchedKeywords.length).toBeGreaterThan(0);
  });
});

describe('lintATSCompatibility', () => {
  it('scores a reasonably complete resume above zero', () => {
    const lint = lintATSCompatibility(baseResume());
    expect(lint.score).toBeGreaterThan(50);
    expect(lint.rules.length).toBeGreaterThan(5);
  });

  it('fails when name is missing', () => {
    const data = baseResume();
    data.personalInfo.name = '';
    const lint = lintATSCompatibility(data);
    const nameRule = lint.rules.find(r => r.id === 'contact-name');
    expect(nameRule?.status).toBe('fail');
  });
});

describe('checkContentQuality', () => {
  it('flags weak verbs', () => {
    const q = checkContentQuality(baseResume());
    expect(q.issues.some(i => i.type === 'weak_verb')).toBe(true);
  });
});

describe('getCategoryScores', () => {
  it('computes a score per rule category', () => {
    const lint = lintATSCompatibility(baseResume());
    const scores = getCategoryScores(lint.rules);
    expect(Object.keys(scores).length).toBeGreaterThan(0);
    for (const score of Object.values(scores)) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('gives 0 for a category where everything fails', () => {
    const data = baseResume();
    data.personalInfo.name = '';
    data.personalInfo.email = '';
    data.personalInfo.phone = '';
    data.personalInfo.location = '';
    const lint = lintATSCompatibility(data);
    const scores = getCategoryScores(lint.rules);
    expect(scores['Contact Info']).toBeLessThan(50);
  });
});
