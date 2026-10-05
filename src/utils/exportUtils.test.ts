import { describe, expect, it } from 'vitest';
import { Packer } from 'docx';
import JSZip from 'jszip';
import { buildDOCX, buildTXT } from './exportUtils';
import { buildMarkdown } from './markdownExport';
import { buildLatex } from './latexExport';
import { fieldValues, fullResume } from '../components/Preview/shared/fieldFidelity.fixture';

describe.each([['TXT', buildTXT], ['Markdown', buildMarkdown], ['LaTeX', buildLatex]] as const)('%s fidelity', (_name, build) => {
  it('preserves all populated fields', () => {
    const output = build(fullResume());
    for (const field of fieldValues) expect(output).toContain(field);
  });
  it('respects hidden sections', () => {
    const data = fullResume();
    data.sectionOrder[0].visible = false;
    data.sectionOrder[6].visible = false;
    expect(build(data)).not.toContain('Summa Cum Laude');
    expect(build(data)).not.toContain('Volunteer content');
  });
});

describe('DOCX fidelity', () => {
  it('packs every field and paragraph pagination settings into document XML', async () => {
    const data = fullResume();
    const archive = await JSZip.loadAsync(await Packer.toBuffer(buildDOCX(data)));
    const xml = await archive.file('word/document.xml')!.async('string');
    for (const field of fieldValues) expect(xml).toContain(field);
    expect(xml).toContain('w:keepNext');
    const styles = await archive.file('word/styles.xml')!.async('string');
    expect(styles).toContain('w:keepLines');
  });
  it('does not export hidden custom content', async () => {
    const data = fullResume();
    data.sectionOrder[6].visible = false;
    const archive = await JSZip.loadAsync(await Packer.toBuffer(buildDOCX(data)));
    expect(await archive.file('word/document.xml')!.async('string')).not.toContain('Volunteer content');
  });
});
