import React from 'react';
import { ResumeData } from '../../../types/resume';
import { fmtDate } from '../shared/fmtDate';
import { EducationDetails, CertificationDetails } from '../shared/EntryDetails';

const ModernTemplate: React.FC<{ data: ResumeData }> = ({ data }) => {
  const { personalInfo, sections, sectionOrder, styling } = data;
  const pc = styling.colors.primary;
  const sc = styling.colors.secondary;
  const ac = styling.colors.accent || pc;
  const font = styling.fontFamily;
  const fs = styling.fontSize;

  const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <div style={{ width: 4, height: 18, backgroundColor: ac, borderRadius: 2 }} />
      <h2 style={{ margin: 0, fontSize: `${fs * 1.05}pt`, fontWeight: 700, color: pc, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {children}
      </h2>
    </div>
  );

  return (
    <div style={{ fontFamily: font, fontSize: `${fs}pt`, lineHeight: styling.spacing, color: '#1a1a1a' }}>
      <div style={{ backgroundColor: pc, padding: '18px 24px', marginBottom: 20 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: `${fs * 2.6}pt`, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
          {personalInfo.name || 'Your Name'}
        </h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: `${fs * 0.88}pt`, color: 'rgba(255,255,255,0.85)' }}>
          {personalInfo.email && <span>{personalInfo.email}</span>}
          {personalInfo.phone && <span>{personalInfo.phone}</span>}
          {personalInfo.location && <span>{personalInfo.location}</span>}
          {personalInfo.linkedin && <span>{personalInfo.linkedin}</span>}
          {personalInfo.github && <span>{personalInfo.github}</span>}
          {personalInfo.website && <span>{personalInfo.website}</span>}
        </div>
      </div>

      <div style={{ padding: '0 24px' }}>
        {personalInfo.summary && (
          <div style={{ marginBottom: 16 }}>
            <SectionTitle>Summary</SectionTitle>
            <p style={{ margin: 0, color: '#444', borderLeft: `3px solid ${ac}`, paddingLeft: 10 }}>{personalInfo.summary}</p>
          </div>
        )}

        {sectionOrder.filter(s => s.visible).map(section => {
          switch (section.type) {
            case 'skills':
              return sections.skills.length === 0 ? null : (
                <div key={section.id} style={{ marginBottom: 16 }}>
                  <SectionTitle>{section.name}</SectionTitle>
                  {sections.skills.map(s => (
                    <div key={s.id} data-pdf-row style={{ marginBottom: 4, display: 'flex', gap: 8, alignItems: 'baseline' }}>
                      {s.category.trim() && <span style={{ fontWeight: 700, color: ac, minWidth: 100, flexShrink: 0 }}>{s.category}</span>}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {s.skills.split(',').map((sk, i) => (
                          <span key={i} style={{ backgroundColor: `${ac}18`, color: pc, padding: '1px 8px', borderRadius: 12, fontSize: `${fs * 0.85}pt`, border: `1px solid ${ac}40` }}>
                            {sk.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            case 'experience':
              return sections.experience.length === 0 ? null : (
                <div key={section.id} style={{ marginBottom: 16 }}>
                  <SectionTitle>{section.name}</SectionTitle>
                  {sections.experience.map(exp => (
                    <div key={exp.id} data-pdf-row style={{ marginBottom: 12, paddingLeft: 12, borderLeft: `2px solid ${ac}40` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 700, color: pc }}>{exp.position}</div>
                          <div style={{ color: sc, fontWeight: 600 }}>{exp.company}{exp.location ? ` · ${exp.location}` : ''}</div>
                        </div>
                        <div style={{ fontSize: `${fs * 0.85}pt`, color: '#888', flexShrink: 0, textAlign: 'right' }}>
                          {fmtDate(exp.startDate)} – {exp.current ? 'Present' : fmtDate(exp.endDate)}
                        </div>
                      </div>
                      {exp.achievements.filter(a => a.trim()).length > 0 && (
                        <ul style={{ margin: '5px 0 0 14px', padding: 0 }}>
                          {exp.achievements.filter(a => a.trim()).map((a, i) => (
                            <li key={i} style={{ marginBottom: 2, fontSize: `${fs * 0.95}pt` }}>{a}</li>
                          ))}
                        </ul>
                      )}
                      {exp.technologies && (
                        <div style={{ marginTop: 4, fontSize: `${fs * 0.85}pt`, color: '#555' }}>
                          <span style={{ fontWeight: 600 }}>Stack: </span>{exp.technologies}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            case 'education':
              return sections.education.length === 0 ? null : (
                <div key={section.id} style={{ marginBottom: 16 }}>
                  <SectionTitle>{section.name}</SectionTitle>
                  {sections.education.map(edu => (
                    <div key={edu.id} data-pdf-row style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontWeight: 700, color: pc }}>{edu.institution}</div>
                        <div style={{ color: sc }}>{edu.degree} in {edu.field}{edu.gpa ? ` · GPA: ${edu.gpa}` : ''}</div>
                        {edu.coursework && <div style={{ fontSize: `${fs * 0.85}pt`, color: '#666', marginTop: 2 }}>{edu.coursework}</div>}
                        <EducationDetails entry={edu} />
                      </div>
                      <div style={{ fontSize: `${fs * 0.85}pt`, color: '#888', flexShrink: 0, textAlign: 'right' }}>
                        {fmtDate(edu.startDate)} – {fmtDate(edu.endDate)}
                      </div>
                    </div>
                  ))}
                </div>
              );
            case 'projects':
              return sections.projects.length === 0 ? null : (
                <div key={section.id} style={{ marginBottom: 16 }}>
                  <SectionTitle>{section.name}</SectionTitle>
                  {sections.projects.map(proj => (
                    <div key={proj.id} data-pdf-row style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700, color: ac }}>{proj.title}</span>
                        {proj.year && <span style={{ fontSize: `${fs * 0.85}pt`, color: '#888' }}>{proj.year}</span>}
                      </div>
                      {proj.description && <div style={{ fontSize: `${fs * 0.9}pt`, color: '#444', marginTop: 2 }}>{proj.description}</div>}
                      {proj.technologies && <div style={{ fontSize: `${fs * 0.85}pt`, marginTop: 2, color: sc }}>{proj.technologies}</div>}
                      {proj.url && <div style={{ fontSize: `${fs * 0.85}pt`, color: sc }}>{proj.url}</div>}
                    </div>
                  ))}
                </div>
              );
            case 'awards':
              return sections.awards.length === 0 ? null : (
                <div key={section.id} style={{ marginBottom: 16 }}>
                  <SectionTitle>{section.name}</SectionTitle>
                  {sections.awards.map(aw => (
                    <div key={aw.id} data-pdf-row style={{ marginBottom: 5, display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <span style={{ fontWeight: 600, color: pc }}>{aw.title}</span>
                        {aw.issuer && <span style={{ color: '#888', fontSize: `${fs * 0.88}pt` }}> · {aw.issuer}</span>}
                        {aw.description && <div style={{ fontSize: `${fs * 0.88}pt`, color: '#555' }}>{aw.description}</div>}
                      </div>
                      {aw.date && <span style={{ fontSize: `${fs * 0.85}pt`, color: '#888', flexShrink: 0 }}>{aw.date}</span>}
                    </div>
                  ))}
                </div>
              );
            case 'certifications':
              return sections.certifications.length === 0 ? null : (
                <div key={section.id} style={{ marginBottom: 16 }}>
                  <SectionTitle>{section.name}</SectionTitle>
                  {sections.certifications.map(cert => (
                    <div key={cert.id} data-pdf-row style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div><span style={{ fontWeight: 600 }}>{cert.name}</span>{cert.issuer && <span style={{ color: sc }}> · {cert.issuer}</span>}<CertificationDetails entry={cert} /></div>
                      {cert.date && <span style={{ fontSize: `${fs * 0.85}pt`, color: '#888' }}>{cert.date}</span>}
                    </div>
                  ))}
                </div>
              );
            case 'custom': {
              const cs = sections.custom.find(c => c.id === section.id);
              return cs && cs.entries.length > 0 ? (
                <div key={section.id} style={{ marginBottom: 16 }}>
                  <SectionTitle>{cs.name}</SectionTitle>
                  {cs.entries.map(e => (
                    <div key={e.id} data-pdf-row style={{ marginBottom: 5 }}>
                      {e.title && <div style={{ fontWeight: 600, color: pc }}>{e.title}</div>}
                      {e.content && <div style={{ fontSize: `${fs * 0.9}pt` }}>{e.content}</div>}
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
  );
};

export default ModernTemplate;
