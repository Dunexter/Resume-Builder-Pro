import { describe, it, expect } from 'vitest';
import { lintRawResumeText, checkRawContentQuality } from './atsUtils';

const SAMPLE_RESUME_TEXT = `Jane Doe
jane.doe@example.com | (555) 123-4567 | Austin, TX

Summary
Experienced software engineer with 5 years building cloud-native web applications and leading small teams.

Experience
Senior Software Engineer, Acme Corp
- Reduced API latency by 40% by redesigning the caching layer.
- Led a team of 4 engineers to deliver a new billing platform, increasing revenue by $2M annually.
- helped with various other tasks as needed.

Education
State University
B.S. Computer Science, 2019

Skills
TypeScript, React, Node.js, AWS, Docker, PostgreSQL, GraphQL, Kubernetes
`;

describe('lintRawResumeText', () => {
  it('scores a well-structured resume highly', () => {
    const result = lintRawResumeText(SAMPLE_RESUME_TEXT);
    expect(result.score).toBeGreaterThan(60);
    expect(result.rules.length).toBeGreaterThan(5);
  });

  it('detects contact info', () => {
    const result = lintRawResumeText(SAMPLE_RESUME_TEXT);
    const email = result.rules.find(r => r.id === 'raw-email');
    const phone = result.rules.find(r => r.id === 'raw-phone');
    expect(email?.status).toBe('pass');
    expect(phone?.status).toBe('pass');
  });

  it('detects standard sections', () => {
    const result = lintRawResumeText(SAMPLE_RESUME_TEXT);
    expect(result.rules.find(r => r.id === 'raw-experience-section')?.status).toBe('pass');
    expect(result.rules.find(r => r.id === 'raw-education-section')?.status).toBe('pass');
    expect(result.rules.find(r => r.id === 'raw-skills-section')?.status).toBe('pass');
  });

  it('fails when almost no text is extracted (e.g. scanned PDF)', () => {
    const result = lintRawResumeText('   ');
    const extractable = result.rules.find(r => r.id === 'raw-extractable');
    expect(extractable?.status).toBe('fail');
    expect(result.score).toBeLessThan(50);
  });

  it('flags missing email', () => {
    const noEmail = SAMPLE_RESUME_TEXT.replace('jane.doe@example.com', '');
    const result = lintRawResumeText(noEmail);
    expect(result.rules.find(r => r.id === 'raw-email')?.status).toBe('fail');
  });
});

describe('checkRawContentQuality', () => {
  it('flags weak verbs in bullet points', () => {
    const result = checkRawContentQuality(SAMPLE_RESUME_TEXT);
    expect(result.issues.some(i => i.type === 'weak_verb')).toBe(true);
  });

  it('returns no issues for text with no experience bullets', () => {
    const result = checkRawContentQuality('Summary\nJust a summary, no experience section.');
    expect(result.issues).toEqual([]);
  });
});
