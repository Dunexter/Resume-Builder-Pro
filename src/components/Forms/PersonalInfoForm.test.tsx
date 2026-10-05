// @vitest-environment jsdom
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import resumeReducer, { loadResumeData, setActiveResumeId, updateAISettings, updatePersonalInfo, updateSettings } from '../../store/resumeSlice';
import { blankResumeData } from '../../data/sampleResume';
import { generateSummaryWithAI } from '../../utils/atsUtils';
import PersonalInfoForm from './PersonalInfoForm';

vi.mock('../../utils/atsUtils', () => ({ generateSummaryWithAI: vi.fn() }));
const { act } = React;
const makeStore = () => configureStore({ reducer: { resume: resumeReducer } });
let store: ReturnType<typeof makeStore>;
let host: HTMLDivElement;
let root: Root;
const render = async () => { await act(async () => root.render(<Provider store={store}><PersonalInfoForm /></Provider>)); };
const button = (text: string) => Array.from(host.querySelectorAll('button')).find(b => b.textContent === text)!;
const click = async (text: string) => { await act(async () => button(text).click()); };
const mutate = (kind: string) => {
  if (kind === 'source') store.dispatch(updatePersonalInfo({ summary: 'Live edit' }));
  if (kind === 'data') store.dispatch(updatePersonalInfo({ name: 'Changed name' }));
  if (kind === 'resume') store.dispatch(setActiveResumeId('another-resume'));
  if (kind === 'provider') store.dispatch(updateAISettings({ provider: 'gemini' }));
  if (kind === 'key') store.dispatch(updateAISettings({ apiKey: 'new-key' }));
  if (kind === 'model') store.dispatch(updateAISettings({ model: 'new-model' }));
};

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.resetAllMocks();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  store = makeStore();
  store.dispatch(loadResumeData(structuredClone(blankResumeData)));
  store.dispatch(updatePersonalInfo({ summary: 'Original summary' }));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe('summary suggestions', () => {
  it('previews local output, discards safely, and applies only on acceptance', async () => {
    vi.mocked(generateSummaryWithAI).mockResolvedValue('Generated summary');
    await render();
    const original = store.getState().resume.data;
    await click('Auto-Write');
    expect(host.textContent).toContain('Local summary preview');
    expect(store.getState().resume.data).toBe(original);
    await click('Discard suggestion');
    expect(store.getState().resume.data).toBe(original);
    await click('Auto-Write');
    await click('Accept summary');
    expect(store.getState().resume.data.personalInfo.summary).toBe('Generated summary');
    expect(store.getState().resume.data.sections).toBe(original.sections);
    expect(button('Accept summary')).toBeUndefined();
  });

  it('identifies AI output and does not invalidate it for a theme change', async () => {
    store.dispatch(updateAISettings({ provider: 'openai', apiKey: 'key' }));
    vi.mocked(generateSummaryWithAI).mockResolvedValue('AI summary');
    await render();
    await click('AI Generate');
    expect(host.textContent).toContain('AI summary preview');
    await act(async () => { store.dispatch(updateSettings({ darkMode: !store.getState().resume.settings.darkMode })); });
    await click('Accept summary');
    expect(store.getState().resume.data.personalInfo.summary).toBe('AI summary');
  });

  it.each(['source', 'data', 'resume', 'provider', 'key', 'model'])('ignores pending results after a %s change', async kind => {
    let resolve!: (value: string) => void;
    vi.mocked(generateSummaryWithAI).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    await render();
    await click('Auto-Write');
    await act(async () => mutate(kind));
    const current = store.getState().resume.data;
    await act(async () => resolve('Stale summary'));
    expect(store.getState().resume.data).toBe(current);
    expect(host.textContent).not.toContain('Stale summary');
    expect(button('Accept summary')).toBeUndefined();
    expect(button('Generating...')).toBeUndefined();
  });

  it.each(['source', 'data', 'resume', 'provider', 'key', 'model'])('checks the store at acceptance before React renders a %s change', async kind => {
    vi.mocked(generateSummaryWithAI).mockResolvedValue('Stale summary');
    await render();
    await click('Auto-Write');
    const accept = button('Accept summary');
    let current = store.getState().resume.data;
    act(() => {
      mutate(kind);
      current = store.getState().resume.data;
      accept.click();
    });
    expect(store.getState().resume.data).toBe(current);
    expect(button('Accept summary')).toBeUndefined();
  });

  it('keeps current text after empty output and catches provider failures without local fallback', async () => {
    vi.mocked(generateSummaryWithAI).mockResolvedValueOnce('  \n ');
    await render();
    await click('Auto-Write');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('No summary was generated');
    expect(store.getState().resume.data.personalInfo.summary).toBe('Original summary');
    await act(async () => { store.dispatch(updateAISettings({ provider: 'openai', apiKey: '' })); });
    vi.mocked(generateSummaryWithAI).mockRejectedValueOnce(new Error('No API key configured.'));
    await click('AI Generate');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('No API key configured.');
    expect(button('AI Generate').disabled).toBe(false);
    expect(store.getState().resume.data.personalInfo.summary).toBe('Original summary');
    expect(button('Accept summary')).toBeUndefined();
    expect(generateSummaryWithAI).toHaveBeenCalledTimes(2);
  });

  it('does not let an old completion or rejection replace a newer request', async () => {
    let resolveOld!: (value: string) => void;
    let rejectOld!: (reason: Error) => void;
    vi.mocked(generateSummaryWithAI)
      .mockImplementationOnce(() => new Promise(r => { resolveOld = r; }))
      .mockImplementationOnce(() => new Promise((_r, reject) => { rejectOld = reject; }))
      .mockResolvedValueOnce('Latest summary');
    await render();
    await click('Auto-Write');
    await act(async () => mutate('data'));
    await click('Auto-Write');
    await act(async () => resolveOld('Old summary'));
    expect(button('Generating...')?.disabled).toBe(true);
    await act(async () => mutate('source'));
    await click('Auto-Write');
    await act(async () => rejectOld(new Error('Old error')));
    expect(host.textContent).not.toContain('Old error');
    expect(host.textContent).toContain('Latest summary');
    await click('Accept summary');
    expect(store.getState().resume.data.personalInfo.summary).toBe('Latest summary');
  });

  it('ignores a completion after unmount', async () => {
    let resolve!: (value: string) => void;
    vi.mocked(generateSummaryWithAI).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    await render();
    await click('Auto-Write');
    act(() => root.render(null));
    await act(async () => resolve('Late summary'));
    await render();
    expect(store.getState().resume.data.personalInfo.summary).toBe('Original summary');
    expect(button('Accept summary')).toBeUndefined();
  });

  it('labels every field, preserves manual editing, and keeps the importer entry point', async () => {
    await render();
    for (const label of host.querySelectorAll('label')) expect(label.control).not.toBeNull();
    for (const field of host.querySelectorAll<HTMLInputElement>('input, textarea')) expect(field.labels?.length).toBeGreaterThan(0);
    const textarea = host.querySelector('textarea')!;
    await act(async () => { textarea.value = 'Manual summary'; Simulate.change(textarea); });
    expect(store.getState().resume.data.personalInfo.summary).toBe('Manual summary');
    const listener = vi.fn();
    window.addEventListener('open-resume-import', listener);
    await click('Import into a new resume');
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener('open-resume-import', listener);
  });
});
