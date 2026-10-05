import { describe, expect, it } from 'vitest';
import { blankResumeData, sampleResumeData } from '../data/sampleResume';
import { ResumeData } from '../types/resume';
import { validateAppSettings, validateCoverLetter, validateResumeData, validateResumeRecord } from './resumeSchema';

describe('resume runtime schema', () => {
  it('accepts shipped persisted shapes and absent optional fields', () => {
    validateResumeData(blankResumeData);
    validateResumeData(sampleResumeData);
    const data = structuredClone(sampleResumeData);
    data.personalInfo = { name: '', email: '', phone: '', location: '' };
    validateResumeData(data);
    validateResumeRecord({ id: 'resume', name: '', createdAt: '2026-01-01', updatedAt: '2026-01-01', data, versions: [] });
    validateAppSettings({ ai: { provider: 'none', apiKey: '' }, darkMode: false, autoSave: true });
  });

  it.each([
    ['nested optional string', (data: ResumeData) => { Object.assign(data.personalInfo, { github: 42 }); }],
    ['missing required field', (data: ResumeData) => { Reflect.deleteProperty(data.personalInfo, 'name'); }],
    ['unknown field', (data: ResumeData) => { Object.assign(data.personalInfo, { extra: true }); }],
    ['duplicate entry IDs', (data: ResumeData) => { data.sections.skills.push(data.sections.skills[0]); }],
    ['empty entry ID', (data: ResumeData) => { data.sections.skills[0].id = ' '; }],
    ['invalid achievement', (data: ResumeData) => { Object.assign(data.sections.experience[0], { achievements: [3] }); }],
    ['invalid current flag', (data: ResumeData) => { Object.assign(data.sections.experience[0], { current: 'yes' }); }],
    ['missing array', (data: ResumeData) => { Reflect.deleteProperty(data.sections, 'certifications'); }],
    ['dangling custom reference', (data: ResumeData) => { data.sectionOrder.push({ id: 'missing', type: 'custom', visible: true, name: '' }); }],
    ['incorrect built-in reference', (data: ResumeData) => { data.sectionOrder[0].id = 'missing'; }],
    ['duplicate order IDs', (data: ResumeData) => { data.sectionOrder.push(data.sectionOrder[0]); }],
    ['invalid order visibility', (data: ResumeData) => { Object.assign(data.sectionOrder[0], { visible: 1 }); }],
    ['unknown template', (data: ResumeData) => { Object.assign(data.styling, { template: 'unknown' }); }],
    ['NaN font', (data: ResumeData) => { data.styling.fontSize = NaN; }],
    ['infinite spacing', (data: ResumeData) => { data.styling.spacing = Infinity; }],
    ['negative spacing', (data: ResumeData) => { data.styling.spacing = -1; }],
    ['huge font', (data: ResumeData) => { data.styling.fontSize = 10000; }],
    ['invalid color', (data: ResumeData) => { data.styling.colors.primary = 'url(x)'; }],
    ['oversized array', (data: ResumeData) => { data.sections.skills = Array.from({ length: 1001 }, (_, i) => ({ id: `${i}`, category: '', skills: '' })); }],
  ])('rejects %s', (_, mutate) => {
    const data = structuredClone(sampleResumeData);
    mutate(data);
    expect(() => validateResumeData(data)).toThrow();
  });

  it('validates custom entries, optional fields, and version snapshots recursively', () => {
    const data = structuredClone(blankResumeData);
    data.sections.custom = [{ id: 'custom-id', name: '', entries: [{ id: 'entry', title: '', content: '' }] }];
    data.sectionOrder.push({ id: 'custom-id', type: 'custom', name: '', visible: false });
    validateResumeData(data);
    const record = { id: 'r', name: '', createdAt: '2026-01-01', updatedAt: '2026-01-01', data, versions: [
      { id: 'v', label: '', createdAt: '2026-01-01', data: structuredClone(data) },
    ] };
    validateResumeRecord(record);
    Object.assign(record.versions[0].data.sections.custom[0].entries[0], { content: null });
    expect(() => validateResumeRecord(record)).toThrow();
    Object.assign(data.sections.custom[0].entries[0], { title: false });
    expect(() => validateResumeData(data)).toThrow();
  });

  it.each(['gpa', 'coursework', 'honors'])('checks education optional %s', key => {
    const data = structuredClone(sampleResumeData);
    Object.assign(data.sections.education[0], { [key]: 42 });
    expect(() => validateResumeData(data)).toThrow();
  });

  it('checks certification, award and project optional fields', () => {
    const data = structuredClone(blankResumeData);
    data.sections.certifications.push({ id: 'cert', name: '', issuer: '', date: '' });
    validateResumeData(data);
    Object.assign(data.sections.certifications[0], { expiryDate: null });
    expect(() => validateResumeData(data)).toThrow();
    const sample = structuredClone(sampleResumeData);
    Object.assign(sample.sections.projects[0], { url: {} });
    expect(() => validateResumeData(sample)).toThrow();
    const awards = structuredClone(sampleResumeData);
    Object.assign(awards.sections.awards[0], { issuer: false });
    expect(() => validateResumeData(awards)).toThrow();
  });

  it('checks dates, scores and duplicate version IDs', () => {
    const record = { id: 'r', name: '', createdAt: '2026-01-01', updatedAt: '2026-01-01', data: blankResumeData, versions: [] };
    for (const updatedAt of ['yesterday', '2026-02-30', '2026-13-01', '']) {
      expect(() => validateResumeRecord({ ...record, updatedAt })).toThrow();
    }
    for (const jdMatchScore of [-1, 101, Infinity, '50']) {
      expect(() => validateResumeRecord({ ...record, jdMatchScore })).toThrow();
    }
    const version = { id: 'v', label: '', createdAt: record.createdAt, data: blankResumeData };
    expect(() => validateResumeRecord({ ...record, versions: [version, version] })).toThrow('duplicate');
  });

  it('accepts long encoded draft IDs and rejects mismatched resume references', () => {
    const letter = { id: JSON.stringify(['cover-letter', 'r', 'job'.repeat(1000)]), resumeId: 'r', companyName: '', jobTitle: '', content: '', createdAt: '2026-01-01', updatedAt: '2026-01-01' };
    validateCoverLetter(letter);
    expect(() => validateCoverLetter({ ...letter, resumeId: 'other' })).toThrow('reference');
  });
});
