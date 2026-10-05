// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { createSnapshot, deleteVersion, diffResumeData, getVersionData, listVersions, MAX_VERSIONS, renameVersion, restoreVersion } from './versionUtils';
import { ResumeData, ResumeRecord, ResumeState } from '../types/resume';
import { loadResume, updateResumeRecord } from '../db/resumeDB';
import VersionHistoryModal from '../components/Modals/VersionHistoryModal';

const editor = vi.hoisted(() => ({ state: {} as ResumeState, flush: vi.fn(), open: vi.fn() }));
vi.mock('../db/resumeDB', () => ({ loadResume: vi.fn(), updateResumeRecord: vi.fn() }));
vi.mock('../store/store', () => ({ store: { getState: () => ({ resume: editor.state }) } }));
vi.mock('../hooks', () => ({ useAppSelector: (select: (state: { resume: ResumeState }) => unknown) => select({ resume: editor.state }) }));
vi.mock('./editorPersistence', () => ({ flushEditor: editor.flush, openEditorRecord: editor.open }));

const baseResume = (): ResumeData => ({
  personalInfo: {
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '',
    location: '',
    linkedin: '',
    summary: 'Original summary',
  },
  sections: {
    education: [],
    experience: [],
    skills: [{ id: 's1', category: 'Languages', skills: 'TypeScript' }],
    projects: [],
    awards: [],
    certifications: [],
    custom: [],
  },
  sectionOrder: [],
  styling: {
    template: 'professional',
    fontSize: 11,
    fontFamily: 'Arial',
    spacing: 1.2,
    colors: { primary: '#1C033C', secondary: '#371e77', accent: '#6d28d9' },
  },
});

describe('diffResumeData', () => {
  it('returns no diffs for identical data', () => {
    const data = baseResume();
    expect(diffResumeData(data, structuredClone(data))).toEqual([]);
  });

  it('detects a changed primitive field', () => {
    const a = baseResume();
    const b = baseResume();
    b.personalInfo.summary = 'Updated summary';
    const diffs = diffResumeData(a, b);
    expect(diffs.some(d => d.path === 'personalInfo.summary' && d.after === 'Updated summary')).toBe(true);
  });

  it('detects a changed array element', () => {
    const a = baseResume();
    const b = baseResume();
    b.sections.skills[0].skills = 'TypeScript, React';
    const diffs = diffResumeData(a, b);
    expect(diffs.some(d => d.path.includes('sections.skills[0].skills'))).toBe(true);
  });
});

let record: ResumeRecord;
let writes: number;
let beforeUpdate: (() => void) | undefined;
let afterUpdate: (() => void) | undefined;

beforeEach(() => {
  vi.resetAllMocks();
  beforeUpdate = undefined;
  afterUpdate = undefined;
  writes = 0;
  record = {
    id: 'resume', name: 'Resume', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    data: baseResume(), targetJob: 'Engineer', jobDescription: 'TypeScript', jdMatchScore: 80,
    versions: [{ id: 'v1', label: 'Original', createdAt: '2026-01-01T00:00:00Z', data: baseResume() }],
  };
  vi.mocked(loadResume).mockImplementation(async () => structuredClone(record));
  vi.mocked(updateResumeRecord).mockImplementation(async (id, update) => {
    // Model the DB write lock: use the latest record, reject async updaters, commit only on success.
    await Promise.resolve();
    beforeUpdate?.();
    if (id !== record.id) throw new Error(`Resume not found: ${id}`);
    const next = update(structuredClone(record));
    expect(next).not.toBeInstanceOf(Promise);
    record = structuredClone(next);
    writes += 1;
    afterUpdate?.();
    return structuredClone(record);
  });
});

describe('atomic version actions', () => {
  it('snapshots detached caller data without overwriting fresh active data or metadata', async () => {
    const input = baseResume();
    const expected = structuredClone(input);
    beforeUpdate = () => {
      record.data.personalInfo.name = 'Concurrent saved edit';
      record.name = 'Renamed document';
      record.versions.push({ ...record.versions[0], id: 'concurrent' });
    };
    const pending = createSnapshot('resume', input, '  Milestone  ');
    input.personalInfo.name = 'Later mutation';
    const versions = await pending;
    expect(versions[0]).toMatchObject({ label: 'Milestone', data: expected });
    expect(versions.map(v => v.id)).toContain('concurrent');
    expect(record.data.personalInfo.name).toBe('Concurrent saved edit');
    expect(record.name).toBe('Renamed document');
    expect(record.jobDescription).toBe('TypeScript');
    expect(writes).toBe(1);
    expect(loadResume).not.toHaveBeenCalled();
  });

  it('caps snapshots newest first and supplies a label for blank input', async () => {
    record.versions = Array.from({ length: MAX_VERSIONS }, (_, i) => ({ ...record.versions[0], id: `v${i}` }));
    const result = await createSnapshot('resume', baseResume(), '  ');
    expect(result).toHaveLength(MAX_VERSIONS);
    expect(result[0].label).toMatch(/^Snapshot /);
    expect(result[result.length - 1].id).toBe(`v${MAX_VERSIONS - 2}`);
  });

  it.each(['delete', 'rename'] as const)('%s uses the latest record without replacing data or other versions', async action => {
    beforeUpdate = () => {
      record.data.personalInfo.name = 'Fresh data';
      record.versions.push({ ...record.versions[0], id: 'v2', label: 'Concurrent' });
    };
    const versions = action === 'delete' ? await deleteVersion('resume', 'v1') : await renameVersion('resume', 'v1', '  New label  ');
    expect(record.data.personalInfo.name).toBe('Fresh data');
    expect(record.targetJob).toBe('Engineer');
    expect(versions.find(v => v.id === 'v2')?.label).toBe('Concurrent');
    expect(versions.find(v => v.id === 'v1')?.label).toBe(action === 'delete' ? undefined : 'New label');
    expect(writes).toBe(1);
    expect(loadResume).not.toHaveBeenCalled();
  });

  it('retains an existing label on blank rename', async () => {
    expect((await renameVersion('resume', 'v1', '  '))[0].label).toBe('Original');
  });

  it('does not lose overlapping history updates', async () => {
    await Promise.all([createSnapshot('resume', baseResume(), 'New'), renameVersion('resume', 'v1', 'Renamed')]);
    expect(record.versions.map(v => v.label)).toEqual(['New', 'Renamed']);
  });

  it('restores the oldest snapshot at capacity and keeps a safety snapshot', async () => {
    const oldest = baseResume();
    oldest.personalInfo.name = 'Oldest';
    record = {
      ...record,
      id: 'resume', name: 'Resume', createdAt: '2026-01-01', updatedAt: '2026-01-01', data: baseResume(),
      versions: Array.from({ length: MAX_VERSIONS }, (_, i) => ({
        id: `v${i}`, label: `Version ${i}`, createdAt: '2026-01-01', data: i === MAX_VERSIONS - 1 ? oldest : baseResume(),
      })),
    };
    const current = baseResume();
    current.personalInfo.name = 'Unsaved current editor';
    const result = await restoreVersion('resume', `v${MAX_VERSIONS - 1}`, current);
    expect(result.data.personalInfo.name).toBe('Oldest');
    expect(record.data).toEqual(oldest);
    expect(record.versions).toHaveLength(MAX_VERSIONS);
    expect(record.versions[0].label).toBe('Before restore');
    expect(record.versions[0].data).toEqual(current);
    expect(record.versions.some(v => v.id === `v${MAX_VERSIONS - 1}`)).toBe(false);
    expect(record.jobDescription).toBe('TypeScript');
    expect(record.jdMatchScore).toBeUndefined();
    expect(writes).toBe(1);
    expect(loadResume).not.toHaveBeenCalled();
    result.data.personalInfo.name = 'Mutated return';
    current.personalInfo.name = 'Mutated input';
    expect(record.data).toEqual(oldest);
    expect(record.versions[0].data.personalInfo.name).toBe('Unsaved current editor');
  });

  it('does not create a snapshot or write when the selected version is missing', async () => {
    const original = structuredClone(record);
    await expect(restoreVersion('resume', 'missing', baseResume())).rejects.toThrow('Version not found');
    expect(record).toEqual(original);
    expect(writes).toBe(0);
  });

  it('aborts inside the transaction if the editor guard fails', async () => {
    const original = structuredClone(record);
    const check = vi.fn(() => { throw new Error('Editor changed'); });
    await expect(restoreVersion('resume', 'v1', baseResume(), check)).rejects.toThrow('Editor changed');
    expect(check).toHaveBeenCalledOnce();
    expect(record).toEqual(original);
    expect(writes).toBe(0);
  });

  it('propagates missing records and transaction failures', async () => {
    await expect(createSnapshot('missing', baseResume())).rejects.toThrow('Resume not found');
    vi.mocked(updateResumeRecord).mockRejectedValue(new Error('Storage full'));
    await expect(deleteVersion('resume', 'v1')).rejects.toThrow('Storage full');
    await expect(renameVersion('resume', 'v1', 'New')).rejects.toThrow('Storage full');
    await expect(restoreVersion('resume', 'v1', baseResume())).rejects.toThrow('Storage full');
    expect(writes).toBe(0);
  });

  it('reads history and detached version data without a write', async () => {
    expect(await listVersions('resume')).toEqual(record.versions);
    const data = await getVersionData('resume', 'v1');
    data!.personalInfo.name = 'Detached';
    expect(record.versions[0].data.personalInfo.name).toBe('Jane Doe');
    expect(await getVersionData('resume', 'missing')).toBeNull();
    vi.mocked(loadResume).mockResolvedValue(undefined);
    expect(await listVersions('missing')).toEqual([]);
    expect(updateResumeRecord).not.toHaveBeenCalled();
  });
});

describe('VersionHistoryModal persistence', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onClose = vi.fn();
  const button = (label: string) => Array.from(container.querySelectorAll('button')).find(b => (b.getAttribute('aria-label') || b.textContent?.trim()) === label)!;
  const click = async (label: string) => { await act(async () => button(label).click()); };
  const render = async () => { await act(async () => root.render(createElement(VersionHistoryModal, { onClose }))); };

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    editor.state = { activeResumeId: 'resume', data: baseResume(), hydrated: true, revision: 1, settings: { darkMode: false } } as ResumeState;
    editor.flush.mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('captures post-flush data rather than stale render data', async () => {
    await render();
    editor.flush.mockImplementation(async () => {
      editor.state = { ...editor.state, data: { ...baseResume(), personalInfo: { ...baseResume().personalInfo, name: 'Fresh editor' } }, revision: 2 };
    });
    await click('Save snapshot');
    expect(record.versions[0].data.personalInfo.name).toBe('Fresh editor');
    expect(record.data.personalInfo.name).toBe('Jane Doe');
    expect(editor.flush.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(updateResumeRecord).mock.invocationCallOrder[0]);
  });

  it('opens the committed restore only after saving current edits', async () => {
    await render();
    await click('Restore');
    expect(editor.flush).toHaveBeenCalledOnce();
    expect(editor.open).toHaveBeenCalledWith(record);
    expect(record.versions[0].label).toBe('Before restore');
    expect(container.textContent).toContain('Version restored.');
  });

  it('flushes rename and delete actions', async () => {
    await render();
    await click('Rename Original');
    await act(async () => {
      const input = container.querySelector<HTMLInputElement>('input[aria-label="Rename snapshot"]')!;
      input.value = 'Renamed';
      Simulate.change(input);
    });
    await click('Save');
    await click('Delete Renamed');
    expect(editor.flush).toHaveBeenCalledTimes(2);
    expect(record.versions).toEqual([]);
  });

  it('blocks all writes if flushing fails and allows retry', async () => {
    await render();
    editor.flush.mockRejectedValueOnce(new Error('Save failed'));
    await click('Restore');
    expect(updateResumeRecord).not.toHaveBeenCalled();
    expect(editor.open).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Save failed');
    await click('Restore');
    expect(editor.open).toHaveBeenCalledOnce();
  });

  it('aborts when the active resume changes during flush', async () => {
    await render();
    editor.flush.mockImplementation(async () => { editor.state = { ...editor.state, activeResumeId: 'other' }; });
    await click('Save snapshot');
    expect(updateResumeRecord).not.toHaveBeenCalled();
  });

  it('checks for newer edits inside the restore transaction', async () => {
    await render();
    beforeUpdate = () => { editor.state = { ...editor.state, revision: 2 }; };
    await click('Restore');
    expect(writes).toBe(0);
    expect(editor.open).not.toHaveBeenCalled();
    expect(container.textContent).toContain('newer edits were kept');
  });

  it('keeps and flushes edits made while the restore commit completes', async () => {
    await render();
    afterUpdate = () => { editor.state = { ...editor.state, revision: 2 }; };
    await click('Restore');
    expect(writes).toBe(1);
    expect(editor.open).not.toHaveBeenCalled();
    expect(editor.flush).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('newer edits were kept');
  });

  it('never opens a late restore over a different active resume', async () => {
    await render();
    afterUpdate = () => { editor.state = { ...editor.state, activeResumeId: 'other', revision: 2 }; };
    await click('Restore');
    expect(editor.open).not.toHaveBeenCalled();
    expect(editor.flush).toHaveBeenCalledOnce();
  });

  it('blocks repeated actions and closing while a save is pending', async () => {
    await render();
    let resolve!: () => void;
    editor.flush.mockReturnValue(new Promise<void>(done => { resolve = done; }));
    await act(async () => { button('Save snapshot').click(); button('Save snapshot').click(); });
    await click('Close version history');
    expect(editor.flush).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => resolve());
    expect(writes).toBe(1);
  });
});
