// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Header from './Header';
import { initialResumeData } from '../../store/resumeSlice';

const mocks = vi.hoisted(() => ({
  state: {} as Record<string, unknown>, dispatch: vi.fn(), flush: vi.fn(), validate: vi.fn(),
  ats: vi.fn(), visual: vi.fn(), docx: vi.fn(), txt: vi.fn(), markdown: vi.fn(), latex: vi.fn(),
}));
vi.mock('../../hooks', () => ({ useAppSelector: (select: (state: unknown) => unknown) => select(mocks.state), useAppDispatch: () => mocks.dispatch }));
vi.mock('../../utils/editorPersistence', () => ({ flushEditor: mocks.flush }));
vi.mock('../../utils/validationUtils', () => ({ validateResumeForExport: mocks.validate, formatValidationMessage: () => 'Validation details' }));
vi.mock('../../utils/pdfExport', () => ({ exportAtsPDF: mocks.ats, exportVisualPDF: mocks.visual }));
vi.mock('../../utils/exportUtils', () => ({ exportDOCX: mocks.docx, exportTXT: mocks.txt }));
vi.mock('../../utils/markdownExport', () => ({ exportMarkdown: mocks.markdown }));
vi.mock('../../utils/latexExport', () => ({ exportLatex: mocks.latex }));

let container: HTMLDivElement;
let root: Root;
const onManager = vi.fn();
const onVersions = vi.fn();
const button = (label: string) => Array.from(container.querySelectorAll('button')).find(item => item.textContent === label)!;
const render = async () => { await act(async () => root.render(createElement(Header, { onOpenResumeManager: onManager, onOpenVersions: onVersions }))); };
const click = async (label: string) => { await act(async () => button(label).click()); };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mocks.flush.mockResolvedValue(undefined);
  mocks.validate.mockReturnValue([]);
  mocks.state = { resume: {
    data: initialResumeData, activeResumeId: 'a', resumeList: [{ id: 'a', name: 'Application for Acme' }],
    settings: { darkMode: false }, hydrated: true, saveStatus: 'saved', saveError: null,
    history: { past: [], future: [] }, lastSaved: '2026-09-29T12:00:00Z',
  } };
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

const formats = ['PDF (ATS)', 'PDF (Visual)', 'Word (.docx)', 'Plain Text', 'Markdown (.md)', 'LaTeX (.tex)'];
describe('Header', () => {
  it.each(formats)('cancels validation warnings for %s without getting stuck exporting', async format => {
    mocks.validate.mockReturnValue([{ level: 'warn' }]);
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
    await render(); await click('Export'); await click(format);
    expect(button('Export').disabled).toBe(false);
    expect(button('Export').getAttribute('aria-expanded')).toBe('false');
    expect(mocks.flush).not.toHaveBeenCalled();
    expect([mocks.ats, mocks.visual, mocks.docx, mocks.txt, mocks.markdown, mocks.latex].every(fn => !fn.mock.calls.length)).toBe(true);
  });

  it.each(formats)('blocks validation errors for %s before saving or exporting', async format => {
    mocks.validate.mockReturnValue([{ level: 'error' }]);
    await render(); await click('Export'); await click(format);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Validation details');
    expect(button('Export').disabled).toBe(false);
    expect(mocks.flush).not.toHaveBeenCalled();
  });

  it.each(formats)('catches exporter errors for %s and clears busy state', async format => {
    for (const fn of [mocks.ats, mocks.visual, mocks.docx, mocks.txt, mocks.markdown, mocks.latex]) fn.mockRejectedValue(new Error('Download failed'));
    await render(); await click('Export'); await click(format);
    expect(mocks.flush).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Download failed');
    expect(button('Export').disabled).toBe(false);
  });

  it('keeps every tool in a wrapping, non-hidden mobile navigation row', async () => {
    vi.stubGlobal('innerWidth', 320);
    await render();
    const nav = container.querySelector('nav[aria-label="Resume tools"]')!;
    expect(nav.classList.contains('flex-wrap')).toBe(true);
    expect(nav.classList.contains('max-w-full')).toBe(true);
    for (const label of ['My Resumes', 'Versions', 'Templates', 'Cover Letter', 'Find Jobs']) {
      expect(nav.contains(button(label))).toBe(true);
      expect(button(label).closest('.hidden')).toBeNull();
    }
    expect(container.querySelector('[aria-label="Document name"]')?.textContent).toBe('Application for Acme');
  });

  it('allows downloading current edits when browser storage is unavailable', async () => {
    mocks.flush.mockRejectedValue(new Error('Storage unavailable'));
    Object.assign(mocks.state.resume as object, { saveStatus: 'error', saveError: 'Storage full' });
    await render(); await click('Export'); await click('Word (.docx)');
    expect(mocks.docx).toHaveBeenCalledWith(initialResumeData);
    expect(mocks.flush).not.toHaveBeenCalled();
    expect(button('Export').disabled).toBe(false);
  });

  it('closes export with Escape and returns focus to its trigger', async () => {
    await render(); await click('Export');
    expect(document.activeElement).toBe(button('PDF (ATS)'));
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(container.querySelector('[aria-label="Export formats"]')).toBeNull();
    expect(document.activeElement).toBe(button('Export'));
  });

  it('shows save status/errors and retries through flushEditor without renaming', async () => {
    Object.assign(mocks.state.resume as object, { saveStatus: 'error', saveError: 'Storage full' });
    await render();
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Save failed');
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Storage full');
    await click('Retry save');
    expect(mocks.flush).toHaveBeenCalledOnce();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it('waits for persistence before opening tools and keeps them closed on failure', async () => {
    mocks.flush.mockRejectedValueOnce(new Error('Storage unavailable'));
    await render(); await click('My Resumes');
    expect(onManager).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Storage unavailable');
    await click('My Resumes');
    expect(onManager).toHaveBeenCalledOnce();
    expect(mocks.flush.mock.invocationCallOrder[1]).toBeLessThan(onManager.mock.invocationCallOrder[0]);
  });

  it('disables saves, exports and tools before hydration', async () => {
    Object.assign(mocks.state.resume as object, { hydrated: false });
    await render();
    for (const label of ['Save', 'Export', 'My Resumes', 'Versions', 'Templates', 'Cover Letter', 'Find Jobs']) expect(button(label).disabled).toBe(true);
  });
});
