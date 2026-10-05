import { Packer } from 'docx';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildCoverLetterDOCX, buildCoverLetterPDF } from './coverLetterExport';

describe('cover letter DOCX', () => {
  it('preserves Unicode, XML-sensitive text, tabs, blank paragraphs and line endings', async () => {
    const text = 'Dear Ren\u00e9e & team,\r\n\r\n\u5f20\u4f1f \u0645\u0631\u062d\u0628\u0627 \u0928\u092e\u0938\u094d\u0924\u0947 \ud83d\udc4b e\u0301 <Engineer>\rFirst\tSecond\nRegards,\nApplicant';
    const zip = await JSZip.loadAsync(await Packer.toBuffer(buildCoverLetterDOCX(text)));
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('Ren\u00e9e &amp; team');
    expect(xml).toContain('\u5f20\u4f1f \u0645\u0631\u062d\u0628\u0627 \u0928\u092e\u0938\u094d\u0924\u0947 \ud83d\udc4b e\u0301 &lt;Engineer&gt;');
    expect(xml).toContain('<w:tab/>');
    expect(xml.match(/<w:p>/g)).toHaveLength(6);
    expect(xml).toContain('w:widowControl');
    expect(xml).toContain('Applicant');
  });
});

describe('bounded cover letter PDF', () => {
  it('creates a selectable-text PDF with readable margins and every line across pages', () => {
    const lines = Array.from({ length: 120 }, (_, i) => `Letter line ${i + 1}`);
    const pdf = buildCoverLetterPDF(lines.join('\r\n'));
    expect(pdf.getNumberOfPages()).toBe(3);
    // jsPDF types pages as number[], but its runtime representation contains PDF command arrays.
    const pages = (pdf.internal.pages as unknown as string[][]).slice(1);
    const output = pages.flat().join('\n');
    for (const line of lines) expect(output).toContain(`(${line}) Tj`);
    for (const page of pages) {
      for (const match of page.join('\n').matchAll(/([\d.]+) ([\d.]+) Td/g)) {
        expect(Number(match[1])).toBeGreaterThanOrEqual(54);
        expect(Number(match[2])).toBeGreaterThanOrEqual(54);
        expect(Number(match[2])).toBeLessThanOrEqual(pdf.internal.pageSize.getHeight() - 54);
      }
    }
    expect(pdf.output()).toMatch(/^%PDF-/);
  });

  it('wraps paragraphs and long unbroken words without dropping characters', () => {
    const content = 'x'.repeat(1000);
    const pdf = buildCoverLetterPDF(content);
    const runs = [...pdf.internal.pages.flat().join('\n').matchAll(/\((x+)\) Tj/g)].map(match => match[1]);
    expect(runs.length).toBeGreaterThan(1);
    expect(runs.join('')).toBe(content);
    for (const run of runs) expect(pdf.getTextWidth(run)).toBeLessThanOrEqual(pdf.internal.pageSize.getWidth() - 108 + 0.1);
    expect(buildCoverLetterPDF('Dear team,\n\n' + 'A paragraph with spaces. '.repeat(100)).getNumberOfPages()).toBeGreaterThan(0);
  });

  it('supports WinAnsi accents and smart punctuation without claiming general Unicode support', () => {
    const pdf = buildCoverLetterPDF('Ren\u00e9e \u2014 \u201cEngineer\u201d \u20ac \u2022 \u0153');
    expect(pdf.getNumberOfPages()).toBe(1);
    expect((pdf.internal.pages as unknown as string[][])[1].join('\n')).not.toContain('\u0000');
  });

  it.each(['\u5f20\u4f1f', '\u0645\u0631\u062d\u0628\u0627', '\u0928\u092e\u0938\u094d\u0924\u0947', '\ud83d\udc4b', 'e\u0301', '\u0001', '\u2028'])('rejects unsupported text %j with DOCX guidance', text => {
    expect(() => buildCoverLetterPDF(`Letter ${text}`)).toThrow(/Use DOCX/);
  });

  it('rejects empty, excessive character counts and excessive pages, never truncating', () => {
    expect(() => buildCoverLetterPDF(' \n\t')).toThrow(/Write a cover letter/);
    expect(() => buildCoverLetterPDF('a'.repeat(50001))).toThrow(/50,000 characters/);
    const linesPerPage = Math.floor((buildCoverLetterPDF('Test').internal.pageSize.getHeight() - 108) / 16);
    expect(buildCoverLetterPDF(Array(linesPerPage * 20).fill('line').join('\n')).getNumberOfPages()).toBe(20);
    expect(() => buildCoverLetterPDF(Array(linesPerPage * 20 + 1).fill('line').join('\n'))).toThrow(/20 pages/);
  });
});
