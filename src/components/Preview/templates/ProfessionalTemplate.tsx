import React from 'react';
import { ResumeData } from '../../../types/resume';
import { fmtDate } from '../shared/fmtDate';
import { EducationDetails, CertificationDetails } from '../shared/EntryDetails';

const ProfessionalTemplate: React.FC<{ data: ResumeData }> = ({ data }) => {
  const { personalInfo, sections, sectionOrder, styling } = data;
  const pc = styling.colors.primary;
  const sc = styling.colors.secondary;
  const font = styling.fontFamily;
  const fs = styling.fontSize;

  return (
    <div style={{ fontFamily: font, fontSize: `${fs}pt`, lineHeight: styling.spacing, color: '#1a1a1a' }}>
      <div style={{ textAlign: 'center', marginBottom: 18, paddingBottom: 14, borderBottom: `2px solid ${pc}` }}>
        <h1 style={{ fontSize: `${fs * 2.4}pt`, fontWeight: 800, color: pc, margin: '0 0 4px' }}>
          {personalInfo.name || 'Your Name'}
        </h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 16px', fontSize: `${fs * 0.9}pt`, color: sc }}>
          {personalInfo.email && <span>✉ {personalInfo.email}</span>}
          {personalInfo.phone && <span>✆ {personalInfo.phone}</span>}
          {personalInfo.location && <span>⌖ {personalInfo.location}</span>}
          {personalInfo.linkedin && <span>in {personalInfo.linkedin}</span>}
          {personalInfo.github && <span>⌥ {personalInfo.github}</span>}
          {personalInfo.website && <span>🌐 {personalInfo.website}</span>}
        </div>
      </div>

      {personalInfo.summary && (
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: `${fs * 1.1}pt`, fontWeight: 700, color: pc, borderBottom: `1.5px solid ${pc}`, paddingBottom: 3, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Summary
          </h2>
          <p style={{ margin: 0, color: '#333' }}>{personalInfo.summary}</p>
        </div>
      )}

      {sectionOrder.filter(s => s.visible).map(section => {
        switch (section.type) {
          case 'skills':
            return sections.skills.length === 0 ? null : (
              <div key={section.id} style={{ marginBottom: 14 }}>
                <h2 style={{ fontSize: `${fs * 1.1}pt`, fontWeight: 700, color: pc, borderBottom: `1.5px solid ${pc}`, paddingBottom: 3, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {section.name}
                </h2>
                {sections.skills.map(s => (
                  <div key={s.id} data-pdf-row style={{ marginBottom: 3 }}>
                    {s.category.trim() && <span style={{ fontWeight: 700, color: pc }}>{s.category}: </span>}
                    <span>{s.skills}</span>
                  </div>
                ))}
              </div>
            );
          case 'experience':
            return sections.experience.length === 0 ? null : (
              <div key={section.id} style={{ marginBottom: 14 }}>
                <h2 style={{ fontSize: `${fs * 1.1}pt`, fontWeight: 700, color: pc, borderBottom: `1.5px solid ${pc}`, paddingBottom: 3, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {section.name}
                </h2>
                {sections.experience.map(exp => (
                  <div key={exp.id} data-pdf-row style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, color: pc }}>{exp.company}</div>
                        <div style={{ fontWeight: 600, color: sc }}>{exp.position}</div>
                      </div>
                      <div style={{ textAlign: 'right', color: sc, fontSize: `${fs * 0.88}pt`, flexShrink: 0 }}>
                        <div>{fmtDate(exp.startDate)} – {exp.current ? 'Present' : fmtDate(exp.endDate)}</div>
                        {exp.location && <div>{exp.location}</div>}
                      </div>
                    </div>
                    {exp.achievements.filter(a => a.trim()).length > 0 && (
                      <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                        {exp.achievements.filter(a => a.trim()).map((a, i) => (
                          <li key={i} style={{ marginBottom: 2 }}>{a}</li>
                        ))}
                      </ul>
                    )}
                    {exp.technologies && (
                      <div style={{ marginTop: 4, fontSize: `${fs * 0.88}pt` }}>
                        <span style={{ fontWeight: 600 }}>Tech: </span>{exp.technologies}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          case 'education':
            return sections.education.length === 0 ? null : (
              <div key={section.id} style={{ marginBottom: 14 }}>
                <h2 style={{ fontSize: `${fs * 1.1}pt`, fontWeight: 700, color: pc, borderBottom: `1.5px solid ${pc}`, paddingBottom: 3, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {section.name}
                </h2>
                {sections.education.map(edu => (
                  <div key={edu.id} data-pdf-row style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 700, color: pc }}>{edu.institution}</div>
                        <div style={{ color: sc }}>{edu.degree} in {edu.field}{edu.gpa ? ` · GPA: ${edu.gpa}` : ''}</div>
                      </div>
                      <div style={{ color: sc, fontSize: `${fs * 0.88}pt`, flexShrink: 0 }}>
                        {fmtDate(edu.startDate)} – {fmtDate(edu.endDate)}
                      </div>
                    </div>
                    {edu.coursework && <div style={{ fontSize: `${fs * 0.88}pt`, marginTop: 2 }}><span style={{ fontWeight: 600 }}>Coursework: </span>{edu.coursework}</div>}
                    <EducationDetails entry={edu} />
                  </div>
                ))}
              </div>
            );
          case 'projects':
            return sections.projects.length === 0 ? null : (
              <div key={section.id} style={{ marginBottom: 14 }}>
                <h2 style={{ fontSize: `${fs * 1.1}pt`, fontWeight: 700, color: pc, borderBottom: `1.5px solid ${pc}`, paddingBottom: 3, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {section.name}
                </h2>
                {sections.projects.map(proj => (
                  <div key={proj.id} data-pdf-row style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700, color: pc }}>{proj.title}</span>
                      {proj.year && <span style={{ color: sc, fontSize: `${fs * 0.88}pt` }}>{proj.year}</span>}
                    </div>
                    {proj.description && <div style={{ fontSize: `${fs * 0.9}pt`, marginTop: 2 }}>{proj.description}</div>}
                    {proj.technologies && <div style={{ fontSize: `${fs * 0.88}pt`, marginTop: 2 }}><span style={{ fontWeight: 600 }}>Tech: </span>{proj.technologies}</div>}
                    {proj.url && <div style={{ fontSize: `${fs * 0.85}pt`, marginTop: 2, color: sc }}>{proj.url}</div>}
                  </div>
                ))}
              </div>
            );
          case 'awards':
            return sections.awards.length === 0 ? null : (
              <div key={section.id} style={{ marginBottom: 14 }}>
                <h2 style={{ fontSize: `${fs * 1.1}pt`, fontWeight: 700, color: pc, borderBottom: `1.5px solid ${pc}`, paddingBottom: 3, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {section.name}
                </h2>
                {sections.awards.map(aw => (
                  <div key={aw.id} data-pdf-row style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700, color: pc }}>{aw.title}</span>
                      {aw.date && <span style={{ fontSize: `${fs * 0.88}pt`, color: sc }}>{aw.date}</span>}
                    </div>
                    {aw.issuer && <div style={{ fontSize: `${fs * 0.88}pt`, color: sc }}>{aw.issuer}</div>}
                    {aw.description && <div style={{ fontSize: `${fs * 0.9}pt` }}>{aw.description}</div>}
                  </div>
                ))}
              </div>
            );
          case 'certifications':
            return sections.certifications.length === 0 ? null : (
              <div key={section.id} style={{ marginBottom: 14 }}>
                <h2 style={{ fontSize: `${fs * 1.1}pt`, fontWeight: 700, color: pc, borderBottom: `1.5px solid ${pc}`, paddingBottom: 3, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {section.name}
                </h2>
                {sections.certifications.map(cert => (
                  <div key={cert.id} data-pdf-row style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{cert.name}</span>
                      {cert.issuer && <span style={{ color: sc }}> · {cert.issuer}</span>}
                      <CertificationDetails entry={cert} />
                    </div>
                    {cert.date && <span style={{ fontSize: `${fs * 0.88}pt`, color: sc }}>{cert.date}</span>}
                  </div>
                ))}
              </div>
            );
          case 'custom': {
            const cs = sections.custom.find(c => c.id === section.id);
            return cs && cs.entries.length > 0 ? (
              <div key={section.id} style={{ marginBottom: 14 }}>
                <h2 style={{ fontSize: `${fs * 1.1}pt`, fontWeight: 700, color: pc, borderBottom: `1.5px solid ${pc}`, paddingBottom: 3, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {cs.name}
                </h2>
                {cs.entries.map(e => (
                  <div key={e.id} data-pdf-row style={{ marginBottom: 6 }}>
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
  );
};

export default ProfessionalTemplate;
