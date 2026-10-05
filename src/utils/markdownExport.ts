import { ResumeData } from '../types/resume';

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/([\\`*_{}[\]()#+!|~-])/g, '\\$1')
    .replace(/^(\s*\d+)\.(?=\s|$)/gm, '$1\\.');
}

function link(raw: string): string {
  const label = esc(raw);
  try {
    const url = new URL(raw);
    if (!['https:', 'http:'].includes(url.protocol)) return label;
    const target = url.href.replace(/[()'<>\\]/g, c => `%${c.charCodeAt(0).toString(16)}`);
    return `[${label}](${target})`;
  } catch {
    return label;
  }
}

function heading(text: string): string {
  return `## ${esc(text).replace(/[\r\n]+/g, ' ')}\n`;
}

/** Builds a clean, ATS-safe Markdown version of the resume (e.g. for GitHub profiles, Notion). */
export function buildMarkdown(data: ResumeData): string {
  const { personalInfo, sections, sectionOrder } = data;
  const lines: string[] = [];

  lines.push(`# ${esc(personalInfo.name || 'Your Name').replace(/[\r\n]+/g, ' ')}`);

  const contact = [
    personalInfo.email,
    personalInfo.phone,
    personalInfo.location,
    personalInfo.github,
    personalInfo.linkedin,
    personalInfo.website,
  ].filter((s): s is string => Boolean(s)).map(esc).join(' · ');
  if (contact) lines.push(contact);
  lines.push('');

  if (personalInfo.summary) {
    lines.push(heading('Summary'));
    lines.push(esc(personalInfo.summary), '');
  }

  for (const section of sectionOrder) {
    if (!section.visible) continue;

    switch (section.type) {
      case 'experience':
        if (sections.experience.length === 0) break;
        lines.push(heading(section.name));
        for (const exp of sections.experience) {
          lines.push(`**${esc(exp.company)}** — *${esc(exp.position)}*`);
          lines.push(`${esc(exp.startDate)} – ${exp.current ? 'Present' : esc(exp.endDate)}${exp.location ? ` · ${esc(exp.location)}` : ''}`);
          for (const ach of exp.achievements.filter(a => a.trim())) lines.push(`- ${esc(ach)}`);
          if (exp.technologies) lines.push(`*Technologies: ${esc(exp.technologies)}*`);
          lines.push('');
        }
        break;

      case 'education':
        if (sections.education.length === 0) break;
        lines.push(heading(section.name));
        for (const edu of sections.education) {
          lines.push(`**${esc(edu.institution)}**`);
          lines.push(`${esc(edu.degree)}${edu.field ? ` in ${esc(edu.field)}` : ''}${edu.gpa ? ` · GPA: ${esc(edu.gpa)}` : ''}`);
          lines.push(`${esc(edu.startDate)} – ${esc(edu.endDate)}`);
          if (edu.coursework) lines.push(`*Coursework: ${esc(edu.coursework)}*`);
          if (edu.honors) lines.push(`*Honors: ${esc(edu.honors)}*`);
          lines.push('');
        }
        break;

      case 'skills':
        if (sections.skills.length === 0) break;
        lines.push(heading(section.name));
        for (const s of sections.skills) {
          if (s.skills.trim()) lines.push(`- ${s.category.trim() ? `**${esc(s.category)}:** ` : ''}${esc(s.skills)}`);
        }
        lines.push('');
        break;

      case 'projects':
        if (sections.projects.length === 0) break;
        lines.push(heading(section.name));
        for (const proj of sections.projects) {
          lines.push(`**${esc(proj.title)}**${proj.year ? ` (${esc(proj.year)})` : ''}`);
          if (proj.description) lines.push(esc(proj.description));
          if (proj.technologies) lines.push(`*Technologies: ${esc(proj.technologies)}*`);
          if (proj.url) lines.push(link(proj.url));
          lines.push('');
        }
        break;

      case 'awards':
        if (sections.awards.length === 0) break;
        lines.push(heading(section.name));
        for (const aw of sections.awards) {
          lines.push(`- **${esc(aw.title)}**${aw.issuer ? ` — ${esc(aw.issuer)}` : ''}${aw.date ? ` (${esc(aw.date)})` : ''}${aw.description ? ` — ${esc(aw.description)}` : ''}`);
        }
        lines.push('');
        break;

      case 'certifications':
        if (sections.certifications.length === 0) break;
        lines.push(heading(section.name));
        for (const cert of sections.certifications) {
          lines.push(`- **${esc(cert.name)}** — ${esc(cert.issuer)}${cert.date ? ` (${esc(cert.date)})` : ''}`);
          if (cert.expiryDate) lines.push(`  Expires: ${esc(cert.expiryDate)}`);
          if (cert.credentialId) lines.push(`  Credential ID: ${esc(cert.credentialId)}`);
        }
        lines.push('');
        break;

      case 'custom': {
        const cs = sections.custom.find(c => c.id === section.id);
        if (!cs || cs.entries.length === 0) break;
        lines.push(heading(cs.name));
        for (const entry of cs.entries) {
          if (entry.title) lines.push(`**${esc(entry.title)}**`);
          if (entry.content) lines.push(esc(entry.content));
          lines.push('');
        }
        break;
      }
    }
  }

  return lines.join('\n');
}

export function exportMarkdown(data: ResumeData): void {
  const md = buildMarkdown(data);
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${data.personalInfo.name || 'resume'}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
