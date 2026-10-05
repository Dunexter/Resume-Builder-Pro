// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import html2canvas from 'html2canvas';
import { exportAtsPDF, exportVisualPDF, getAtsPDFUnsupportedCharacters, paginateVisual } from './pdfExport';
import { fieldValues, fullResume } from '../components/Preview/shared/fieldFidelity.fixture';

const pdf = vi.hoisted(() => ({
  internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
  addPage: vi.fn(), addImage: vi.fn(), save: vi.fn(), setFont: vi.fn(), setFontSize: vi.fn(),
  setTextColor: vi.fn(), setDrawColor: vi.fn(), setLineWidth: vi.fn(), line: vi.fn(),
  text: vi.fn(), getTextWidth: (s: string) => s.length,
  splitTextToSize: (s: string) => s.split('\n'),
}));
vi.mock('jspdf', () => ({ default: vi.fn(function () { return pdf; }) }));
vi.mock('html2canvas', () => ({ default: vi.fn() }));

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

describe('visual pagination', () => {
  it('covers every pixel beyond 31 pages', () => {
    const slices = paginateVisual(40001, 1000);
    expect(slices).toHaveLength(41);
    expect(slices.reduce((n, s) => n + s.height, 0)).toBe(40001);
    expect(slices[slices.length - 1]).toEqual({ top: 40000, height: 1 });
  });
  it('moves a crossing row intact onto the next page', () => {
    expect(paginateVisual(1900, 1000, [{ top: 900, bottom: 1100 }])).toEqual([
      { top: 0, height: 900 }, { top: 900, height: 1000 },
    ]);
  });
  it('progresses through oversized rows and rejects invalid dimensions', () => {
    expect(paginateVisual(3000, 1000, [{ top: 0, bottom: 2500 }])).toHaveLength(3);
    expect(() => paginateVisual(100, 0)).toThrow('Invalid');
    expect(() => paginateVisual(Infinity, 100)).toThrow('Invalid');
    expect(paginateVisual(1122.52, 1122.51)).toHaveLength(1);
  });
});

describe('ATS PDF', () => {
  it('writes all populated fields and honors visibility', () => {
    exportAtsPDF(fullResume());
    const output = pdf.text.mock.calls.map(call => call[0]).join('\n');
    for (const field of fieldValues) expect(output).toContain(field);
    const data = fullResume();
    data.sectionOrder[0].visible = false;
    pdf.text.mockClear();
    exportAtsPDF(data);
    expect(pdf.text.mock.calls.flat().join(' ')).not.toContain('Summa Cum Laude');
  });
  it('refuses unsupported Unicode instead of saving corrupted text', () => {
    const data = fullResume();
    data.personalInfo.name = '\u5f20\u4f1f';
    expect(getAtsPDFUnsupportedCharacters(data)).toEqual(['\u5f20', '\u4f1f']);
    expect(() => exportAtsPDF(data)).toThrow('Use DOCX');
    expect(pdf.save).not.toHaveBeenCalled();
    data.personalInfo.name = 'Ren\u00e9e';
    expect(getAtsPDFUnsupportedCharacters(data)).toEqual([]);
  });
});

describe('isolated visual PDF', () => {
  function mockFrame(height = 1122.5) {
    const create = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      const node = create(tag);
      if (tag === 'iframe') {
        const append = document.body.appendChild.bind(document.body);
        vi.spyOn(document.body, 'appendChild').mockImplementation(((child: Node) => {
          const result = append(child);
          if (child === node) {
            const win = (node as HTMLIFrameElement).contentWindow!;
            const proto = (win as unknown as { HTMLElement: typeof HTMLElement }).HTMLElement.prototype;
            vi.spyOn(proto, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
              return { width: 793.6868687, height: this.id === 'pdf-render' ? height : 0, top: 0, bottom: 0, left: 0, right: 793.6868687, x: 0, y: 0, toJSON() {} };
            });
          }
          return result;
        }) as typeof document.body.appendChild);
      }
      return node;
    }) as typeof document.createElement);
  }
  it('renders data without a mounted preview and cleans up its isolated document', async () => {
    mockFrame();
    vi.mocked(html2canvas).mockImplementation(async element => {
      expect(element.ownerDocument).not.toBe(document);
      expect(element.textContent).toContain('Summa Cum Laude');
      expect(element.id).toBe('pdf-render');
      return { width: 1588, height: 2245, toDataURL: () => 'data:image/png;base64,test' } as HTMLCanvasElement;
    });
    await exportVisualPDF(fullResume());
    expect(html2canvas).toHaveBeenCalledTimes(1);
    expect(pdf.save).toHaveBeenCalledWith('Test Person.pdf');
    expect(document.querySelector('iframe')).toBeNull();
  });
  it('exports more than 31 pages, ignoring a hidden and zoomed on-screen ancestor', async () => {
    document.body.innerHTML = '<div style="display:none;transform:scale(.2)"><div id="resume-preview">STALE</div></div>';
    mockFrame(40000);
    vi.mocked(html2canvas).mockImplementation(async element => {
      expect(element.textContent).not.toContain('STALE');
      return { width: 1588, height: 2245, toDataURL: () => 'data:image/png;base64,test' } as HTMLCanvasElement;
    });
    await exportVisualPDF(fullResume());
    expect(html2canvas).toHaveBeenCalledTimes(36);
    expect(pdf.addPage).toHaveBeenCalledTimes(35);
    expect(pdf.save).toHaveBeenCalledTimes(1);
  });
  it('cleans up and does not save a partial document after capture failure', async () => {
    mockFrame();
    vi.mocked(html2canvas).mockRejectedValue(new Error('capture failed'));
    await expect(exportVisualPDF(fullResume())).rejects.toThrow('capture failed');
    expect(document.querySelector('iframe')).toBeNull();
    expect(pdf.save).not.toHaveBeenCalled();
  });
});
