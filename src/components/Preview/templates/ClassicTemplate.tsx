import React from 'react';
import { ResumeData } from '../../../types/resume';
import { fmtDate } from '../shared/fmtDate';
import { EducationDetails, CertificationDetails } from '../shared/EntryDetails';

const ClassicTemplate: React.FC<{ data: ResumeData }> = ({ data }) => {
  const { personalInfo, sections, sectionOrder, styling } = data;
  const font = 'Times New Roman';
  const fs = styling.fontSize;

  return (
    <div style={{ fontFamily: font, fontSize: `${fs}pt`, lineHeight: styling.spacing, color: '#000' }}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <h1 style={{ fontSize: `${fs * 2}pt`, fontWeight: 700, margin: '0 0 4px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {personalInfo.name || 'Your Name'}
        </h1>
        <div style={{ fontSize: `${fs * 0.9}pt` }}>
          {[personalInfo.email, personalInfo.phone, personalInfo.location, personalInfo.linkedin, personalInfo.github, personalInfo.website].filter(Boolean).join('  ·  ')}
        </div>
      </div>

      {personalInfo.summary && (
        <>
          <div style={{ borderTop: '2px solid #000', borderBottom: '1px solid #000', padding: '2px 0', marginBottom: 6 }}>
            <strong style={{ fontSize: `${fs * 0.9}pt`, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Summary</strong>
          </div>
          <p style={{ margin: '0 0 10px' }}>{personalInfo.summary}</p>
        </>
      )}

      {sectionOrder.filter(s => s.visible).map(section => {
        const heading = (
          <div key={`h-${section.id}`} style={{ borderTop: '2px solid #000', borderBottom: '1px solid #000', padding: '2px 0', marginBottom: 6 }}>
            <strong style={{ fontSize: `${fs * 0.9}pt`, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{section.type === 'custom' ? sections.custom.find(c => c.id === section.id)?.name : section.name}</strong>
          </div>
        );

        switch (section.type) {
          case 'skills':
            return sections.skills.length === 0 ? null : (
              <div key={section.id} style={{ marginBottom: 10 }}>
                {heading}
                {sections.skills.map(s => (
                  <div key={s.id} data-pdf-row style={{ marginBottom: 2 }}>
                    {s.category.trim() && <strong>{s.category}: </strong>}{s.skills}
                  </div>
                ))}
              </div>
            );
          case 'experience':
            return sections.experience.length === 0 ? null : (
              <div key={section.id} style={{ marginBottom: 10 }}>
                {heading}
                {sections.experience.map(exp => (
                  <div key={exp.id} data-pdf-row style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div><strong>{exp.company}</strong>, <em>{exp.position}</em>{exp.location ? `, ${exp.location}` : ''}</div>
                      <div style={{ flexShrink: 0 }}>{fmtDate(exp.startDate)} – {exp.current ? 'Present' : fmtDate(exp.endDate)}</div>
                    </div>
                    <ul style={{ margin: '3px 0 0 18px', padding: 0 }}>
                      {exp.achievements.filter(a => a.trim()).map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                    {exp.technologies && <div style={{ marginTop: 2 }}><em>Technologies:</em> {exp.technologies}</div>}
                  </div>
                ))}
              </div>
            );
          case 'education':
            return sections.education.length === 0 ? null : (
              <div key={section.id} style={{ marginBottom: 10 }}>
                {heading}
                {sections.education.map(edu => (
                  <div key={edu.id} data-pdf-row style={{ marginBottom: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div><strong>{edu.institution}</strong> — {edu.degree} in {edu.field}{edu.gpa ? `, GPA: ${edu.gpa}` : ''}</div>
                      <div style={{ flexShrink: 0 }}>{fmtDate(edu.startDate)} – {fmtDate(edu.endDate)}</div>
                    </div>
                    {edu.coursework && <div><em>Coursework:</em> {edu.coursework}</div>}
                    <EducationDetails entry={edu} />
                  </div>
                ))}
              </div>
            );
          case 'projects':
            return sections.projects.length === 0 ? null : (
              <div key={section.id} style={{ marginBottom: 10 }}>
                {heading}
                {sections.projects.map(proj => (
                  <div key={proj.id} data-pdf-row style={{ marginBottom: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{proj.title}</strong>
                      {proj.year && <span>{proj.year}</span>}
                    </div>
                    {proj.description && <div>{proj.description}</div>}
                    {proj.technologies && <div><em>Technologies:</em> {proj.technologies}</div>}
                    {proj.url && <div>{proj.url}</div>}
                  </div>
                ))}
              </div>
            );
          case 'awards':
            return sections.awards.length === 0 ? null : (
              <div key={section.id} style={{ marginBottom: 10 }}>
                {heading}
                {sections.awards.map(aw => (
                  <div key={aw.id} data-pdf-row style={{ marginBottom: 3 }}>
                    <strong>{aw.title}</strong>{aw.issuer ? ` — ${aw.issuer}` : ''}{aw.date ? ` (${aw.date})` : ''}
                    {aw.description && <div style={{ paddingLeft: 8 }}>{aw.description}</div>}
                  </div>
                ))}
              </div>
            );
          case 'certifications':
            return sections.certifications.length === 0 ? null : (
              <div key={section.id} style={{ marginBottom: 10 }}>
                {heading}
                {sections.certifications.map(cert => (
                  <div key={cert.id} data-pdf-row style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <div><strong>{cert.name}</strong>{cert.issuer ? ` — ${cert.issuer}` : ''}<CertificationDetails entry={cert} /></div>
                    {cert.date && <span>{cert.date}</span>}
                  </div>
                ))}
              </div>
            );
          case 'custom': {
            const cs = sections.custom.find(c => c.id === section.id);
            return cs && cs.entries.length > 0 ? (
              <div key={section.id} style={{ marginBottom: 10 }}>
                {heading}
                {cs.entries.map(e => (
                  <div key={e.id} data-pdf-row style={{ marginBottom: 4 }}>
                    {e.title && <strong>{e.title}: </strong>}
                    {e.content && <span>{e.content}</span>}
                  </div>
                ))}
              </div>
            ) : null;
          }
          default: return null;
        }
      })}
    </div>
  );
};

export default ClassicTemplate;
