import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ResumeData } from '../types/resume';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ResumeDocument } from '../components/Preview/ResumePreview';
import { buildTXT } from './exportUtils';

function fileBase(data: ResumeData): string {
  return (data.personalInfo.name || 'resume').replace(/[/\\?%*:|"<>]/g, '-').trim() || 'resume';
}

function fmtDate(d: string): string {
  if (!d) return '';
  const [y, m] = d.split('-');
  if (!m) return y;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mi = parseInt(m, 10) - 1;
  return `${months[mi] || m} ${y}`;
}

export function paginateVisual(height: number, pageHeight: number, rows: { top: number; bottom: number }[] = []) {
  if (!Number.isFinite(height) || !Number.isFinite(pageHeight) || height <= 0 || pageHeight < 1) {
    throw new Error('Invalid resume page dimensions.');
  }
  const slices: { top: number; height: number }[] = [];
  for (let top = 0; top < height;) {
    const limit = height - (top + pageHeight) < 1 ? height : top + pageHeight;
    let end = limit;
    // Move the break above intersecting rows, including rows in the other column.
    while (end < height) {
      const crossing = rows.filter(row => row.top < end && row.bottom > end && row.bottom - row.top <= pageHeight);
      if (!crossing.length) break;
      const next = Math.floor(Math.min(...crossing.map(row => row.top)));
      if (next <= top) { end = limit; break; } // An oversized/overlapping row must split.
      end = next;
    }
    slices.push({ top, height: end - top });
    top = end;
  }
  return slices;
}

/** Render a fresh data snapshot, not a potentially hidden or zoomed UI ancestor. */
export async function exportVisualPDF(data: ResumeData): Promise<void> {
  const frame = document.createElement('iframe');
  frame.title = 'Temporary PDF rendering surface';
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;pointer-events:none;';
  document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument;
    if (!doc) throw new Error('Could not create the PDF rendering surface.');
    await Promise.all(Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(source => {
      const copy = source.cloneNode(true) as HTMLStyleElement | HTMLLinkElement;
      if (copy instanceof HTMLLinkElement) {
        copy.href = (source as HTMLLinkElement).href;
        return new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('PDF stylesheet loading timed out.')), 10000);
          copy.onload = () => { clearTimeout(timer); resolve(); };
          copy.onerror = () => { clearTimeout(timer); reject(new Error('Could not load PDF styles.')); };
          doc.head.appendChild(copy);
        });
      }
      doc.head.appendChild(copy);
      return Promise.resolve();
    }));
    doc.body.style.cssText = 'margin:0;background:white;';
    doc.body.innerHTML = renderToStaticMarkup(createElement(ResumeDocument, { data, id: 'pdf-render' }));
    const element = doc.getElementById('pdf-render')!;
    element.style.margin = '0';
    element.style.boxShadow = 'none';
    // Trigger layout/font requests before waiting for the fonts actually used.
    element.getBoundingClientRect();
    if (doc.fonts) await doc.fonts.ready;
    const rect = element.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (element.scrollWidth > Math.ceil(width) + 1) {
      throw new Error('Resume content exceeds the page width. Shorten long fields or reduce the font size before exporting.');
    }
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight() * width / pageWidth;
    const rows = Array.from(element.querySelectorAll('[data-pdf-row], h2, li')).map(row => {
      const bounds = row.getBoundingClientRect();
      let bottom = bounds.bottom;
      if (row.tagName === 'H2') {
        // Keep a heading with its first entry, including decorated heading wrappers.
        const section = row.parentElement?.querySelector('[data-pdf-row]') ? row.parentElement : row.parentElement?.parentElement;
        const firstRow = section?.querySelector('[data-pdf-row]');
        if (firstRow) bottom = Math.max(bottom, firstRow.getBoundingClientRect().bottom);
      }
      return { top: bounds.top - rect.top, bottom: bottom - rect.top };
    });
    const slices = paginateVisual(height, pageHeight, rows);
    // Capture one page at a time: a single tall canvas can exceed browser limits.
    for (const [index, slice] of slices.entries()) {
      const canvas = await html2canvas(element, {
        scale: 2, useCORS: true, allowTaint: false, backgroundColor: '#ffffff', logging: false,
        width, height: slice.height, y: slice.top, x: 0,
        windowWidth: Math.ceil(width), windowHeight: 1123, scrollX: 0, scrollY: 0,
      });
      if (!canvas.width || !canvas.height) throw new Error('The PDF page could not be rendered.');
      if (index) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, slice.height * pageWidth / width);
      canvas.width = canvas.height = 0;
    }
    pdf.save(`${fileBase(data)}.pdf`);
  } finally {
    frame.remove();
  }
}

export function getAtsPDFUnsupportedCharacters(data: ResumeData): string[] {
  // jsPDF's built-in Helvetica uses WinAnsi, not a Unicode embedded font.
  return [...new Set(buildTXT(data).match(/[^\t\n\r\x20-\x7e\xa0-\xff\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u2013-\u2014\u2018-\u201a\u201c-\u201e\u2020-\u2022\u2026\u2030\u2039\u203a\u20ac]/gu) || [])];
}

/**
 * ATS-oriented PDF: selectable text, Helvetica, simple linear layout.
 * Prefer this when submitting to applicant tracking systems.
 */
export function exportAtsPDF(data: ResumeData): void {
  const unsupported = getAtsPDFUnsupportedCharacters(data);
  if (unsupported.length) {
    throw new Error(`ATS PDF cannot encode these characters with its built-in font: ${unsupported.slice(0, 12).join(' ')}. Use DOCX for selectable Unicode text or Visual PDF for appearance.`);
  }
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }
  };

  const writeWrapped = (text: string, fontSize: number, style: 'normal' | 'bold' | 'italic' = 'normal', color = '#111111') => {
    pdf.setFont('helvetica', style);
    pdf.setFontSize(fontSize);
    pdf.setTextColor(color);
    const lines = pdf.splitTextToSize(text, contentWidth) as string[];
    const lineHeight = fontSize * 0.4;
    if (lines.length * lineHeight <= pageHeight - margin * 2) ensureSpace(lines.length * lineHeight + 1);
    for (const line of lines) {
      ensureSpace(lineHeight + 1);
      pdf.text(line, margin, y);
      y += lineHeight;
    }
  };

  const sectionTitle = (title: string) => {
    ensureSpace(20);
    y += 3;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor('#111111');
    pdf.text(title.toUpperCase(), margin, y);
    y += 2;
    pdf.setDrawColor(40);
    pdf.setLineWidth(0.3);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 5;
  };

  const { personalInfo, sections, sectionOrder } = data;

  // Name
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor('#111111');
  const name = personalInfo.name || 'Your Name';
  for (const line of pdf.splitTextToSize(name, contentWidth) as string[]) {
    ensureSpace(8);
    pdf.text(line, (pageWidth - pdf.getTextWidth(line)) / 2, y);
    y += 8;
  }

  // Contact
  const contact = [
    personalInfo.email,
    personalInfo.phone,
    personalInfo.location,
    personalInfo.linkedin,
    personalInfo.github,
    personalInfo.website,
  ]
    .filter(Boolean)
    .join('  |  ');
  if (contact) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor('#333333');
    const contactLines = pdf.splitTextToSize(contact, contentWidth) as string[];
    for (const line of contactLines) {
      ensureSpace(5);
      const w = pdf.getTextWidth(line);
      pdf.text(line, (pageWidth - w) / 2, y);
      y += 4;
    }
  }
  y += 2;

  if (personalInfo.summary?.trim()) {
    sectionTitle('Summary');
    writeWrapped(personalInfo.summary.trim(), 10);
    y += 2;
  }

  for (const section of sectionOrder) {
    if (!section.visible) continue;

    switch (section.type) {
      case 'experience': {
        if (!sections.experience.length) break;
        sectionTitle(section.name);
        for (const exp of sections.experience) {
          ensureSpace(16);
          writeWrapped(`${exp.company}${exp.position ? ` — ${exp.position}` : ''}`, 11, 'bold');
          const dates = `${fmtDate(exp.startDate)} – ${exp.current ? 'Present' : fmtDate(exp.endDate)}`;
          const loc = exp.location ? `  |  ${exp.location}` : '';
          writeWrapped(dates + loc, 9, 'italic', '#444444');
          for (const ach of exp.achievements.filter((a) => a.trim())) {
            writeWrapped(`• ${ach.trim()}`, 10);
          }
          if (exp.technologies?.trim()) {
            writeWrapped(`Technologies: ${exp.technologies.trim()}`, 9, 'normal', '#333333');
          }
          y += 3;
        }
        break;
      }
      case 'education': {
        if (!sections.education.length) break;
        sectionTitle(section.name);
        for (const edu of sections.education) {
          ensureSpace(12);
          writeWrapped(edu.institution, 11, 'bold');
          const degreeLine = [edu.degree, edu.field ? `in ${edu.field}` : '', edu.gpa ? `GPA: ${edu.gpa}` : '']
            .filter(Boolean)
            .join(' · ');
          if (degreeLine) writeWrapped(degreeLine, 10);
          writeWrapped(`${fmtDate(edu.startDate)} – ${fmtDate(edu.endDate)}`, 9, 'italic', '#444444');
          if (edu.coursework?.trim()) writeWrapped(`Coursework: ${edu.coursework.trim()}`, 9);
          if (edu.honors?.trim()) writeWrapped(`Honors: ${edu.honors.trim()}`, 9);
          y += 2;
        }
        break;
      }
      case 'skills': {
        if (!sections.skills.length) break;
        sectionTitle(section.name);
        for (const s of sections.skills) {
          if (!s.skills?.trim()) continue;
          writeWrapped(s.category ? `${s.category}: ${s.skills}` : s.skills, 10);
        }
        y += 2;
        break;
      }
      case 'projects': {
        if (!sections.projects.length) break;
        sectionTitle(section.name);
        for (const proj of sections.projects) {
          ensureSpace(12);
          writeWrapped(`${proj.title}${proj.year ? ` (${proj.year})` : ''}`, 11, 'bold');
          if (proj.description?.trim()) writeWrapped(proj.description.trim(), 10);
          if (proj.technologies?.trim()) writeWrapped(`Technologies: ${proj.technologies.trim()}`, 9);
          if (proj.url?.trim()) writeWrapped(proj.url.trim(), 9, 'normal', '#333333');
          y += 2;
        }
        break;
      }
      case 'awards': {
        if (!sections.awards.length) break;
        sectionTitle(section.name);
        for (const aw of sections.awards) {
          writeWrapped(`${aw.title}${aw.issuer ? ` — ${aw.issuer}` : ''}${aw.date ? ` (${aw.date})` : ''}`, 10, 'bold');
          if (aw.description?.trim()) writeWrapped(aw.description.trim(), 10);
          y += 1;
        }
        break;
      }
      case 'certifications': {
        if (!sections.certifications.length) break;
        sectionTitle(section.name);
        for (const cert of sections.certifications) {
          writeWrapped(`${cert.name}${cert.issuer ? ` — ${cert.issuer}` : ''}${cert.date ? ` (${cert.date})` : ''}`, 10);
          if (cert.expiryDate?.trim()) writeWrapped(`Expires: ${cert.expiryDate.trim()}`, 9);
          if (cert.credentialId?.trim()) writeWrapped(`Credential ID: ${cert.credentialId.trim()}`, 9);
        }
        y += 2;
        break;
      }
      case 'custom': {
        const cs = sections.custom.find((c) => c.id === section.id);
        if (!cs || !cs.entries.length) break;
        sectionTitle(cs.name);
        for (const entry of cs.entries) {
          if (entry.title?.trim()) writeWrapped(entry.title.trim(), 10, 'bold');
          if (entry.content?.trim()) writeWrapped(entry.content.trim(), 10);
          y += 1;
        }
        break;
      }
      default:
        break;
    }
  }

  pdf.save(`${fileBase(data)}-ats.pdf`);
}
