// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ResumeManager from './ResumeManager';
import { initialResumeData } from '../../store/resumeSlice';
import { ResumeRecord } from '../../types/resume';

const mocks = vi.hoisted(() => ({
  state: {} as Record<string, unknown>, dispatch: vi.fn(), flush: vi.fn(), open: vi.fn(), create: vi.fn(), delete: vi.fn(),
  list: vi.fn(), load: vi.fn(), save: vi.fn(), update: vi.fn(), settings: vi.fn(),
  exportBackup: vi.fn(), importBackup: vi.fn(), readBackup: vi.fn(),
}));
vi.mock('../../hooks', () => ({ useAppSelector: (select: (state: unknown) => unknown) => select(mocks.state), useAppDispatch: () => mocks.dispatch }));
vi.mock('../../utils/editorPersistence', () => ({ flushEditor: mocks.flush, openEditorRecord: mocks.open, createEditorResume: mocks.create, deleteEditorResume: mocks.delete }));
vi.mock('../../db/resumeDB', () => ({ listResumes: mocks.list, loadResume: mocks.load, saveResume: mocks.save, updateResumeRecord: mocks.update, loadSettings: mocks.settings }));
vi.mock('../../utils/backupUtils', () => ({ exportWorkspaceBackup: mocks.exportBackup, importWorkspaceBackup: mocks.importBackup, readBackupFile: mocks.readBackup }));

let container: HTMLDivElement;
let root: Root;
let records: ResumeRecord[];
const onClose = vi.fn();
const button = (label: string) => Array.from(container.querySelectorAll('button')).find(item => (item.getAttribute('aria-label') || item.textContent) === label)!;
const click = async (label: string) => { await act(async () => button(label).click()); };
const render = async () => { await act(async () => root.render(createElement(ResumeManager, { onClose }))); };
const selectBackup = async () => {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, 'files', { configurable: true, value: [new File(['{}'], 'backup.json')] });
  await act(async () => Simulate.change(input));
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mocks.state = { resume: { activeResumeId: 'a', data: initialResumeData, settings: { darkMode: false }, hydrated: true } };
  records = ['a', 'b'].map(id => ({ id, name: id === 'a' ? 'Acme application' : 'Other resume', data: initialResumeData, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z', versions: [], targetJob: 'Engineer' }));
  mocks.list.mockImplementation(async () => [...records]);
  mocks.load.mockImplementation(async (id: string) => records.find(record => record.id === id));
  mocks.flush.mockResolvedValue(undefined);
  mocks.create.mockResolvedValue(undefined);
  mocks.delete.mockResolvedValue(undefined);
  mocks.update.mockImplementation(async (id: string, update: (record: ResumeRecord) => ResumeRecord) => {
    const index = records.findIndex(record => record.id === id);
    records[index] = update(records[index]);
    return records[index];
  });
  mocks.readBackup.mockResolvedValue({ resumes: records, coverLetters: [], schemaVersion: 1 });
  mocks.importBackup.mockResolvedValue({ resumesImported: 2, coverLettersImported: 0, settingsImported: false });
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

describe('ResumeManager', () => {
  it('opens a fresh record only after flushing the outgoing editor', async () => {
    await render();
    const fresh = { ...records[1], name: 'Updated elsewhere', data: { ...initialResumeData, personalInfo: { ...initialResumeData.personalInfo, name: 'Fresh candidate' } } };
    records[1] = fresh;
    await click('Open Other resume');
    expect(mocks.flush).toHaveBeenCalledOnce();
    expect(mocks.load).toHaveBeenCalledWith('b');
    expect(mocks.open).toHaveBeenCalledWith(fresh);
    expect(mocks.flush.mock.invocationCallOrder[0]).toBeLessThan(mocks.load.mock.invocationCallOrder[0]);
    expect(onClose).toHaveBeenCalledOnce();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('duplicates the latest flushed active data, not the manager list snapshot', async () => {
    await render();
    mocks.flush.mockImplementation(async () => {
      records[0] = { ...records[0], name: 'Latest name', data: { ...initialResumeData, personalInfo: { ...initialResumeData.personalInfo, name: 'Live edit' } } };
    });
    await click('Duplicate Acme application');
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Latest name (copy)', data: records[0].data, targetJob: 'Engineer', versions: [] }));
    expect(mocks.save.mock.calls[0][0].id).not.toBe('a');
    expect(mocks.flush.mock.invocationCallOrder[0]).toBeLessThan(mocks.load.mock.invocationCallOrder[0]);
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it('updates explicit document metadata against the fresh record without replacing data/history', async () => {
    await render(); await click('Edit details for Acme application');
    records[0] = { ...records[0], data: { ...initialResumeData, personalInfo: { ...initialResumeData.personalInfo, name: 'Candidate name' } } };
    const freshData = records[0].data;
    const versions = records[0].versions;
    const fields = container.querySelectorAll<HTMLInputElement>('form input');
    await act(async () => {
      fields[0].value = '  Platform role  '; Simulate.change(fields[0]);
    });
    await act(async () => {
      fields[1].value = '  Senior engineer  '; Simulate.change(fields[1]);
    });
    await act(async () => Simulate.submit(container.querySelector('form')!));
    expect(mocks.update).toHaveBeenCalledWith('a', expect.any(Function));
    expect(records[0].name).toBe('Platform role');
    expect(records[0].targetJob).toBe('Senior engineer');
    expect(records[0].data).toBe(freshData);
    expect(records[0].versions).toBe(versions);
    expect(mocks.open).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.dispatch).toHaveBeenLastCalledWith(expect.objectContaining({ payload: expect.arrayContaining([expect.objectContaining({ name: 'Platform role', targetJob: 'Senior engineer' })]) }));
  });

  it('creates and deletes through the persistence coordinator', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    await render(); await click('Delete Acme application');
    expect(mocks.delete).toHaveBeenCalledWith('a');
    await click('New Resume');
    expect(mocks.create).toHaveBeenCalledWith(initialResumeData, 'New Resume');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('blocks closing and all competing actions while backup export is pending', async () => {
    let finish!: () => void;
    mocks.flush.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
    await render(); await click('Export All');
    for (const item of container.querySelectorAll('button')) expect(item.disabled).toBe(true);
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      (container.querySelector('[role="dialog"]')!.parentElement as HTMLElement).click();
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(mocks.exportBackup).not.toHaveBeenCalled();
    await act(async () => { finish(); });
    expect(mocks.exportBackup).toHaveBeenCalledWith({ includeApiKey: false });
    expect(button('Close resume manager').disabled).toBe(false);
  });

  it('reports persistence failures without switching or closing', async () => {
    mocks.flush.mockRejectedValue(new Error('Storage full'));
    await render(); await click('Open Other resume');
    expect(mocks.open).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Storage full');
    expect(button('Open Other resume').disabled).toBe(false);
  });

  it('lets backup selection be cancelled with no restore, flush, or confirm prompts', async () => {
    const confirm = vi.fn(); vi.stubGlobal('confirm', confirm);
    await render(); await selectBackup();
    expect(container.querySelector('select')?.value).toBe('merge');
    expect(mocks.importBackup).not.toHaveBeenCalled();
    await click('Cancel import');
    expect(mocks.importBackup).not.toHaveBeenCalled();
    expect(mocks.flush).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it.each(['merge', 'replace'])('explicitly selects %s and flushes before restore and fresh reopen', async mode => {
    await render(); await selectBackup();
    const select = container.querySelector('select')!;
    await act(async () => { select.value = mode; Simulate.change(select); });
    await click(mode === 'replace' ? 'Replace all and restore' : 'Merge backup');
    expect(mocks.importBackup).toHaveBeenCalledWith(expect.objectContaining({ resumes: records }), mode);
    expect(mocks.flush.mock.invocationCallOrder[0]).toBeLessThan(mocks.importBackup.mock.invocationCallOrder[0]);
    expect(mocks.open).toHaveBeenCalledWith(records[0]);
    expect(mocks.load.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.importBackup.mock.invocationCallOrder[0]);
  });

  it('keeps restore controls available for retry after failure', async () => {
    mocks.importBackup.mockRejectedValueOnce(new Error('Restore failed'));
    await render(); await selectBackup(); await click('Merge backup');
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Restore failed');
    expect(button('Merge backup').disabled).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it('rejects empty replacement before flushing or mutating the workspace', async () => {
    mocks.readBackup.mockResolvedValue({ resumes: [], coverLetters: [], schemaVersion: 1 });
    await render(); await selectBackup();
    const select = container.querySelector('select')!;
    await act(async () => { select.value = 'replace'; Simulate.change(select); });
    await click('Replace all and restore');
    expect(mocks.importBackup).not.toHaveBeenCalled();
    expect(mocks.flush).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('no resumes');
  });

  it('closes the manager before requesting the document importer', async () => {
    const listener = vi.fn((event: Event) => { expect(onClose).toHaveBeenCalledOnce(); expect(event).toBeInstanceOf(CustomEvent); });
    window.addEventListener('open-resume-import', listener);
    try {
      await render(); await click('Import document');
      expect(mocks.flush).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledOnce();
    } finally { window.removeEventListener('open-resume-import', listener); }
  });
});
