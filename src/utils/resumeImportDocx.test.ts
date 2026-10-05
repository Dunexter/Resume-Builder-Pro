// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { Document, Packer, Paragraph } from 'docx';
import { docxHtmlToText, extractResumeFile } from './resumeFileParser';
import { importResumeFromText } from './resumeImport';

// Vitest resolves Node's Mammoth entry by default; exercise the same browser bundle as Vite.
vi.mock('mammoth', () => vi.importActual<typeof import('mammoth')>('mammoth/mammoth.browser.js'));

describe('DOCX import', () => {
  it('extracts a real generated DOCX with paragraphs and semantic bullets without network requests', async () => {
    const doc = new Document({ sections: [{ children: [new Paragraph('Jane Doe'), new Paragraph('EXPERIENCE'), new Paragraph('Engineer | Acme | 2020-03 - Present'), new Paragraph({ text: 'Built a reliable service', bullet: { level: 0 } })] }] });
    const buffer = await Packer.toBuffer(doc);
    const arrayBuffer = new Uint8Array(buffer).buffer;
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    try {
      const result = await extractResumeFile({ name: 'resume.docx', size: buffer.length, arrayBuffer: async () => arrayBuffer } as File);
      expect(result.text).toContain('Jane Doe\nEXPERIENCE\nEngineer | Acme | 2020-03 - Present\n- Built a reliable service');
      const imported = await importResumeFromText(result.text, { provider: 'none', apiKey: '' });
      expect(imported.data.sections.experience).toHaveLength(1);
      expect(imported.data.sections.experience[0].achievements).toEqual(['Built a reliable service']);
      expect(fetch).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  }, 15000);

  it('never renders active HTML, images, or link URLs', () => {
    const result = docxHtmlToText('<h1>Jane</h1><p>Hello<br>world</p><ul><li>Built tools</li></ul><img src="https://example.test/tracker"><script>alert(1)</script><p><a href="javascript:alert(1)">Portfolio</a></p>');
    expect(result).toBe('Jane\nHello\nworld\n- Built tools\nPortfolio');
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('script')).toBeNull();
  });

  it('rejects corrupt DOCX archives with actionable guidance', async () => {
    await expect(extractResumeFile({ name: 'broken.docx', size: 3, arrayBuffer: async () => new ArrayBuffer(3) } as File)).rejects.toThrow(/save as TXT/i);
  });

  it('rejects excessive expanded archive sizes before conversion', async () => {
    const buffer = await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph('Jane')] }] }));
    const arrayBuffer = new Uint8Array(buffer).buffer;
    const view = new DataView(arrayBuffer);
    let end = arrayBuffer.byteLength - 22;
    while (view.getUint32(end, true) !== 0x06054b50) end--;
    const directory = view.getUint32(end + 16, true);
    view.setUint32(directory + 24, 31 * 1024 * 1024, true);
    await expect(extractResumeFile({ name: 'oversized.docx', size: buffer.length, arrayBuffer: async () => arrayBuffer } as File)).rejects.toThrow(/30MB safety limit/);
  });
});
