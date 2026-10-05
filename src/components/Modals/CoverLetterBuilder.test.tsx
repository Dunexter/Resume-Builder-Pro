// @vitest-environment jsdom
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import resumeReducer, { addExperience, addProject, addSkill, setActiveResumeId, setJobDescription, setShowCoverLetterBuilder, updateExperience, updateProject, updateSettings, updateSkill } from '../../store/resumeSlice';
import { loadCoverLettersByResume, saveCoverLetter } from '../../db/resumeDB';
import { CoverLetter } from '../../types/resume';
import CoverLetterBuilder from './CoverLetterBuilder';
import { exportCoverLetter } from '../../utils/coverLetterExport';
import { callAIText } from '../../utils/aiClient';

vi.mock('../../db/resumeDB', () => ({ loadCoverLettersByResume: vi.fn(), saveCoverLetter: vi.fn() }));
vi.mock('../../utils/aiClient', () => ({ callAIText: vi.fn() }));
vi.mock('../../utils/coverLetterExport', () => ({ exportCoverLetter: vi.fn() }));
const { act } = React;

let root: Root;
let host: HTMLDivElement;
let store: ReturnType<typeof makeStore>;
let letters: CoverLetter[];
const makeStore = () => configureStore({ reducer: { resume: resumeReducer } });
const render = async () => { await act(async () => root.render(<Provider store={store}><CoverLetterBuilder /></Provider>)); };
const change = async (id: string, value: string) => {
  const input = host.querySelector<HTMLInputElement>(`#${id}`)!;
  input.value = value;
  await act(async () => Simulate.change(input, { target: input }));
};

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  store = makeStore();
  letters = [];
  vi.mocked(loadCoverLettersByResume).mockImplementation(async resumeId => letters.filter(l => l.resumeId === resumeId));
  vi.mocked(saveCoverLetter).mockImplementation(async letter => { letters = [...letters.filter(l => l.id !== letter.id), letter]; });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('cover letter drafts', () => {
  it.each(['Standard', 'Concise (1 paragraph)', 'Narrative Style'])('uses explicit placeholders rather than fabricated facts in %s', async style => {
    await render();
    await act(async () => Array.from(host.querySelectorAll('button')).find(b => b.textContent === style)!.click());
    await act(async () => Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'Generate Cover Letter')!.click());
    const content = host.querySelector<HTMLTextAreaElement>('#letter-content')!.value;
    expect(content).toContain('[Position]');
    expect(content).toContain('[Company]');
    expect(content).toContain('[add relevant skills you have]');
    expect(content).toMatch(/\[(?:Add|Describe) /);
    expect(content).not.toMatch(/several years|proven track record|exceeded expectations|reputation for innovation|deep expertise|Most recently/);
    expect(callAIText).not.toHaveBeenCalled();
  });

  it('uses a supplied nonnumeric achievement without implying duration or recency', async () => {
    store.dispatch(addExperience());
    const id = store.getState().resume.data.sections.experience[0].id;
    store.dispatch(updateExperience({ id, data: { achievements: [' ', 'Assisted with a community website.'] } }));
    store.dispatch(addSkill());
    store.dispatch(updateSkill({ id: store.getState().resume.data.sections.skills[0].id, data: { skills: ', , HTML, CSS' } }));
    await render();
    await act(async () => Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'Generate Cover Letter')!.click());
    const content = host.querySelector<HTMLTextAreaElement>('#letter-content')!.value;
    expect(content).toContain('Assisted with a community website.');
    expect(content).toContain('My skills include HTML, CSS.');
    expect(content).not.toMatch(/Most recently|Led|years/);
  });

  it('uses a student project description when no work achievement is supplied', async () => {
    store.dispatch(addProject());
    store.dispatch(updateProject({ id: store.getState().resume.data.sections.projects[0].id, data: { description: 'Built a class scheduling prototype.' } }));
    await render();
    await act(async () => Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'Generate Cover Letter')!.click());
    expect(host.querySelector<HTMLTextAreaElement>('#letter-content')!.value).toContain('Built a class scheduling prototype.');
  });

  it.each(['rejection', 'empty', 'missing key'])('reports AI %s without replacing the draft and allows explicit local generation', async failure => {
    store.dispatch(updateSettings({ ai: { provider: 'openai', apiKey: failure === 'missing key' ? '' : 'test-key' } }));
    if (failure === 'rejection') vi.mocked(callAIText).mockRejectedValueOnce(new Error('Network failure'));
    else if (failure === 'empty') vi.mocked(callAIText).mockResolvedValueOnce('   ');
    await render();
    await change('letter-content', 'Preserve this draft');
    const saves = vi.mocked(saveCoverLetter).mock.calls.length;
    await act(async () => Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'Generate with AI')!.click());
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Your draft was not changed');
    expect(host.querySelector<HTMLTextAreaElement>('#letter-content')!.value).toBe('Preserve this draft');
    expect(saveCoverLetter).toHaveBeenCalledTimes(saves);
    expect(host.querySelector('fieldset')!.disabled).toBe(false);
    await act(async () => Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'Use local template')!.click());
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.querySelector<HTMLTextAreaElement>('#letter-content')!.value).toContain('[Position]');
    expect(callAIText).toHaveBeenCalledTimes(failure === 'missing key' ? 0 : 1);
  });

  it('instructs AI to preserve facts and recovers on retry', async () => {
    store.dispatch(updateSettings({ ai: { provider: 'openai', apiKey: 'test-key' } }));
    vi.mocked(callAIText).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(' Supported draft ');
    await render();
    const generate = () => Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'Generate with AI')!.click();
    await act(async () => generate());
    await act(async () => generate());
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.querySelector<HTMLTextAreaElement>('#letter-content')!.value).toBe('Supported draft');
    expect(vi.mocked(callAIText).mock.calls[0][0]).toContain('Do not invent achievements, metrics, duration');
    expect(vi.mocked(callAIText).mock.calls[0][0]).toContain('not evidence of applicant experience');
  });

  it('persists style-only edits and restores selection without resaving on reopen', async () => {
    await render();
    await act(async () => Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'Narrative Style')!.click());
    expect(letters[0]).toMatchObject({ style: 'story', content: '' });
    const calls = vi.mocked(saveCoverLetter).mock.calls.length;
    act(() => root.render(null));
    await render();
    expect(Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'Narrative Style')!.getAttribute('aria-pressed')).toBe('true');
    expect(saveCoverLetter).toHaveBeenCalledTimes(calls);
  });

  it.each([undefined, 'unknown-style'])('restores a draft with style %s as standard without overwriting it', async style => {
    const resumeId = store.getState().resume.activeResumeId;
    const letter = { id: JSON.stringify(['cover-letter', resumeId, '']), resumeId, companyName: '', jobTitle: '', content: 'Saved text', createdAt: '', updatedAt: '', style };
    letters = [letter];
    await render();
    expect(Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'Standard')!.getAttribute('aria-pressed')).toBe('true');
    expect(saveCoverLetter).not.toHaveBeenCalled();
    expect((host.querySelector('#letter-content') as HTMLTextAreaElement).value).toBe('Saved text');
  });

  it('exports the current edited letter in every format and reports Unicode PDF rejection without edits', async () => {
    vi.mocked(exportCoverLetter).mockResolvedValue(undefined);
    await render();
    const download = (format: string) => host.querySelector<HTMLButtonElement>(`[aria-label="Download cover letter as ${format}"]`)!;
    expect(download('DOCX').disabled).toBe(true);
    await change('letter-content', '  ');
    expect(download('PDF').disabled).toBe(true);
    await change('letter-company', 'Example');
    await change('letter-content', 'Edited letter \u5f20\u4f1f');
    for (const format of ['TXT', 'DOCX', 'PDF']) {
      await act(async () => download(format).click());
      expect(exportCoverLetter).toHaveBeenLastCalledWith('Edited letter \u5f20\u4f1f', 'Example', format.toLowerCase());
    }
    let reject!: (reason: Error) => void;
    vi.mocked(exportCoverLetter).mockImplementationOnce(() => new Promise((_resolve, r) => { reject = r; }));
    await act(async () => download('PDF').click());
    expect(download('DOCX').disabled).toBe(true);
    expect(download('PDF').textContent).toContain('Exporting...');
    await act(async () => reject(new Error('PDF cannot safely encode some characters. Use DOCX.')));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Use DOCX');
    expect(download('DOCX').disabled).toBe(false);
    expect((host.querySelector('#letter-content') as HTMLTextAreaElement).value).toBe('Edited letter \u5f20\u4f1f');
    expect(letters[0].content).toBe('Edited letter \u5f20\u4f1f');
    await act(async () => download('DOCX').click());
    expect(host.querySelector('[role="alert"]')).toBeNull();
    for (const label of host.querySelectorAll('label')) expect(label.control).not.toBeNull();
    expect(host.querySelector('[role="dialog"]')?.getAttribute('aria-labelledby')).toBe('cover-letter-title');
  });

  it('does not save initial state before or after loading and restores edits on reopen', async () => {
    let resolve!: (value: CoverLetter[]) => void;
    vi.mocked(loadCoverLettersByResume).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    await render();
    expect(host.querySelector('fieldset')!.disabled).toBe(true);
    expect(saveCoverLetter).not.toHaveBeenCalled();
    await act(async () => resolve([]));
    expect(saveCoverLetter).not.toHaveBeenCalled();
    await change('letter-company', 'Example');
    await change('letter-position', 'Engineer');
    await change('letter-content', 'My edited draft');
    expect(host.textContent).toContain('Saved locally.');
    const calls = vi.mocked(saveCoverLetter).mock.calls.length;
    act(() => root.render(null));
    await render();
    expect((host.querySelector('#letter-content') as HTMLTextAreaElement).value).toBe('My edited draft');
    expect((host.querySelector('#letter-company') as HTMLInputElement).value).toBe('Example');
    expect((host.querySelector('#letter-position') as HTMLInputElement).value).toBe('Engineer');
    expect(saveCoverLetter).toHaveBeenCalledTimes(calls);
  });

  it('isolates drafts by resume and job and restores a previous job draft', async () => {
    await render();
    await change('letter-content', 'First job');
    await act(async () => { store.dispatch(setJobDescription('Second job')); });
    expect((host.querySelector('#letter-content') as HTMLTextAreaElement).value).toBe('');
    await change('letter-content', 'Second job letter');
    await act(async () => { store.dispatch(setJobDescription('')); });
    expect((host.querySelector('#letter-content') as HTMLTextAreaElement).value).toBe('First job');
    await act(async () => { store.dispatch(setActiveResumeId('another-resume')); });
    expect((host.querySelector('#letter-content') as HTMLTextAreaElement).value).toBe('');
    expect(letters).toHaveLength(2);
  });

  it('reports load/save errors and retries without overwriting on load failure', async () => {
    vi.mocked(loadCoverLettersByResume).mockRejectedValueOnce(new Error('Offline'));
    await render();
    expect(host.textContent).toContain('Could not load draft');
    expect(saveCoverLetter).not.toHaveBeenCalled();
    await act(async () => Array.from(host.querySelectorAll('button')).find(b => b.textContent?.includes('Retry load'))!.click());
    vi.mocked(saveCoverLetter).mockRejectedValueOnce(new Error('Quota'));
    await change('letter-content', 'Keep this draft');
    expect(host.textContent).toContain('Draft not saved');
    await act(async () => Array.from(host.querySelectorAll('button')).find(b => b.textContent?.includes('Retry save'))!.click());
    expect(host.textContent).toContain('Saved locally.');
    expect(letters[0].content).toBe('Keep this draft');
  });

  it('serializes rapid edits, including reverting to the initial value', async () => {
    await render();
    let resolve!: () => void;
    vi.mocked(saveCoverLetter).mockImplementationOnce(() => new Promise<void>(r => { resolve = r; }));
    await change('letter-company', 'Temporary');
    await change('letter-company', '');
    expect(saveCoverLetter).toHaveBeenCalledTimes(1);
    await act(async () => resolve());
    expect(saveCoverLetter).toHaveBeenCalledTimes(2);
    expect(letters[0].companyName).toBe('');
  });

  it('waits for pending writes before closing and lets users keep a failed draft open', async () => {
    store.dispatch(setShowCoverLetterBuilder(true));
    await render();
    let resolve!: () => void;
    vi.mocked(saveCoverLetter).mockImplementationOnce(() => new Promise<void>(r => { resolve = r; }));
    await change('letter-content', 'Pending draft');
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Close cover letter builder"]')!.click());
    expect(store.getState().resume.showCoverLetterBuilder).toBe(true);
    await act(async () => resolve());
    expect(store.getState().resume.showCoverLetterBuilder).toBe(false);
    act(() => root.render(null));
    store.dispatch(setShowCoverLetterBuilder(true));
    await render();
    vi.mocked(saveCoverLetter).mockRejectedValueOnce(new Error('Quota'));
    await change('letter-content', 'Unsaved draft');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Close cover letter builder"]')!.click());
    expect(confirm).toHaveBeenCalledOnce();
    expect(store.getState().resume.showCoverLetterBuilder).toBe(true);
    expect(host.querySelector('fieldset')!.disabled).toBe(false);
  });

  it('ignores a stale load after the active resume changes', async () => {
    let resolve!: (value: CoverLetter[]) => void;
    vi.mocked(loadCoverLettersByResume).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    await render();
    const oldResumeId = store.getState().resume.activeResumeId;
    await act(async () => { store.dispatch(setActiveResumeId('new-resume')); });
    await change('letter-content', 'New resume draft');
    await act(async () => resolve([{
      id: JSON.stringify(['cover-letter', oldResumeId, '']), resumeId: oldResumeId,
      companyName: 'Old company', jobTitle: 'Old job', content: 'Stale draft', createdAt: '', updatedAt: '',
    }]));
    expect((host.querySelector('#letter-content') as HTMLTextAreaElement).value).toBe('New resume draft');
    expect(letters[0].resumeId).toBe('new-resume');
    expect(saveCoverLetter).toHaveBeenCalledOnce();
  });
});
