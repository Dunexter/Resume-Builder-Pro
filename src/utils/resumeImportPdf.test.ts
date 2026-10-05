import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractResumeFile } from './resumeFileParser';

const mocks = vi.hoisted(() => ({ getDocument: vi.fn(), destroy: vi.fn(), cleanup: vi.fn() }));
vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {}, getDocument: mocks.getDocument }));
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: 'worker.mjs' }));

const file = { name: 'resume.pdf', size: 1, arrayBuffer: async () => new ArrayBuffer(1) } as File;
afterEach(() => vi.clearAllMocks());

describe('PDF import lifecycle', () => {
  it('cleans up pages and document after extraction', async () => {
    mocks.getDocument.mockReturnValue({ destroy: mocks.destroy, promise: Promise.resolve({ numPages: 1, getPage: async () => ({ cleanup: mocks.cleanup, getTextContent: async () => ({ items: [{ str: 'Jane Doe', transform: [1, 0, 0, 1, 20, 700], width: 40, hasEOL: true }] }) }) }) });
    expect((await extractResumeFile(file)).text).toContain('Jane Doe');
    expect(mocks.cleanup).toHaveBeenCalledOnce();
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });

  it('rejects excessive pages and still destroys the document', async () => {
    mocks.getDocument.mockReturnValue({ destroy: mocks.destroy, promise: Promise.resolve({ numPages: 31 }) });
    await expect(extractResumeFile(file)).rejects.toThrow(/exceeds 30 pages/);
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });

  it('provides scanned guidance and cleans up on empty extraction', async () => {
    mocks.getDocument.mockReturnValue({ destroy: mocks.destroy, promise: Promise.resolve({ numPages: 1, getPage: async () => ({ cleanup: mocks.cleanup, getTextContent: async () => ({ items: [] }) }) }) });
    await expect(extractResumeFile(file)).rejects.toThrow(/OCR/);
    expect(mocks.cleanup).toHaveBeenCalledOnce();
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });

  it('provides encrypted guidance and destroys failed loading tasks', async () => {
    mocks.getDocument.mockImplementation(() => ({ destroy: mocks.destroy, promise: Promise.reject(new Error('Password required')) }));
    await expect(extractResumeFile(file)).rejects.toThrow(/unlock it locally/);
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });
});
