import { ResumeData } from '../types/resume';

/** Escapes characters that are special in LaTeX so user content renders literally. */
function esc(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([&%$#_{}~^])/g, (m) => {
      if (m === '~') return '\\textasciitilde{}';
      if (m === '^') return '\\textasciicircum{}';
      return `\\${m}`;
    });
}

function sectionHeading(title: string): string {
  return `\\section{${esc(title)}}\n`;
}

/**
 * Builds a compact, ATS-friendly LaTeX resume source (.tex). Uses only common
 * packages available on Overleaf/TeX Live so it compiles without extra setup.
 */
export function buildLatex(data: ResumeData): string {
  const { personalInfo, sections, sectionOrder } = data;
  const out: string[] = [];

  out.push(String.raw`\documentclass[a4paper,10pt]{article}`);
  out.push(String.raw`\usepackage[margin=0.75in]{geometry}`);
  out.push(String.raw`\usepackage{enumitem}`);
  out.push(String.raw`\usepackage{titlesec}`);
  out.push(String.raw`\usepackage[hidelinks]{hyperref}`);
  out.push(String.raw`\usepackage{parskip}`);
  out.push(String.raw`\titleformat{\section}{\large\bfseries\raggedright}{}{0em}{}[\titlerule]`);
  out.push(String.raw`\titlespacing{\section}{0pt}{8pt}{4pt}`);
  out.push(String.raw`\pagestyle{empty}`);
  out.push(String.raw`\begin{document}`);
  out.push('');

  out.push(String.raw`\begin{center}`);
  out.push(String.raw`{\Huge \bfseries ${esc(personalInfo.name || 'Your Name')}} \\[4pt]`);
  const contact = [
    personalInfo.email,
    personalInfo.phone,
    personalInfo.location,
    personalInfo.github,
    personalInfo.linkedin,
    personalInfo.website,
  ].filter(Boolean).map(esc).join(' $|$ ');
  if (contact) out.push(`${contact}`);
  out.push(String.raw`\end{center}`);
  out.push('');

  if (personalInfo.summary) {
    out.push(sectionHeading('Summary'));
    out.push(esc(personalInfo.summary));
    out.push('');
  }

  for (const section of sectionOrder) {
    if (!section.visible) continue;

    switch (section.type) {
      case 'experience':
        if (sections.experience.length === 0) break;
        out.push(sectionHeading(section.name));
        for (const exp of sections.experience) {
          out.push(String.raw`\noindent\textbf{${esc(exp.company)}} \hfill ${esc(exp.startDate)} -- ${exp.current ? 'Present' : esc(exp.endDate)} \\`);
          out.push(String.raw`\textit{${esc(exp.position)}} \hfill ${esc(exp.location)} \\[2pt]`);
          const achievements = exp.achievements.filter(a => a.trim());
          if (achievements.length) {
            out.push(String.raw`\begin{itemize}[nosep,leftmargin=1.5em]`);
            for (const ach of achievements) out.push(`\\item ${esc(ach)}`);
            out.push(String.raw`\end{itemize}`);
          }
          if (exp.technologies) out.push(String.raw`\textit{Technologies: ${esc(exp.technologies)}} \\`);
          out.push('');
        }
        break;

      case 'education':
        if (sections.education.length === 0) break;
        out.push(sectionHeading(section.name));
        for (const edu of sections.education) {
          out.push(String.raw`\noindent\textbf{${esc(edu.institution)}} \hfill ${esc(edu.startDate)} -- ${esc(edu.endDate)} \\`);
          out.push(`${esc(edu.degree)} in ${esc(edu.field)}${edu.gpa ? ` -- GPA: ${esc(edu.gpa)}` : ''} \\\\`);
          if (edu.coursework) out.push(String.raw`\textit{Coursework: ${esc(edu.coursework)}} \\`);
          out.push('');
        }
        break;

      case 'skills':
        if (sections.skills.length === 0) break;
        out.push(sectionHeading(section.name));
        for (const s of sections.skills) {
          if (s.category && s.skills) out.push(String.raw`\textbf{${esc(s.category)}:} ${esc(s.skills)} \\`);
        }
        out.push('');
        break;

      case 'projects':
        if (sections.projects.length === 0) break;
        out.push(sectionHeading(section.name));
        for (const proj of sections.projects) {
          out.push(String.raw`\noindent\textbf{${esc(proj.title)}}${proj.year ? ` (${esc(proj.year)})` : ''} \\`);
          if (proj.description) out.push(`${esc(proj.description)} \\\\`);
          if (proj.technologies) out.push(String.raw`\textit{Technologies: ${esc(proj.technologies)}} \\`);
          out.push('');
        }
        break;

      case 'awards':
        if (sections.awards.length === 0) break;
        out.push(sectionHeading(section.name));
        out.push(String.raw`\begin{itemize}[nosep,leftmargin=1.5em]`);
        for (const aw of sections.awards) {
          out.push(`\\item \\textbf{${esc(aw.title)}}${aw.description ? ` -- ${esc(aw.description)}` : ''}`);
        }
        out.push(String.raw`\end{itemize}`);
        out.push('');
        break;

      case 'certifications':
        if (sections.certifications.length === 0) break;
        out.push(sectionHeading(section.name));
        out.push(String.raw`\begin{itemize}[nosep,leftmargin=1.5em]`);
        for (const cert of sections.certifications) {
          out.push(`\\item \\textbf{${esc(cert.name)}} -- ${esc(cert.issuer)}${cert.date ? ` (${esc(cert.date)})` : ''}`);
        }
        out.push(String.raw`\end{itemize}`);
        out.push('');
        break;

      case 'custom': {
        const cs = sections.custom.find(c => c.id === section.id);
        if (!cs || cs.entries.length === 0) break;
        out.push(sectionHeading(cs.name));
        for (const entry of cs.entries) {
          if (entry.title) out.push(String.raw`\textbf{${esc(entry.title)}} \\`);
          if (entry.content) out.push(`${esc(entry.content)} \\\\`);
        }
        out.push('');
        break;
      }
    }
  }

  out.push(String.raw`\end{document}`);
  return out.join('\n');
}

export function exportLatex(data: ResumeData): void {
  const tex = buildLatex(data);
  const blob = new Blob([tex], { type: 'application/x-tex' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${data.personalInfo.name || 'resume'}.tex`;
  a.click();
  URL.revokeObjectURL(url);
}
