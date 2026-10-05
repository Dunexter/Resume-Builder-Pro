import React from 'react';
import { ResumeData } from '../../../types/resume';
import { fmtDate } from '../shared/fmtDate';
import { EducationDetails, CertificationDetails } from '../shared/EntryDetails';

const CompactTemplate: React.FC<{ data: ResumeData }> = ({ data }) => {
  const { personalInfo, sections, sectionOrder, styling } = data;
  const pc = styling.colors.primary;
  const sc = styling.colors.secondary;
  const font = styling.fontFamily;
  const fs = Math.max(styling.fontSize - 1, 9);

  const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h2 style={{ fontSize: `${fs * 1.05}pt`, fontWeight: 700, color: '#fff', backgroundColor: pc, padding: '2px 8px', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
      {children}
    </h2>
  );

  const mainSections = ['experience', 'education', 'projects'];
  const sideSections = ['skills', 'awards', 'certifications', 'custom'];

  return (
    <div style={{ fontFamily: font, fontSize: `${fs}pt`, lineHeight: styling.spacing, color: '#111' }}>
      <div style={{ backgroundColor: pc, padding: '12px 16px', marginBottom: 0 }}>
        <h1 style={{ color: '#fff', fontSize: `${fs * 2.2}pt`, fontWeight: 800, margin: '0 0 4px' }}>
          {personalInfo.name || 'Your Name'}
        </h1>
        <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: `${fs * 0.88}pt`, display: 'flex', flexWrap: 'wrap', gap: '2px 12px' }}>
          {[personalInfo.email, personalInfo.phone, personalInfo.location, personalInfo.linkedin, personalInfo.github, personalInfo.website].filter(Boolean).join('  |  ')}
        </div>
      </div>

      {personalInfo.summary && (
        <div style={{ padding: '8px 16px', backgroundColor: `${pc}12`, borderBottom: `1px solid ${pc}30`, fontSize: `${fs * 0.9}pt`, color: '#333' }}>
          {personalInfo.summary}
        </div>
      )}

      <div style={{ display: 'flex', gap: 0 }}>
        <div style={{ flex: '0 0 65%', padding: '10px 12px 10px 16px', borderRight: `1px solid ${pc}30` }}>
          {sectionOrder.filter(s => s.visible && mainSections.includes(s.type)).map(section => {
            switch (section.type) {
              case 'experience':
                return sections.experience.length === 0 ? null : (
                  <div key={section.id} style={{ marginBottom: 10 }}>
                    <SectionTitle>{section.name}</SectionTitle>
                    {sections.experience.map(exp => (
                      <div key={exp.id} data-pdf-row style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div>
                            <span style={{ fontWeight: 700, color: pc }}>{exp.position}</span>
                            <span style={{ color: sc }}> · {exp.company}</span>
                            {exp.location && <div style={{ fontSize: '0.9em', color: sc }}>{exp.location}</div>}
                          </div>
                          <span style={{ fontSize: `${fs * 0.82}pt`, color: '#777', flexShrink: 0 }}>
                            {fmtDate(exp.startDate)} – {exp.current ? 'Present' : fmtDate(exp.endDate)}
                          </span>
                        </div>
                        <ul style={{ margin: '2px 0 0 12px', padding: 0 }}>
                          {exp.achievements.filter(a => a.trim()).map((a, i) => <li key={i} style={{ marginBottom: 1 }}>{a}</li>)}
                        </ul>
                        {exp.technologies && <div style={{ fontSize: `${fs * 0.82}pt`, color: '#666', marginTop: 2 }}>{exp.technologies}</div>}
                      </div>
                    ))}
                  </div>
                );
              case 'education':
                return sections.education.length === 0 ? null : (
                  <div key={section.id} style={{ marginBottom: 10 }}>
                    <SectionTitle>{section.name}</SectionTitle>
                    {sections.education.map(edu => (
                      <div key={edu.id} data-pdf-row style={{ marginBottom: 5 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 700, color: pc }}>{edu.institution}</span>
                          <span style={{ fontSize: `${fs * 0.82}pt`, color: '#777' }}>{fmtDate(edu.startDate)} – {fmtDate(edu.endDate)}</span>
                        </div>
                        <div style={{ color: sc }}>{edu.degree} in {edu.field}{edu.gpa ? ` · ${edu.gpa}` : ''}</div>
                        <EducationDetails entry={edu} coursework />
                      </div>
                    ))}
                  </div>
                );
              case 'projects':
                return sections.projects.length === 0 ? null : (
                  <div key={section.id} style={{ marginBottom: 10 }}>
                    <SectionTitle>{section.name}</SectionTitle>
                    {sections.projects.map(proj => (
                      <div key={proj.id} data-pdf-row style={{ marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 700, color: pc }}>{proj.title}</span>
                          {proj.year && <span style={{ fontSize: `${fs * 0.82}pt`, color: '#777' }}>{proj.year}</span>}
                        </div>
                        {proj.description && <div style={{ fontSize: `${fs * 0.88}pt` }}>{proj.description}</div>}
                        {proj.technologies && <div style={{ fontSize: `${fs * 0.82}pt`, color: '#666' }}>{proj.technologies}</div>}
                        {proj.url && <div style={{ fontSize: `${fs * 0.82}pt`, color: sc }}>{proj.url}</div>}
                      </div>
                    ))}
                  </div>
                );
              default: return null;
            }
          })}
        </div>

        <div style={{ flex: '0 0 35%', padding: '10px 16px 10px 12px', backgroundColor: `${pc}06` }}>
          {sectionOrder.filter(s => s.visible && sideSections.includes(s.type)).map(section => {
            switch (section.type) {
              case 'skills':
                return sections.skills.length === 0 ? null : (
                  <div key={section.id} style={{ marginBottom: 10 }}>
                    <SectionTitle>{section.name}</SectionTitle>
                    {sections.skills.map(s => (
                      <div key={s.id} data-pdf-row style={{ marginBottom: 4 }}>
                        <div style={{ fontWeight: 700, color: pc, fontSize: `${fs * 0.9}pt` }}>{s.category}</div>
                        <div style={{ color: '#333', fontSize: `${fs * 0.88}pt` }}>{s.skills}</div>
                      </div>
                    ))}
                  </div>
                );
              case 'awards':
                return sections.awards.length === 0 ? null : (
                  <div key={section.id} style={{ marginBottom: 10 }}>
                    <SectionTitle>{section.name}</SectionTitle>
                    {sections.awards.map(aw => (
                      <div key={aw.id} data-pdf-row style={{ marginBottom: 4 }}>
                        <div style={{ fontWeight: 600, fontSize: `${fs * 0.9}pt`, color: pc }}>{aw.title}</div>
                        {aw.issuer && <div style={{ fontSize: `${fs * 0.82}pt`, color: sc }}>{aw.issuer}</div>}
                        {aw.date && <div style={{ fontSize: `${fs * 0.82}pt`, color: sc }}>{aw.date}</div>}
                        {aw.description && <div style={{ fontSize: `${fs * 0.85}pt` }}>{aw.description}</div>}
                      </div>
                    ))}
                  </div>
                );
              case 'certifications':
                return sections.certifications.length === 0 ? null : (
                  <div key={section.id} style={{ marginBottom: 10 }}>
                    <SectionTitle>{section.name}</SectionTitle>
                    {sections.certifications.map(cert => (
                      <div key={cert.id} data-pdf-row style={{ marginBottom: 4 }}>
                        <div style={{ fontWeight: 600, fontSize: `${fs * 0.88}pt` }}>{cert.name}</div>
                        <div style={{ fontSize: `${fs * 0.82}pt`, color: sc }}>{[cert.issuer, cert.date].filter(Boolean).join(' · ')}</div>
                        <CertificationDetails entry={cert} />
                      </div>
                    ))}
                  </div>
                );
              case 'custom': {
                const cs = sections.custom.find(c => c.id === section.id);
                return cs && cs.entries.length > 0 ? (
                  <div key={section.id} style={{ marginBottom: 10 }}>
                    <SectionTitle>{cs.name}</SectionTitle>
                    {cs.entries.map(e => (
                      <div key={e.id} data-pdf-row style={{ marginBottom: 4 }}>
                        {e.title && <div style={{ fontWeight: 600, fontSize: `${fs * 0.9}pt` }}>{e.title}</div>}
                        {e.content && <div style={{ fontSize: `${fs * 0.88}pt` }}>{e.content}</div>}
                      </div>
                    ))}
                  </div>
                ) : null;
              }
              default: return null;
            }
          })}
        </div>
      </div>
    </div>
  );
};

export default CompactTemplate;
