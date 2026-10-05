import { Document, Packer, Paragraph, Tab, TextRun } from 'docx';
import jsPDF from 'jspdf';

export type CoverLetterFormat = 'txt' | 'docx' | 'pdf';

export function buildCoverLetterDOCX(content: string): Document {
  return new Document({
    styles: { default: { document: { run: { font: 'Calibri', size: 22 }, paragraph: { spacing: { after: 0, line: 276 } } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } },
      children: content.replace(/\r\n?/g, '\n').split('\n').map(line => new Paragraph({
        widowControl: true,
        children: [new TextRun({ children: line.split('\t').flatMap((part, i) => i ? [new Tab(), part] : [part]) })],
      })),
    }],
  });
}

export function buildCoverLetterPDF(content: string): jsPDF {
  if (!content.trim()) throw new Error('Write a cover letter before exporting.');
  // Bound work before wrapping and reject, never truncate, oversized letters.
  if (content.length > 50000) throw new Error('PDF export is limited to 50,000 characters. Shorten the letter or use DOCX.');
  // The built-in Helvetica font is WinAnsi, not Unicode. Preserve unsupported text via DOCX instead.
  if (/[^\t\n\r\x20-\x7e\xa0-\xff\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u2013-\u2014\u2018-\u201a\u201c-\u201e\u2020-\u2022\u2026\u2030\u2039\u203a\u20ac]/u.test(content)) {
    throw new Error('PDF cannot safely encode some characters in this letter. Use DOCX for full Unicode support; your text has not been changed.');
  }
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
  pdf.setProperties({ title: 'Cover Letter', creator: 'Resume Builder Pro' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(30, 30, 30);
  const margin = 54;
  const lineHeight = 16;
  const width = pdf.internal.pageSize.getWidth() - margin * 2;
  const linesPerPage = Math.floor((pdf.internal.pageSize.getHeight() - margin * 2) / lineHeight);
  const lines: string[] = [];
  for (const paragraph of content.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n')) {
    const wrapped: string[] = paragraph ? pdf.splitTextToSize(paragraph, width) : [''];
    if (lines.length + wrapped.length > linesPerPage * 20) {
      throw new Error('PDF export is limited to 20 pages. Shorten the letter or use DOCX.');
    }
    if (wrapped.some(line => pdf.getTextWidth(line) > width + 0.1)) {
      throw new Error('Some letter text exceeds the PDF page width. Shorten long words or use DOCX.');
    }
    lines.push(...wrapped);
  }
  for (let index = 0; index < lines.length; index++) {
    if (index > 0 && index % linesPerPage === 0) pdf.addPage();
    pdf.text(lines[index], margin, margin + 11 + (index % linesPerPage) * lineHeight);
  }
  return pdf;
}

export async function exportCoverLetter(content: string, company: string, format: CoverLetterFormat): Promise<void> {
  if (!content.trim()) throw new Error('Write a cover letter before exporting.');
  const safeCompany = Array.from(company.trim().replace(/[/\\?%*:|"<>]/g, '-'))
    .map(character => character.codePointAt(0)! < 32 || character === '\u007f' ? '-' : character)
    .slice(0, 80).join('').replace(/[. ]+$/, '') || 'application';
  const filename = `cover_letter_${safeCompany}.${format}`;
  if (format === 'pdf') {
    buildCoverLetterPDF(content).save(filename);
    return;
  }
  const blob = format === 'docx'
    ? await Packer.toBlob(buildCoverLetterDOCX(content))
    : new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  try {
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    // Leave time for the browser to consume the download before revoking its URL.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
