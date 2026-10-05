import { ResumeData } from '../../../types/resume';

export function fullResume(): ResumeData {
  return {
    personalInfo: { name: 'Test Person', email: 'person@example.com', phone: '5550100', location: 'Home City', github: 'github.com/person', linkedin: 'linkedin.com/person', website: 'https://personal.example.com', summary: 'Unique summary' },
    sections: {
      education: [{ id: 'edu', institution: 'University', degree: 'Bachelor', field: 'Computing', startDate: '2010-02', endDate: '2014-06', gpa: '3.91', coursework: 'Distributed Systems', honors: 'Summa Cum Laude' }],
      experience: [{ id: 'exp', company: 'Employer', position: 'Developer', location: 'Work City', startDate: '2015-01', endDate: '', current: true, achievements: ['Delivered product'], technologies: 'TypeScript' }],
      skills: [{ id: 'skill', category: '', skills: 'UncategorizedSkill' }, { id: 'skill2', category: 'Languages', skills: 'Rust' }],
      projects: [{ id: 'proj', title: 'Project Name', year: '2022', description: 'Project description', technologies: 'Postgres', url: 'https://project.example.com' }],
      awards: [{ id: 'award', title: 'Award Title', issuer: 'Award Issuer', date: '2023', description: 'Award description' }],
      certifications: [{ id: 'cert', name: 'Certificate Name', issuer: 'Cert Issuer', date: '2024', expiryDate: '2028', credentialId: 'CREDENTIAL123' }],
      custom: [{ id: 'custom', name: 'Volunteering', entries: [{ id: 'entry', title: 'Volunteer Title', content: 'Volunteer content' }] }],
    },
    sectionOrder: [
      { id: 'education', type: 'education', name: 'Education', visible: true },
      { id: 'experience', type: 'experience', name: 'Experience', visible: true },
      { id: 'skills', type: 'skills', name: 'Skills', visible: true },
      { id: 'projects', type: 'projects', name: 'Projects', visible: true },
      { id: 'awards', type: 'awards', name: 'Awards', visible: true },
      { id: 'certifications', type: 'certifications', name: 'Certifications', visible: true },
      { id: 'custom', type: 'custom', name: 'Volunteering', visible: true },
    ],
    styling: { template: 'professional', fontFamily: 'Arial', fontSize: 11, spacing: 1.2, colors: { primary: '#123456', secondary: '#234567', accent: '#345678' } },
  };
}

export const fieldValues = [
  'Test Person', 'person@example.com', '5550100', 'Home City', 'github.com/person', 'linkedin.com/person',
  'https://personal.example.com', 'Unique summary', 'University', 'Bachelor', 'Computing', '3.91',
  'Distributed Systems', 'Summa Cum Laude', 'Employer', 'Developer', 'Work City', 'Present',
  'Delivered product', 'TypeScript', 'UncategorizedSkill', 'Languages', 'Rust', 'Project Name', '2022',
  'Project description', 'Postgres', 'https://project.example.com', 'Award Title', 'Award Issuer', '2023',
  'Award description', 'Certificate Name', 'Cert Issuer', '2024', '2028', 'CREDENTIAL123', 'Volunteer Title', 'Volunteer content',
];
