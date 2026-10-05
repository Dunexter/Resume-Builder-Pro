import { describe, it, expect } from 'vitest';
import { formatValidationMessage, getResumeCompletion, validateResumeForExport } from './validationUtils';
import { resumeHasKeyword, expandKeyword } from './skillSynonyms';
import { ResumeData } from '../types/resume';

const empty = (): ResumeData => ({
  personalInfo: { name: '', email: '', phone: '', location: '' },
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
    colors: { primary: '#000', secondary: '#333', accent: '#666' },
  },
});

describe('validateResumeForExport', () => {
  it('errors on missing name and email', () => {
    const issues = validateResumeForExport(empty());
    expect(issues.some(i => i.field === 'name' && i.level === 'error')).toBe(true);
    expect(issues.some(i => i.field === 'email' && i.level === 'error')).toBe(true);
  });

  it('accepts valid contact basics with student education and no work experience', () => {
    const d = empty();
    d.personalInfo = { name: 'A B', email: 'a@b.com', phone: '555', location: 'X' };
    d.sections.education = [{ id: 'edu', institution: 'Community College', degree: 'Associate', field: '', startDate: '2025-09', endDate: '2027-06' }];
    const issues = validateResumeForExport(d);
    expect(issues.filter(i => i.level === 'error')).toHaveLength(0);
  });

  it.each(['a..b@example.com', '.a@example.com', 'a.@example.com', 'a@-example.com', 'a@example..com', 'a@exam_ple.com', 'a@example.com extra'])('rejects malformed email %s', email => {
    const data = empty();
    data.personalInfo.email = email;
    expect(validateResumeForExport(data)).toContainEqual(expect.objectContaining({ field: 'email', level: 'error' }));
  });

  it.each([' student+jobs@sub.example.edu ', "o'connor@example.com", 'first.last@example.co.uk'])('accepts email %s', email => {
    const data = empty();
    data.personalInfo.email = email;
    expect(validateResumeForExport(data).some(issue => issue.field === 'email')).toBe(false);
  });

  it.each(['github.com/student', 'https://example.com/a?b=c#work', 'http://portfolio.example.org', 'https://m\u00fcnchen.de'])('accepts web URL %s', website => {
    const data = empty();
    data.personalInfo.website = website;
    expect(validateResumeForExport(data).some(issue => issue.field === 'website')).toBe(false);
  });

  it.each(['javascript:alert(1)', 'data:text/html,test', 'not a url', 'https://', 'ftp://example.com', 'https://user:pass@example.com', 'https://example..com'])('warns on invalid URL %s', url => {
    const data = empty();
    data.personalInfo.github = url;
    data.personalInfo.linkedin = url;
    data.personalInfo.website = url;
    data.sections.projects = [{ id: 'p', title: 'Course project', description: 'Built a prototype', year: '', url }];
    const issues = validateResumeForExport(data);
    for (const field of ['github', 'linkedin', 'website', 'projects-url']) {
      expect(issues).toContainEqual(expect.objectContaining({ field, level: 'warn' }));
    }
  });

  it('does not count blank entries, punctuation, category headings, or hidden sections as substantive', () => {
    const data = empty();
    data.sections.experience = [{ id: 'e', company: '', position: '', location: '', startDate: '', endDate: '', current: false, achievements: [' ', '...'] }];
    data.sections.projects = [{ id: 'p', title: ' ', description: '\n', year: '' }];
    data.sections.skills = [{ id: 's', category: 'Programming', skills: ', ; ' }];
    expect(getResumeCompletion(data)).toMatchObject({ experience: false, projects: false, skills: false, substantive: false });
    expect(validateResumeForExport(data)).toContainEqual(expect.objectContaining({ field: 'content', level: 'error', message: expect.stringContaining('Work experience is not required') }));
    data.sections.skills[0].skills = 'Python';
    data.sectionOrder = [{ id: 'skills', type: 'skills', name: 'Skills', visible: false }];
    expect(getResumeCompletion(data).substantive).toBe(false);
  });

  it('accepts a student project and real skills without requiring metrics or paid experience', () => {
    const data = empty();
    data.personalInfo = { name: 'Student', email: 'student@example.edu', phone: '', location: '' };
    data.sections.projects = [{ id: 'p', title: 'Class website', description: 'Created a course directory.', year: '' }];
    data.sections.skills = [{ id: 's', category: '', skills: 'HTML, CSS' }];
    expect(getResumeCompletion(data)).toMatchObject({ contact: true, projects: true, experience: false, skills: true, substantive: true });
    expect(validateResumeForExport(data).filter(issue => issue.level === 'error' || issue.field === 'experience')).toEqual([]);
  });

  it('warns on reversed experience, education, and certification dates', () => {
    const data = empty();
    data.sections.experience = [{ id: 'e', company: 'Org', position: 'Volunteer', location: '', startDate: '2025-10', endDate: '2025-02', current: false, achievements: ['Helped visitors'] }];
    data.sections.education = [{ id: 'edu', institution: 'College', degree: 'BA', field: '', startDate: '2025', endDate: '2024' }];
    data.sections.certifications = [{ id: 'c', name: 'Certificate', issuer: '', date: '2025-05-03', expiryDate: '2025-05-02' }];
    expect(validateResumeForExport(data).filter(issue => issue.field.endsWith('-dates')).map(issue => issue.field)).toEqual(['experience-dates', 'education-dates', 'certifications-dates']);
    data.sections.experience[0].current = true;
    data.sections.education[0].endDate = '2027-06';
    data.sections.certifications[0].expiryDate = '2025-05';
    expect(validateResumeForExport(data).filter(issue => issue.field.endsWith('-dates'))).toEqual([]);
  });

  it('does not guess date order for ambiguous imported text or invalid dates', () => {
    const data = empty();
    data.sections.education = [{ id: 'edu', institution: 'College', degree: 'BA', field: '', startDate: 'September 2025', endDate: 'Expected 2027' }];
    data.sections.certifications = [{ id: 'c', name: 'Certificate', issuer: '', date: '2025-13', expiryDate: '2025-02-30' }];
    expect(validateResumeForExport(data).filter(issue => issue.field.endsWith('-dates'))).toEqual([]);
  });

  it('formats actionable errors and warnings and returns no message when there are no issues', () => {
    expect(formatValidationMessage([])).toBe('');
    const message = formatValidationMessage(validateResumeForExport(empty()));
    expect(message).toContain('Please fix before export:');
    expect(message).toContain('Resume body is empty');
    expect(message).toContain('Also note:');
  });
});

describe('skill synonyms', () => {
  it('expands k8s to kubernetes', () => {
    expect(expandKeyword('k8s').some(x => x.includes('kubernetes'))).toBe(true);
  });

  it('matches synonym in resume text', () => {
    expect(resumeHasKeyword('experience with kubernetes and docker', 'k8s')).toBe(true);
    expect(resumeHasKeyword('uses react daily', 'reactjs')).toBe(true);
  });
});
