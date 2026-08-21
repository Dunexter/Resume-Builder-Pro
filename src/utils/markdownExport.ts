import { ResumeData } from '../types/resume';

function heading(text: string): string {
  return `## ${text}\n`;
}

/** Builds a clean, ATS-safe Markdown version of the resume (e.g. for GitHub profiles, Notion). */
export function buildMarkdown(data: ResumeData): string {
  const { personalInfo, sections, sectionOrder } = data;
  const lines: string[] = [];

  lines.push(`# ${personalInfo.name || 'Your Name'}`);

  const contact = [
    personalInfo.email,
    personalInfo.phone,
    personalInfo.location,
    personalInfo.github,
    personalInfo.linkedin,
    personalInfo.website,
  ].filter(Boolean).join(' · ');
  if (contact) lines.push(contact);
  lines.push('');

  if (personalInfo.summary) {
    lines.push(heading('Summary'));
    lines.push(personalInfo.summary, '');
  }

  for (const section of sectionOrder) {
    if (!section.visible) continue;

    switch (section.type) {
      case 'experience':
        if (sections.experience.length === 0) break;
        lines.push(heading(section.name));
        for (const exp of sections.experience) {
          lines.push(`**${exp.company}** — *${exp.position}*`);
          lines.push(`${exp.startDate} – ${exp.current ? 'Present' : exp.endDate}${exp.location ? ` · ${exp.location}` : ''}`);
          for (const ach of exp.achievements.filter(a => a.trim())) lines.push(`- ${ach}`);
          if (exp.technologies) lines.push(`*Technologies: ${exp.technologies}*`);
          lines.push('');
        }
        break;

      case 'education':
        if (sections.education.length === 0) break;
        lines.push(heading(section.name));
        for (const edu of sections.education) {
          lines.push(`**${edu.institution}**`);
          lines.push(`${edu.degree} in ${edu.field}${edu.gpa ? ` · GPA: ${edu.gpa}` : ''}`);
          lines.push(`${edu.startDate} – ${edu.endDate}`);
          if (edu.coursework) lines.push(`*Coursework: ${edu.coursework}*`);
          lines.push('');
        }
        break;

      case 'skills':
        if (sections.skills.length === 0) break;
        lines.push(heading(section.name));
        for (const s of sections.skills) {
          if (s.category && s.skills) lines.push(`- **${s.category}:** ${s.skills}`);
        }
        lines.push('');
        break;

      case 'projects':
        if (sections.projects.length === 0) break;
        lines.push(heading(section.name));
        for (const proj of sections.projects) {
          lines.push(`**${proj.title}**${proj.year ? ` (${proj.year})` : ''}`);
          if (proj.description) lines.push(proj.description);
          if (proj.technologies) lines.push(`*Technologies: ${proj.technologies}*`);
          if (proj.url) lines.push(`[${proj.url}](${proj.url})`);
          lines.push('');
        }
        break;

      case 'awards':
        if (sections.awards.length === 0) break;
        lines.push(heading(section.name));
        for (const aw of sections.awards) {
          lines.push(`- **${aw.title}**${aw.description ? ` — ${aw.description}` : ''}`);
        }
        lines.push('');
        break;

      case 'certifications':
        if (sections.certifications.length === 0) break;
        lines.push(heading(section.name));
        for (const cert of sections.certifications) {
          lines.push(`- **${cert.name}** — ${cert.issuer}${cert.date ? ` (${cert.date})` : ''}`);
        }
        lines.push('');
        break;

      case 'custom': {
        const cs = sections.custom.find(c => c.id === section.id);
        if (!cs || cs.entries.length === 0) break;
        lines.push(heading(cs.name));
        for (const entry of cs.entries) {
          if (entry.title) lines.push(`**${entry.title}**`);
          if (entry.content) lines.push(entry.content);
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
