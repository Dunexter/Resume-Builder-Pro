// @vitest-environment jsdom
import { Packer } from 'docx';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportCoverLetter } from './coverLetterExport';

const pdfSave = vi.hoisted(() => vi.fn());
vi.mock('jspdf', async importOriginal => {
  const { default: ActualPDF } = await importOriginal<typeof import('jspdf')>();
  return { default: vi.fn(function (...args: ConstructorParameters<typeof ActualPDF>) {
    const pdf = new ActualPDF(...args);
    pdf.save = pdfSave;
    return pdf;
  }) };
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:letter'), revokeObjectURL: vi.fn() });
});
afterEach(() => {
  vi.runAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('cover letter download lifecycle', () => {
  it('downloads exact UTF-8 text using a safe filename and releases its URL after the click', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.isConnected).toBe(true);
      expect(this.download).toBe('cover_letter_Example-Test--.txt');
      expect(this.href).toBe('blob:letter');
      expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    });
    const text = 'Dear \u5f20\u4f1f,\r\n\r\nMy edited letter \ud83d\udc4b';
    await exportCoverLetter(text, 'Example/Test?\u0001', 'txt');
    expect(click).toHaveBeenCalledOnce();
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    expect(blob.type).toBe('text/plain;charset=utf-8');
    const read = new Promise<string>(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(blob);
    });
    expect(await read).toBe(text);
    expect(document.querySelector('a[download]')).toBeNull();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:letter');
  });

  it('downloads a packed DOCX and bounds the filename', async () => {
    const blob = new Blob(['packed'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    vi.spyOn(Packer, 'toBlob').mockResolvedValue(blob);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe(`cover_letter_${'a'.repeat(80)}.docx`);
    });
    await exportCoverLetter('Unicode \u5f20\u4f1f', 'a'.repeat(500), 'docx');
    expect(Packer.toBlob).toHaveBeenCalledOnce();
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledOnce();
  });

  it('cleans up a failed browser download and propagates packing failures', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { throw new Error('Download blocked'); });
    await expect(exportCoverLetter('Letter', '', 'txt')).rejects.toThrow('Download blocked');
    expect(document.querySelector('a[download]')).toBeNull();
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:letter');
    vi.mocked(URL.createObjectURL).mockClear();
    vi.spyOn(Packer, 'toBlob').mockRejectedValue(new Error('Packing failed'));
    await expect(exportCoverLetter('Letter', '', 'docx')).rejects.toThrow('Packing failed');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('saves valid PDFs but never downloads unsupported, empty or oversized content', async () => {
    await exportCoverLetter('Dear team,\n\nLetter content.', '  ', 'pdf');
    expect(pdfSave).toHaveBeenCalledWith('cover_letter_application.pdf');
    pdfSave.mockClear();
    await expect(exportCoverLetter('\u5f20\u4f1f', 'Example', 'pdf')).rejects.toThrow('Use DOCX');
    await expect(exportCoverLetter('a'.repeat(50001), '', 'pdf')).rejects.toThrow('50,000');
    await expect(exportCoverLetter(' \n', '', 'docx')).rejects.toThrow('Write a cover letter');
    expect(pdfSave).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
