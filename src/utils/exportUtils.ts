import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
} from 'docx';
import { ResumeData } from '../types/resume';

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 24, color: '1C033C' })],
    spacing: { before: 200, after: 60 },
    keepNext: true,
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '1C033C' } },
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 20 })],
    bullet: { level: 0 },
    spacing: { after: 40 },
  });
}

function kv(label: string, value: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: label ? label + ': ' : '', bold: true, size: 20 }),
      new TextRun({ text: value, size: 20 }),
    ],
    spacing: { after: 40 },
  });
}

export function buildDOCX(data: ResumeData): Document {
  const { personalInfo, sections, sectionOrder } = data;

  const children: Paragraph[] = [];

  // Name
  children.push(
    new Paragraph({
      children: [new TextRun({ text: personalInfo.name || 'Your Name', bold: true, size: 36, color: '1C033C' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    })
  );

  // Contact row
  const contact = [
    personalInfo.email,
    personalInfo.phone,
    personalInfo.location,
    personalInfo.github,
    personalInfo.linkedin,
    personalInfo.website,
  ].filter(Boolean).join('  |  ');

  children.push(
    new Paragraph({
      children: [new TextRun({ text: contact, size: 18, color: '555555' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    })
  );

  if (personalInfo.summary) {
    children.push(sectionHeading('Summary'));
    children.push(new Paragraph({ children: [new TextRun({ text: personalInfo.summary, size: 20 })], spacing: { after: 100 } }));
  }

  // Dynamic sections
  for (const section of sectionOrder) {
    if (!section.visible) continue;

    switch (section.type) {
      case 'experience':
        if (sections.experience.length === 0) break;
        children.push(sectionHeading(section.name));
        for (const exp of sections.experience) {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: exp.company, bold: true, size: 22 }),
              new TextRun({ text: `  |  ${exp.position}`, size: 22, color: '371e77' }),
            ],
            spacing: { after: 20 },
          }));
          children.push(new Paragraph({
            children: [
              new TextRun({ text: `${exp.startDate} – ${exp.current ? 'Present' : exp.endDate}`, size: 18, color: '666666', italics: true }),
              exp.location ? new TextRun({ text: `  |  ${exp.location}`, size: 18, color: '666666', italics: true }) : new TextRun(''),
            ],
            spacing: { after: 40 },
          }));
          for (const ach of exp.achievements.filter(a => a.trim())) {
            children.push(bullet(ach));
          }
          if (exp.technologies) children.push(kv('Technologies', exp.technologies));
          children.push(new Paragraph({ spacing: { after: 80 } }));
        }
        break;

      case 'education':
        if (sections.education.length === 0) break;
        children.push(sectionHeading(section.name));
        for (const edu of sections.education) {
          children.push(new Paragraph({
            children: [new TextRun({ text: edu.institution, bold: true, size: 22 })],
            spacing: { after: 20 },
          }));
          children.push(new Paragraph({
            children: [
              new TextRun({ text: `${edu.degree} in ${edu.field}`, size: 20, color: '371e77' }),
              edu.gpa ? new TextRun({ text: `  |  GPA: ${edu.gpa}`, size: 20 }) : new TextRun(''),
            ],
            spacing: { after: 20 },
          }));
          children.push(new Paragraph({
            children: [new TextRun({ text: `${edu.startDate} – ${edu.endDate}`, size: 18, color: '666666', italics: true })],
            spacing: { after: edu.coursework ? 20 : 80 },
          }));
          if (edu.coursework) children.push(kv('Coursework', edu.coursework));
          if (edu.honors) children.push(kv('Honors', edu.honors));
          children.push(new Paragraph({ spacing: { after: 60 } }));
        }
        break;

      case 'skills':
        if (sections.skills.length === 0) break;
        children.push(sectionHeading(section.name));
        for (const s of sections.skills) {
          if (s.skills.trim()) children.push(kv(s.category.trim(), s.skills));
        }
        children.push(new Paragraph({ spacing: { after: 60 } }));
        break;

      case 'projects':
        if (sections.projects.length === 0) break;
        children.push(sectionHeading(section.name));
        for (const proj of sections.projects) {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: proj.title, bold: true, size: 22 }),
              proj.year ? new TextRun({ text: `  (${proj.year})`, size: 20, color: '666666' }) : new TextRun(''),
            ],
            spacing: { after: 20 },
          }));
          if (proj.description) children.push(new Paragraph({ children: [new TextRun({ text: proj.description, size: 20 })], spacing: { after: 20 } }));
          if (proj.technologies) children.push(kv('Technologies', proj.technologies));
          if (proj.url) children.push(kv('URL', proj.url));
          children.push(new Paragraph({ spacing: { after: 60 } }));
        }
        break;

      case 'awards':
        if (sections.awards.length === 0) break;
        children.push(sectionHeading(section.name));
        for (const aw of sections.awards) {
          children.push(new Paragraph({
            children: [new TextRun({ text: aw.title, bold: true, size: 20 })],
            spacing: { after: 20 },
          }));
          if (aw.description) children.push(new Paragraph({ children: [new TextRun({ text: aw.description, size: 20 })], spacing: { after: 60 } }));
          if (aw.issuer) children.push(kv('Issuer', aw.issuer));
          if (aw.date) children.push(kv('Date', aw.date));
        }
        break;

      case 'certifications':
        if (sections.certifications.length === 0) break;
        children.push(sectionHeading(section.name));
        for (const cert of sections.certifications) {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: cert.name, bold: true, size: 20 }),
              new TextRun({ text: `  –  ${cert.issuer}`, size: 20, color: '555555' }),
            ],
            spacing: { after: 20 },
          }));
          if (cert.date) children.push(new Paragraph({ children: [new TextRun({ text: cert.date, size: 18, italics: true, color: '777777' })], spacing: { after: 60 } }));
          if (cert.expiryDate) children.push(kv('Expires', cert.expiryDate));
          if (cert.credentialId) children.push(kv('Credential ID', cert.credentialId));
        }
        break;

      case 'custom': {
        const cs = sections.custom.find(c => c.id === section.id);
        if (!cs || cs.entries.length === 0) break;
        children.push(sectionHeading(cs.name));
        for (const entry of cs.entries) {
          if (entry.title) children.push(new Paragraph({ children: [new TextRun({ text: entry.title, bold: true, size: 20 })], spacing: { after: 20 } }));
          if (entry.content) children.push(new Paragraph({ children: [new TextRun({ text: entry.content, size: 20 })], spacing: { after: 60 } }));
        }
        break;
      }
    }
  }

  return new Document({
    sections: [{ children }],
    styles: {
      default: {
        document: {
          run: { font: data.styling.fontFamily || 'Calibri', size: 20 },
          paragraph: { keepLines: true },
        },
      },
    },
  });
}

export async function exportDOCX(data: ResumeData): Promise<void> {
  const blob = await Packer.toBlob(buildDOCX(data));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${data.personalInfo.name || 'resume'}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildTXT(data: ResumeData): string {
  const { personalInfo, sections, sectionOrder } = data;
  const lines: string[] = [];

  lines.push(personalInfo.name || 'Your Name');
  lines.push('='.repeat(60));

  const contact = [personalInfo.email, personalInfo.phone, personalInfo.location, personalInfo.github, personalInfo.linkedin, personalInfo.website].filter(Boolean).join(' | ');
  if (contact) lines.push(contact);
  lines.push('');

  if (personalInfo.summary) {
    lines.push('SUMMARY');
    lines.push('-'.repeat(40));
    lines.push(personalInfo.summary);
    lines.push('');
  }

  for (const section of sectionOrder) {
    if (!section.visible) continue;

    switch (section.type) {
      case 'experience':
        if (sections.experience.length === 0) break;
        lines.push(section.name.toUpperCase());
        lines.push('-'.repeat(40));
        for (const exp of sections.experience) {
          lines.push(`${exp.company} | ${exp.position}`);
          lines.push(`${exp.startDate} - ${exp.current ? 'Present' : exp.endDate}  |  ${exp.location}`);
          for (const ach of exp.achievements.filter(a => a.trim())) lines.push(`• ${ach}`);
          if (exp.technologies) lines.push(`Technologies: ${exp.technologies}`);
          lines.push('');
        }
        break;
      case 'education':
        if (sections.education.length === 0) break;
        lines.push(section.name.toUpperCase());
        lines.push('-'.repeat(40));
        for (const edu of sections.education) {
          lines.push(edu.institution);
          lines.push(`${edu.degree} in ${edu.field}${edu.gpa ? ' | GPA: ' + edu.gpa : ''}`);
          lines.push(`${edu.startDate} - ${edu.endDate}`);
          if (edu.coursework) lines.push(`Coursework: ${edu.coursework}`);
          if (edu.honors) lines.push(`Honors: ${edu.honors}`);
          lines.push('');
        }
        break;
      case 'skills':
        if (sections.skills.length === 0) break;
        lines.push(section.name.toUpperCase());
        lines.push('-'.repeat(40));
        for (const s of sections.skills) {
          if (s.skills.trim()) lines.push(s.category.trim() ? `${s.category}: ${s.skills}` : s.skills);
        }
        lines.push('');
        break;
      case 'projects':
        if (sections.projects.length === 0) break;
        lines.push(section.name.toUpperCase());
        lines.push('-'.repeat(40));
        for (const proj of sections.projects) {
          lines.push(`${proj.title}${proj.year ? ' (' + proj.year + ')' : ''}`);
          if (proj.description) lines.push(proj.description);
          if (proj.technologies) lines.push(`Technologies: ${proj.technologies}`);
          if (proj.url) lines.push(`URL: ${proj.url}`);
          lines.push('');
        }
        break;
      case 'awards':
        if (sections.awards.length === 0) break;
        lines.push(section.name.toUpperCase());
        lines.push('-'.repeat(40));
        for (const aw of sections.awards) {
          lines.push(aw.title);
          if (aw.issuer) lines.push(`Issuer: ${aw.issuer}`);
          if (aw.date) lines.push(`Date: ${aw.date}`);
          if (aw.description) lines.push(aw.description);
          lines.push('');
        }
        break;
      case 'certifications':
        if (sections.certifications.length === 0) break;
        lines.push(section.name.toUpperCase());
        lines.push('-'.repeat(40));
        for (const cert of sections.certifications) {
          lines.push(`${cert.name} - ${cert.issuer} (${cert.date})`);
          if (cert.expiryDate) lines.push(`Expires: ${cert.expiryDate}`);
          if (cert.credentialId) lines.push(`Credential ID: ${cert.credentialId}`);
        }
        lines.push('');
        break;
      case 'custom': {
        const cs = sections.custom.find(c => c.id === section.id);
        if (!cs || !cs.entries.length) break;
        lines.push(cs.name.toUpperCase(), '-'.repeat(40));
        for (const entry of cs.entries) {
          if (entry.title) lines.push(entry.title);
          if (entry.content) lines.push(entry.content);
          lines.push('');
        }
        break;
      }
    }
  }

  return lines.join('\n');
}

export function exportTXT(data: ResumeData): void {
  const blob = new Blob([buildTXT(data)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${data.personalInfo.name || 'resume'}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
