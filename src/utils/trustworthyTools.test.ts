import { afterEach, describe, expect, it, vi } from 'vitest';
import { blankResumeData } from '../data/sampleResume';
import { ExperienceEntry } from '../types/resume';
import { checkContentQuality, checkRawContentQuality, extractKeywords, generateSummaryWithAI, getExperienceDurationMonths, getResumeText, lintATSCompatibility, lintRawResumeText, matchJobDescription, rewriteBulletWithAI } from './atsUtils';
import { matchJobDescriptionWithSynonyms } from './jdMatch';
import { analyzeBullet, quickFixBullet } from './bulletCoach';

const blank = () => structuredClone(blankResumeData);
const experience = (startDate = '2020-01', endDate = '2022-01'): ExperienceEntry => ({
  id: 'e', position: 'Developer', company: 'Acme', location: '', startDate, endDate, current: false, achievements: [],
});
afterEach(() => vi.unstubAllGlobals());

describe('honest keyword matching', () => {
  for (const match of [matchJobDescription, matchJobDescriptionWithSynonyms]) {
    it(`${match.name} uses the complete denominator and exposes every term`, () => {
      const data = blank();
      const words = Array.from({ length: 100 }, (_, i) => `skill${String.fromCharCode(97 + Math.floor(i / 26))}${String.fromCharCode(97 + i % 26)}`);
      data.personalInfo.summary = words.slice(0, 85).join(' and ');
      const jd = words.join(' and ');
      const result = match(data, jd);
      expect(extractKeywords(jd)).toHaveLength(100);
      expect(result.score).toBe(85);
      expect(result.matchedKeywords).toHaveLength(85);
      expect(result.missingKeywords).toHaveLength(15);
    });

    it(`${match.name} includes visible custom/certification fields, excludes hidden skills and metadata`, () => {
      const data = blank();
      data.sections.skills = [{ id: 'React', category: 'Languages', skills: 'Python' }];
      data.sectionOrder.find(s => s.type === 'skills')!.visible = false;
      data.sections.certifications = [{ id: 'c', name: 'Kubernetes', issuer: 'Foundation', date: '', credentialId: 'CredentialUnique' }];
      data.sectionOrder.find(s => s.type === 'certifications')!.visible = true;
      data.sections.custom = [{ id: 'custom', name: 'Volunteering', entries: [{ id: 'e', title: 'Terraform', content: 'Community mentoring' }] }];
      data.sectionOrder.push({ id: 'custom', type: 'custom', name: 'Volunteering', visible: true });
      const result = match(data, 'Python and React and Kubernetes and Terraform and CredentialUnique');
      expect(result.matchedKeywords).toEqual(expect.arrayContaining(['kubernetes', 'terraform', 'credentialunique']));
      expect(result.missingKeywords).toEqual(expect.arrayContaining(['python', 'react']));
      data.sectionOrder.find(s => s.id === 'custom')!.visible = false;
      expect(getResumeText(data)).not.toContain('Terraform');
    });

    it(`${match.name} avoids substring matches and handles punctuation skills`, () => {
      const data = blank();
      data.personalInfo.summary = 'Django and JavaScript and C++ and C#';
      const result = match(data, 'Go and Java and C++ and C#');
      expect(result.missingKeywords).toEqual(expect.arrayContaining(['go', 'java']));
      expect(result.matchedKeywords).toEqual(expect.arrayContaining(['c++', 'c#']));
    });
  }
  it('expands bounded synonyms', () => {
    const data = blank();
    data.personalInfo.summary = 'k8s, postgres';
    expect(matchJobDescriptionWithSynonyms(data, 'Kubernetes and PostgreSQL').score).toBe(100);
  });
});

describe('substantive ATS checks', () => {
  it('does not count blank editor rows or whitespace contact fields', () => {
    const data = blank();
    data.personalInfo.name = '   ';
    data.personalInfo.summary = ' '.repeat(100);
    data.sections.experience = [{ ...experience(), company: ' ', position: ' ', achievements: [' '] }];
    data.sections.education = [{ id: 'e', institution: '', degree: '', field: '', startDate: '', endDate: '' }];
    data.sections.skills = [{ id: 's', category: 'Python', skills: ', , ,' }];
    const rules = lintATSCompatibility(data).rules;
    for (const id of ['contact-name', 'has-experience', 'skills-count']) expect(rules.find(r => r.id === id)?.status).toBe('fail');
    expect(rules.find(r => r.id === 'has-education')?.status).toBe('warn');
    expect(rules.find(r => r.id === 'has-summary')?.status).toBe('warn');
    expect(checkContentQuality(data)).toEqual({ issues: [], score: 0, analyzedCount: 0 });
  });

  it('accepts the default awards heading and warns about nonstandard custom headings', () => {
    const data = blank();
    data.sections.awards = [{ id: 'a', title: 'Award', description: '' }];
    expect(lintATSCompatibility(data).rules.find(r => r.id === 'section-headings')?.status).toBe('pass');
    data.sections.custom = [{ id: 'c', name: 'Custom magic', entries: [{ id: 'e', title: 'Item', content: 'Content' }] }];
    data.sectionOrder.push({ id: 'c', name: 'Custom magic', type: 'custom', visible: true });
    expect(lintATSCompatibility(data).rules.find(r => r.id === 'section-headings')?.status).toBe('warn');
  });

  it('counts distinct nonempty skills and ignores hidden experience', () => {
    const data = blank();
    data.sections.skills = [{ id: 's', category: '', skills: 'React, react, , Python' }];
    data.sections.experience = [experience()];
    data.sectionOrder.find(s => s.type === 'experience')!.visible = false;
    const rules = lintATSCompatibility(data).rules;
    expect(rules.find(r => r.id === 'skills-count')?.detail).toMatch(/^2 skills/);
    expect(rules.find(r => r.id === 'has-experience')?.status).toBe('fail');
  });

  it('reports multiple issues per passage without substring filler false positives', () => {
    const data = blank();
    data.sections.projects = [{ id: 'p', title: 'Project', year: '', description: 'helped with various deployment tasks across the organization' }];
    const quality = checkContentQuality(data);
    expect(quality.analyzedCount).toBe(1);
    expect(quality.issues.map(i => i.type)).toEqual(expect.arrayContaining(['weak_verb', 'no_metric', 'filler_word']));
    expect(analyzeBullet('Built delivery pipeline for 100 users').some(i => i.type === 'filler_word')).toBe(false);
  });

  it('analyzes uploaded bullets outside Experience and stops section leakage', () => {
    const quality = checkRawContentQuality('Projects\n- helped with various deployment tasks across the organization');
    expect(quality.analyzedCount).toBe(1);
    expect(quality.issues.length).toBeGreaterThan(1);
    const lint = lintRawResumeText('Experience\nProjects\n- Built application for 20 users');
    expect(lint.rules.find(r => r.id === 'raw-experience-section')?.status).toBe('fail');
    expect(checkRawContentQuality('')).toEqual({ issues: [], score: 0, analyzedCount: 0 });
  });
});

describe('truthful writing helpers', () => {
  it('merges overlapping dates, counts gaps separately, and handles current jobs', () => {
    const data = blank();
    data.sections.experience = [experience('2020-01', '2022-01'), experience('2021-01', '2023-01'), experience('2024-01', '2024-07')];
    expect(getExperienceDurationMonths(data, new Date(2025, 0, 1))).toBe(42);
    data.sections.experience = [{ ...experience('2024-01', ''), current: true }];
    expect(getExperienceDurationMonths(data, new Date(2025, 0, 1))).toBe(12);
  });

  it.each([['', '2022-01'], ['2020-13', '2022-01'], ['2023-01', '2022-01'], ['2020-01', '2099-01'], ['2020', '2022']])('omits duration for ambiguous or invalid dates %s / %s', (start, end) => {
    const data = blank();
    data.sections.experience = [experience(start, end)];
    expect(getExperienceDurationMonths(data, new Date(2025, 0, 1))).toBeNull();
  });

  it('does not invent a profession, expertise, or achievements for an empty profile', async () => {
    expect(await generateSummaryWithAI(blank(), { provider: 'none', apiKey: '' })).toBe('');
    const data = blank();
    data.sections.experience = [experience('2020-01', '2022-01'), experience('2021-01', '2023-01')];
    const summary = await generateSummaryWithAI(data, { provider: 'none', apiKey: '' });
    expect(summary).toContain('3 years');
    expect(summary).not.toMatch(/expertise|proven|results-driven|scalable|4\+/i);
  });

  it.each(['helped lead a migration', 'Assisted with some testing', 'Did not own the release', 'C++ library development', ''])('local cleanup preserves meaning deterministically: %s', async bullet => {
    expect(quickFixBullet(`  ${bullet}  `)).toBe(bullet);
    expect(await rewriteBulletWithAI(bullet, { company: '', position: '' }, { provider: 'none', apiKey: '' })).toBe(bullet);
    expect(quickFixBullet(bullet)).toBe(quickFixBullet(bullet));
  });

  it('surfaces configured provider failures instead of returning local fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const settings = { provider: 'openai', apiKey: 'test' };
    await expect(rewriteBulletWithAI('Assisted with testing', { position: '', company: '' }, settings)).rejects.toMatchObject({ code: 'network' });
    await expect(generateSummaryWithAI(blank(), settings)).rejects.toMatchObject({ code: 'network' });
    await expect(generateSummaryWithAI(blank(), { provider: 'openai', apiKey: '' })).rejects.toMatchObject({ code: 'no_key' });
  });
});
