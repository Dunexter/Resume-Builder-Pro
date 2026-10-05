import { describe, it, expect, vi, afterEach } from 'vitest';
import { heuristicParseResume, buildResumeDataFromParsed, importResumeFromText, MAX_AI_IMPORT_TEXT_LENGTH } from './resumeImport';

const SAMPLE_RESUME = `Jane Doe
jane.doe@email.com | (415) 555-2671
linkedin.com/in/janedoe | github.com/janedoe

SUMMARY
Senior software engineer with 8 years of experience building scalable web applications and leading engineering teams.

EXPERIENCE
Senior Software Engineer  TechCorp
Jan 2020 - Present
• Led a team of 5 engineers to launch a new platform
• Reduced latency by 40% through caching improvements

Software Engineer  StartUpCo
Jun 2017 - Dec 2019
• Built the core API used by 1M+ users

EDUCATION
University of Example, BS Computer Science
2013 - 2017

SKILLS
Languages: JavaScript, TypeScript, Python
Tools: Docker, Kubernetes, AWS
`;

describe('heuristicParseResume', () => {
  it.each(['-', '*', '\u2022', '\u2023', '\u25aa', '\u00b7', '\u25e6', '\u25cf', '\u25cb', '\u25a0', '\u25a1', '\u2013', '\u2014', '\uf0b7'])('preserves uploaded achievements with the %s bullet without storing duplicate markers', marker => {
    const parsed = heuristicParseResume(`Jane Doe\nEXPERIENCE\nEngineer | Acme\n2020-03 - Present\n${marker} Built reliable APIs\n${marker} Reduced latency by 40%`);
    const data = buildResumeDataFromParsed(parsed);
    expect(data.sections.experience).toHaveLength(1);
    expect(data.sections.experience[0].startDate).toBe('2020-03');
    expect(data.sections.experience[0].achievements).toEqual(['Built reliable APIs', 'Reduced latency by 40%']);
  });

  it('extracts contact info from the header', () => {
    const parsed = heuristicParseResume(SAMPLE_RESUME);
    expect(parsed.personalInfo?.name).toBe('Jane Doe');
    expect(parsed.personalInfo?.email).toBe('jane.doe@email.com');
    expect(parsed.personalInfo?.phone).toContain('415');
    expect(parsed.personalInfo?.linkedin).toContain('linkedin.com/in/janedoe');
    expect(parsed.personalInfo?.github).toContain('github.com/janedoe');
  });

  it('extracts the summary paragraph', () => {
    const parsed = heuristicParseResume(SAMPLE_RESUME);
    expect(parsed.personalInfo?.summary).toContain('Senior software engineer with 8 years');
  });

  it('splits experience into separate entries with dates and achievements', () => {
    const parsed = heuristicParseResume(SAMPLE_RESUME);
    const experience = parsed.sections?.experience || [];
    expect(experience).toHaveLength(2);
    expect(experience[0].position).toBe('Senior Software Engineer');
    expect(experience[0].company).toBe('TechCorp');
    expect(experience[0].startDate).toBe('2020-01');
    expect(experience[0].current).toBe(true);
    expect(experience[0].achievements).toEqual([
      'Led a team of 5 engineers to launch a new platform',
      'Reduced latency by 40% through caching improvements',
    ]);
    expect(experience[1].position).toBe('Software Engineer');
    expect(experience[1].company).toBe('StartUpCo');
    expect(experience[1].current).toBe(false);
    expect(experience[1].endDate).toBe('2019-12');
  });

  it('extracts education with institution and dates', () => {
    const parsed = heuristicParseResume(SAMPLE_RESUME);
    const education = parsed.sections?.education || [];
    expect(education).toHaveLength(1);
    expect(education[0].institution).toBe('University of Example');
    expect(education[0].startDate).toBe('2013-01');
    expect(education[0].endDate).toBe('2017-01');
  });

  it('extracts categorized skills', () => {
    const parsed = heuristicParseResume(SAMPLE_RESUME);
    const skills = parsed.sections?.skills || [];
    expect(skills).toHaveLength(2);
    expect(skills[0].category).toBe('Languages');
    expect(skills[0].skills).toContain('JavaScript');
    expect(skills[1].category).toBe('Tools');
  });
});

describe('buildResumeDataFromParsed', () => {
  it('assigns ids to every entry and preserves defaults for missing fields', () => {
    const parsed = heuristicParseResume(SAMPLE_RESUME);
    const data = buildResumeDataFromParsed(parsed);
    expect(data.sections.experience.every(e => !!e.id)).toBe(true);
    expect(data.sections.education.every(e => !!e.id)).toBe(true);
    expect(data.sections.skills.every(s => !!s.id)).toBe(true);
    expect(data.sectionOrder.length).toBeGreaterThan(0);
    expect(data.styling.template).toBe('professional');
  });

  it('marks the certifications section visible when certifications were found', () => {
    const data = buildResumeDataFromParsed({
      sections: { certifications: [{ id: '', name: 'AWS Certified', issuer: 'Amazon', date: '2022-01' }] } as never,
    });
    const certSection = data.sectionOrder.find(s => s.type === 'certifications');
    expect(certSection?.visible).toBe(true);
  });
});

describe('importResumeFromText', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses the heuristic parser when no AI provider is configured', async () => {
    const result = await importResumeFromText(SAMPLE_RESUME, { provider: 'none', apiKey: '' });
    expect(result.usedAI).toBe(false);
    expect(result.data.personalInfo.name).toBe('Jane Doe');
  });

  it('uses AI parsing when a provider and key are configured', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ personalInfo: { name: 'AI Parsed Name' }, sections: {} }) } }],
      }),
    }) as unknown as typeof fetch;

    const result = await importResumeFromText(SAMPLE_RESUME, { provider: 'openai', apiKey: 'sk-test' }, { useAI: true });
    expect(result.usedAI).toBe(true);
    expect(result.data.personalInfo.name).toBe('AI Parsed Name');
  });

  it('falls back to the heuristic parser and sets a warning when AI parsing fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;

    const result = await importResumeFromText(SAMPLE_RESUME, { provider: 'openai', apiKey: 'bad-key' }, { useAI: true });
    expect(result.usedAI).toBe(false);
    expect(result.warning).toBeTruthy();
    expect(result.data.personalInfo.name).toBe('Jane Doe');
  });

  it('throws when the file has no readable text', async () => {
    await expect(importResumeFromText('   ', { provider: 'none', apiKey: '' })).rejects.toThrow(/no readable text/i);
  });

  it('handles ISO dates, same-line headers, and nonbullet achievements', () => {
    const parsed = heuristicParseResume('Jane Doe\nEXPERIENCE\nEngineer | Acme | 2020-03 - 2022-08\nBuilt an API used by 100 people\nReduced costs by 30%\nLead | Example | 2022-09 - Present\nManaged five people');
    const jobs = parsed.sections!.experience;
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({ position: 'Engineer', company: 'Acme', startDate: '2020-03', endDate: '2022-08', achievements: ['Built an API used by 100 people', 'Reduced costs by 30%'] });
    expect(jobs[1]).toMatchObject({ position: 'Lead', current: true, achievements: ['Managed five people'] });
  });

  it('retains uncategorized skills alongside categories', () => {
    const parsed = heuristicParseResume('Jane\nSkills\nLanguages: TypeScript\nDocker');
    expect(parsed.sections!.skills.map(s => s.skills)).toEqual(['TypeScript', 'Docker']);
  });

  it('does not contact a configured AI provider by default', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const result = await importResumeFromText(SAMPLE_RESUME, { provider: 'openai', apiKey: 'key' });
    expect(result.usedAI).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects excessive AI input without sending a truncated request', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(importResumeFromText('x'.repeat(MAX_AI_IMPORT_TEXT_LENGTH + 1), { provider: 'openai', apiKey: 'key' }, { useAI: true })).rejects.toThrow(/nothing was sent or truncated/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([null, [], { personalInfo: { name: 42 } }, { sections: { experience: {} } }, { sections: { experience: [{ achievements: [123] }] } }, { sections: { experience: [{ current: 'false' }] } }, { sections: { education: [{ startDate: '2020-99' }] } }, { personalInfo: { website: 'javascript:alert(1)' } }])('rejects malformed candidate %j', value => {
    expect(() => buildResumeDataFromParsed(value)).toThrow();
  });

  it('falls back safely when AI returns invalid nested fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '{"sections":{"experience":[{"achievements":[42]}]}}' } }] }) }));
    const result = await importResumeFromText(SAMPLE_RESUME, { provider: 'openai', apiKey: 'key' }, { useAI: true });
    expect(result.usedAI).toBe(false);
    expect(result.warning).toMatch(/failed/i);
    expect(result.data.personalInfo.name).toBe('Jane Doe');
  });

  it('preserves unrecognized lines as hidden notes through rebuilding', async () => {
    const result = await importResumeFromText('Jane Doe\nVOLUNTEERING\nCommunity garden coordinator', { provider: 'none', apiKey: '' });
    expect(result.unmappedText).toContain('Community garden coordinator');
    const rebuilt = buildResumeDataFromParsed({ personalInfo: result.data.personalInfo, sections: result.data.sections });
    expect(rebuilt.sections.custom[0].entries[0].content).toContain('Community garden coordinator');
    expect(rebuilt.sectionOrder.find(s => s.id === rebuilt.sections.custom[0].id)?.visible).toBe(false);
  });
});
