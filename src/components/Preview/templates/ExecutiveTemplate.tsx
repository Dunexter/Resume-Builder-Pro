import React from 'react';
import { ResumeData } from '../../../types/resume';
import { fmtDate } from '../shared/fmtDate';
import { EducationDetails, CertificationDetails } from '../shared/EntryDetails';

const ExecutiveTemplate: React.FC<{ data: ResumeData }> = ({ data }) => {
  const { personalInfo, sections, sectionOrder, styling } = data;
  const pc = styling.colors.primary;
  const sc = styling.colors.secondary;
  const font = styling.fontFamily;
  const fs = styling.fontSize;

  return (
    <div style={{ fontFamily: font, fontSize: `${fs}pt`, lineHeight: styling.spacing, color: '#111', display: 'flex', minHeight: '100%' }}>
      <div style={{ width: 8, backgroundColor: pc, flexShrink: 0 }} />

      <div style={{ flex: 1, padding: '16px 20px' }}>
        <div style={{ marginBottom: 14, paddingBottom: 10, borderBottom: `3px double ${pc}` }}>
          <h1 style={{ fontSize: `${fs * 2.4}pt`, fontWeight: 900, color: pc, margin: '0 0 2px', letterSpacing: '-0.02em' }}>
            {personalInfo.name || 'Your Name'}
          </h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 16px', fontSize: `${fs * 0.88}pt`, color: sc }}>
            {[personalInfo.email, personalInfo.phone, personalInfo.location, personalInfo.linkedin, personalInfo.github, personalInfo.website].filter(Boolean).map((c, i) => <span key={i}>{c}</span>)}
          </div>
        </div>

        {personalInfo.summary && (
          <div style={{ marginBottom: 14, padding: '8px 12px', backgroundColor: `${pc}0d`, borderLeft: `4px solid ${pc}` }}>
            <div style={{ fontWeight: 700, fontSize: `${fs * 0.85}pt`, color: pc, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Executive Summary</div>
            <p style={{ margin: 0 }}>{personalInfo.summary}</p>
          </div>
        )}

        {sectionOrder.filter(s => s.visible).map(section => {
          const SH = () => (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <h2 style={{ margin: 0, fontSize: `${fs * 1.05}pt`, fontWeight: 800, color: pc, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{section.type === 'custom' ? sections.custom.find(c => c.id === section.id)?.name : section.name}</h2>
              <div style={{ flex: 1, height: 1, backgroundColor: `${pc}60` }} />
            </div>
          );

          switch (section.type) {
            case 'skills':
              return sections.skills.length === 0 ? null : (
                <div key={section.id} style={{ marginBottom: 12 }}>
                  <SH />
                  {sections.skills.filter(s => s.skills.trim()).map(s => (
                    <div key={s.id} data-pdf-row style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                      {s.category.trim() && <strong>{s.category}: </strong>}
                      {s.skills.split(',').map(sk => sk.trim()).filter(Boolean).map((sk, i) => (
                        <span key={i} style={{ backgroundColor: `${pc}15`, color: pc, padding: '2px 10px', borderRadius: 3, fontSize: `${fs * 0.88}pt`, fontWeight: 500 }}>{sk}</span>
                      ))}
                    </div>
                  ))}
                </div>
              );
            case 'experience':
              return sections.experience.length === 0 ? null : (
                <div key={section.id} style={{ marginBottom: 12 }}>
                  <SH />
                  {sections.experience.map(exp => (
                    <div key={exp.id} data-pdf-row style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div>
                          <span style={{ fontWeight: 800, color: pc, fontSize: `${fs * 1.05}pt` }}>{exp.position}</span>
                          <span style={{ color: '#555' }}> — {exp.company}</span>
                          {exp.location && <span style={{ color: '#777', fontSize: `${fs * 0.85}pt` }}>, {exp.location}</span>}
                        </div>
                        <span style={{ fontSize: `${fs * 0.85}pt`, color: '#777', flexShrink: 0 }}>
                          {fmtDate(exp.startDate)} – {exp.current ? 'Present' : fmtDate(exp.endDate)}
                        </span>
                      </div>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                        {exp.achievements.filter(a => a.trim()).map((a, i) => <li key={i} style={{ marginBottom: 2 }}>{a}</li>)}
                      </ul>
                      {exp.technologies && <div style={{ marginTop: 3, fontSize: `${fs * 0.85}pt`, color: '#555', fontStyle: 'italic' }}>{exp.technologies}</div>}
                    </div>
                  ))}
                </div>
              );
            case 'education':
              return sections.education.length === 0 ? null : (
                <div key={section.id} style={{ marginBottom: 12 }}>
                  <SH />
                  {sections.education.map(edu => (
                    <div key={edu.id} data-pdf-row style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{edu.institution}</div>
                        <div style={{ color: sc }}>{edu.degree} in {edu.field}{edu.gpa ? ` · GPA: ${edu.gpa}` : ''}</div>
                        <EducationDetails entry={edu} coursework />
                      </div>
                      <span style={{ fontSize: `${fs * 0.85}pt`, color: '#777' }}>{fmtDate(edu.startDate)} – {fmtDate(edu.endDate)}</span>
                    </div>
                  ))}
                </div>
              );
            case 'projects':
              return sections.projects.length === 0 ? null : (
                <div key={section.id} style={{ marginBottom: 12 }}>
                  <SH />
                  {sections.projects.map(proj => (
                    <div key={proj.id} data-pdf-row style={{ marginBottom: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700, color: pc }}>{proj.title}</span>
                        {proj.year && <span style={{ fontSize: `${fs * 0.85}pt`, color: '#777' }}>{proj.year}</span>}
                      </div>
                      {proj.description && <div style={{ fontSize: `${fs * 0.9}pt` }}>{proj.description}</div>}
                      {proj.technologies && <div style={{ fontSize: `${fs * 0.82}pt`, color: sc }}>{proj.technologies}</div>}
                      {proj.url && <div style={{ fontSize: `${fs * 0.82}pt`, color: sc }}>{proj.url}</div>}
                    </div>
                  ))}
                </div>
              );
            case 'awards':
              return sections.awards.length === 0 ? null : (
                <div key={section.id} style={{ marginBottom: 12 }}>
                  <SH />
                  {sections.awards.map(aw => (
                    <div key={aw.id} data-pdf-row style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{aw.title}</span>
                        {aw.issuer && <span style={{ color: sc }}> · {aw.issuer}</span>}
                        {aw.description && <div style={{ fontSize: `${fs * 0.88}pt` }}>{aw.description}</div>}
                      </div>
                      {aw.date && <span style={{ fontSize: `${fs * 0.82}pt`, color: '#777' }}>{aw.date}</span>}
                    </div>
                  ))}
                </div>
              );
            case 'certifications':
              return sections.certifications.length === 0 ? null : (
                <div key={section.id} style={{ marginBottom: 12 }}>
                  <SH />
                  {sections.certifications.map(cert => (
                    <div key={cert.id} data-pdf-row style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <div><span style={{ fontWeight: 600 }}>{cert.name}</span>{cert.issuer && <span style={{ color: sc }}> · {cert.issuer}</span>}<CertificationDetails entry={cert} /></div>
                      {cert.date && <span style={{ fontSize: `${fs * 0.85}pt`, color: '#777' }}>{cert.date}</span>}
                    </div>
                  ))}
                </div>
              );
            case 'custom': {
              const cs = sections.custom.find(c => c.id === section.id);
              return cs && cs.entries.length > 0 ? (
                <div key={section.id} style={{ marginBottom: 12 }}>
                  <SH />
                  {cs.entries.map(e => (
                    <div key={e.id} data-pdf-row style={{ marginBottom: 4 }}>
                      {e.title && <div style={{ fontWeight: 600 }}>{e.title}</div>}
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

export default ExecutiveTemplate;
