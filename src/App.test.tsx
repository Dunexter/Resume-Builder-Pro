// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blankResumeData } from './data/sampleResume';
import type { ResumeRecord } from './types/resume';

const db = vi.hoisted(() => ({
  migrateFromLocalStorage: vi.fn<typeof import('./db/resumeDB').migrateFromLocalStorage>(),
  loadSettings: vi.fn<typeof import('./db/resumeDB').loadSettings>(),
  listResumes: vi.fn<typeof import('./db/resumeDB').listResumes>(),
  saveResume: vi.fn<typeof import('./db/resumeDB').saveResume>(),
  updateResumeRecord: vi.fn<typeof import('./db/resumeDB').updateResumeRecord>(),
  saveSettings: vi.fn<typeof import('./db/resumeDB').saveSettings>(),
  deleteResume: vi.fn<typeof import('./db/resumeDB').deleteResume>(),
}));
const parser = vi.hoisted(() => ({
  importResumeFromText: vi.fn<typeof import('./utils/resumeImport').importResumeFromText>(),
  buildResumeDataFromParsed: vi.fn<typeof import('./utils/resumeImport').buildResumeDataFromParsed>(),
}));

vi.mock('./db/resumeDB', () => db);
vi.mock('./utils/resumeFileParser', () => ({
  extractResumeFile: vi.fn(), MAX_IMPORT_TEXT_LENGTH: 100_000,
}));
vi.mock('./utils/resumeImport', () => ({ ...parser, MAX_AI_IMPORT_TEXT_LENGTH: 24_000 }));
vi.mock('@vercel/analytics/react', () => ({ Analytics: () => null }));
vi.mock('./components/Layout/Header', () => ({
  default: ({ onToggleMobileSidebar }: { onToggleMobileSidebar: () => void }) => (
    <button onClick={onToggleMobileSidebar}>Toggle sidebar</button>
  ),
}));
vi.mock('./components/Layout/Sidebar', () => ({
  default: ({ mobileOpen }: { mobileOpen: boolean }) => <aside data-mobile-open={mobileOpen} />,
}));
vi.mock('./components/Forms/FormContainer', () => ({ default: () => <div data-testid="editor" /> }));
vi.mock('./components/Preview/PreviewContainer', () => ({ default: () => <div data-testid="preview" /> }));
vi.mock('./components/Modals/TemplateGallery', () => ({ default: () => null }));
vi.mock('./components/Modals/ResumeManager', () => ({ default: () => null }));
vi.mock('./components/Modals/CoverLetterBuilder', () => ({ default: () => null }));
vi.mock('./components/Modals/JobFinderBot', () => ({ default: () => null }));
vi.mock('./components/Modals/VersionHistoryModal', () => ({ default: () => null }));

let container: HTMLDivElement;
let root: Root;
let store: typeof import('./store/store').store;
let actions: typeof import('./store/resumeSlice');
let AppContent: typeof import('./App').AppContent;
let Provider: typeof import('react-redux').Provider;

beforeEach(async () => {
  // App and persistence dispatch to an imported singleton, so a separate test store is insufficient.
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('React', React);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  db.migrateFromLocalStorage.mockResolvedValue(false);
  db.loadSettings.mockResolvedValue(undefined);
  db.listResumes.mockResolvedValue([]);
  db.saveResume.mockResolvedValue(undefined);
  db.saveSettings.mockResolvedValue(undefined);
  ({ store } = await import('./store/store'));
  actions = await import('./store/resumeSlice');
  ({ AppContent } = await import('./App'));
  ({ Provider } = await import('react-redux'));
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  document.documentElement.classList.remove('dark');
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function renderApp() {
  await act(async () => root.render(<Provider store={store}><AppContent /></Provider>));
}

function button(label: string): HTMLButtonElement {
  const match = Array.from(container.querySelectorAll('button')).find(element =>
    element.textContent?.includes(label) || element.getAttribute('aria-label') === label);
  if (!match) throw new Error(`Button not found: ${label}`);
  return match;
}

async function click(label: string) {
  await act(async () => button(label).click());
}

async function emit(name: string) {
  await act(async () => { window.dispatchEvent(new CustomEvent(name)); });
}

function expectNoWrites() {
  expect(db.saveResume).not.toHaveBeenCalled();
  expect(db.updateResumeRecord).not.toHaveBeenCalled();
  expect(db.saveSettings).not.toHaveBeenCalled();
  expect(db.deleteResume).not.toHaveBeenCalled();
}

function record(id: string, updatedAt: string): ResumeRecord {
  return {
    id, name: `Resume ${id}`, createdAt: updatedAt, updatedAt, versions: [],
    jobDescription: `Job for ${id}`,
    data: { ...blankResumeData, personalInfo: { ...blankResumeData.personalInfo, name: id } },
  };
}

describe('AppContent integration', () => {
  it('waits for storage and offers onboarding without writing a default document', async () => {
    let finishMigration!: () => void;
    db.migrateFromLocalStorage.mockReturnValueOnce(new Promise(resolve => { finishMigration = () => resolve(false); }));
    await renderApp();
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Loading workspace...');
    expect(db.listResumes).not.toHaveBeenCalled();
    expectNoWrites();

    await act(async () => finishMigration());
    expect(container.querySelector('#welcome-title')).not.toBeNull();
    expect(db.migrateFromLocalStorage).toHaveBeenCalledWith(actions.DEFAULT_RESUME_ID);
    expect(store.getState().resume.hydrated).toBe(false);
    expect(store.getState().resume.resumeList).toEqual([]);
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expectNoWrites();
  });

  it('hydrates a new blank document only after its initial save succeeds', async () => {
    let finishSave!: () => void;
    db.saveResume.mockReturnValueOnce(new Promise(resolve => { finishSave = resolve; }));
    await renderApp();
    await click('Start blank');
    expect(db.saveResume).toHaveBeenCalledOnce();
    const saved = db.saveResume.mock.calls[0][0];
    expect(saved).toMatchObject({ name: 'My Resume', data: blankResumeData, versions: [] });
    expect(saved.id).not.toBe(actions.DEFAULT_RESUME_ID);
    expect(store.getState().resume.hydrated).toBe(false);
    expect(container.querySelector('#welcome-title')).not.toBeNull();

    await act(async () => finishSave());
    expect(container.querySelector('#welcome-title')).toBeNull();
    expect(store.getState().resume).toMatchObject({
      hydrated: true, activeResumeId: saved.id, activeSection: 'personal',
      data: blankResumeData, saveStatus: 'saved', history: { past: [], future: [] },
    });
    expect(store.getState().resume.resumeList).toEqual([
      expect.objectContaining({ id: saved.id, name: 'My Resume' }),
    ]);
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(db.saveResume).toHaveBeenCalledOnce();
    expect(db.updateResumeRecord).not.toHaveBeenCalled();
  });

  it('keeps onboarding unhydrated when creation fails and permits another choice', async () => {
    db.saveResume.mockRejectedValueOnce(new Error('Storage is full'));
    await renderApp();
    await click('Start blank');
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Storage is full');
    expect(container.querySelector('#welcome-title')).not.toBeNull();
    expect(store.getState().resume.hydrated).toBe(false);
    await click('Start blank');
    expect(db.saveResume).toHaveBeenCalledTimes(2);
    expect(store.getState().resume.hydrated).toBe(true);
    expect(container.querySelector('#welcome-title')).toBeNull();
  });

  it('loads the newest persisted document and settings without retaining undo or redo history', async () => {
    const older = record('older', '2026-01-01T00:00:00.000Z');
    const newest = record('newest', '2026-02-01T00:00:00.000Z');
    db.listResumes.mockResolvedValue([older, newest]);
    db.loadSettings.mockResolvedValue({
      darkMode: true, autoSave: true, ai: { provider: 'none', apiKey: '', model: '' },
    });
    store.dispatch(actions.updatePersonalInfo({ name: 'Unrelated edit' }));
    store.dispatch(actions.updatePersonalInfo({ name: 'Another edit' }));
    store.dispatch(actions.undo());
    expect(store.getState().resume.history.past).toHaveLength(1);
    expect(store.getState().resume.history.future).toHaveLength(1);

    await renderApp();
    expect(container.querySelector('#welcome-title')).toBeNull();
    expect(store.getState().resume).toMatchObject({
      hydrated: true, activeResumeId: newest.id, data: newest.data,
      jobDescription: newest.jobDescription, lastSaved: newest.updatedAt,
      history: { past: [], future: [] }, saveStatus: 'saved',
    });
    expect(store.getState().resume.resumeList.map(item => item.id)).toEqual(['older', 'newest']);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expectNoWrites();
    await act(async () => { store.dispatch(actions.undo()); store.dispatch(actions.redo()); });
    expect(store.getState().resume.data).toEqual(newest.data);
  });

  it('shows a storage startup error and retries loading without deleting or creating data', async () => {
    const saved = record('recovered', '2026-03-01T00:00:00.000Z');
    db.listResumes.mockRejectedValueOnce(new Error('Browser storage unavailable')).mockResolvedValue([saved]);
    await renderApp();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Browser storage unavailable');
    expect(container.textContent).toContain('Your saved data has not been deleted');
    expect(container.querySelector('#welcome-title')).toBeNull();
    expect(store.getState().resume.hydrated).toBe(false);
    expectNoWrites();

    await click('Retry');
    expect(db.migrateFromLocalStorage).toHaveBeenCalledTimes(2);
    expect(db.listResumes).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(store.getState().resume).toMatchObject({ hydrated: true, activeResumeId: saved.id });
    expectNoWrites();
  });

  it('opens import from the welcome event and returns to welcome on cancel without writes', async () => {
    await renderApp();
    await click('Import Resume');
    expect(container.querySelector('#welcome-title')).toBeNull();
    expect(container.querySelector('#resume-import-title')).not.toBeNull();
    await click('Cancel');
    expect(container.querySelector('#resume-import-title')).toBeNull();
    expect(container.querySelector('#welcome-title')).not.toBeNull();
    expect(store.getState().resume.hydrated).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expectNoWrites();
  });

  it('creates a new hydrated document from a reviewed welcome import and dismisses onboarding', async () => {
    const imported = record('Imported person', '2026-03-01T00:00:00.000Z').data;
    parser.importResumeFromText.mockResolvedValue({ data: imported, usedAI: false, warnings: [], unmappedText: '' });
    parser.buildResumeDataFromParsed.mockReturnValue(imported);
    await renderApp();
    await emit('open-resume-import');
    const source = container.querySelector('textarea')!;
    await act(async () => { source.value = 'Imported person'; Simulate.change(source); });
    await click('Parse and review');
    expect(parser.importResumeFromText).toHaveBeenCalledWith(
      'Imported person', store.getState().resume.settings.ai, { useAI: false },
    );
    expect(button('Create new resume').disabled).toBe(true);
    expectNoWrites();
    const review = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
      .find(input => input.closest('label')?.textContent?.includes('I reviewed'))!;
    await act(async () => { review.checked = true; Simulate.change(review); });
    await click('Create new resume');
    expect(db.saveResume).toHaveBeenCalledOnce();
    const saved = db.saveResume.mock.calls[0][0];
    expect(saved).toMatchObject({ name: 'Imported resume', data: imported, versions: [] });
    expect(saved.id).not.toBe(actions.DEFAULT_RESUME_ID);
    expect(store.getState().resume).toMatchObject({
      hydrated: true, activeResumeId: saved.id, data: imported, activeSection: 'personal',
      history: { past: [], future: [] },
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(button('Edit').getAttribute('aria-pressed')).toBe('true');
    expect(db.updateResumeRecord).not.toHaveBeenCalled();
  });

  it('switches mobile Preview to Edit and closes the sidebar on resume-navigate-edit', async () => {
    db.listResumes.mockResolvedValue([record('existing', '2026-03-01T00:00:00.000Z')]);
    await renderApp();
    await click('Preview');
    await click('Toggle sidebar');
    expect(button('Preview').getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('aside')?.getAttribute('data-mobile-open')).toBe('true');
    expect(container.querySelector('[data-testid="editor"]')?.parentElement?.classList.contains('hidden')).toBe(true);
    expect(container.querySelector('[data-testid="preview"]')?.parentElement?.classList.contains('hidden')).toBe(false);

    await emit('resume-navigate-edit');
    expect(button('Edit').getAttribute('aria-pressed')).toBe('true');
    expect(button('Preview').getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('aside')?.getAttribute('data-mobile-open')).toBe('false');
    // jsdom cannot evaluate Tailwind breakpoints; assert the responsive wrapper contract instead.
    expect(container.querySelector('[data-testid="editor"]')?.parentElement?.classList.contains('hidden')).toBe(false);
    expect(container.querySelector('[data-testid="preview"]')?.parentElement?.classList.contains('hidden')).toBe(true);
    expectNoWrites();
  });
});
