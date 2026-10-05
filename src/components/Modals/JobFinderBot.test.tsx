// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import resumeReducer, { setActiveResumeId, updateAISettings } from '../../store/resumeSlice';
import { searchRemoteJobs, RemoteJobListing } from '../../utils/jobSearchApi';
import { callAIChat } from '../../utils/aiClient';
import JobFinderBot from './JobFinderBot';

vi.mock('../../utils/jobSearchApi', async importOriginal => ({ ...await importOriginal<typeof import('../../utils/jobSearchApi')>(), searchRemoteJobs: vi.fn() }));
vi.mock('../../utils/aiClient', async importOriginal => ({ ...await importOriginal<typeof import('../../utils/aiClient')>(), callAIChat: vi.fn() }));

const makeStore = () => configureStore({ reducer: { resume: resumeReducer } });
let store: ReturnType<typeof makeStore>;
let root: Root;
let host: HTMLDivElement;
const render = async () => { await act(async () => root.render(<Provider store={store}><JobFinderBot /></Provider>)); };
const click = async (text: string) => { await act(async () => Array.from(host.querySelectorAll('button')).find(b => b.textContent?.includes(text))!.click()); };
const change = async (input: HTMLInputElement, value: string) => { await act(async () => { input.value = value; Simulate.change(input); }); };
const listing: RemoteJobListing = { id: 1, title: 'Developer', company: 'Example', location: 'Remote', url: 'https://example.com/jobs/1', tags: [] };

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.resetAllMocks();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  store = makeStore();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe('honest job search', () => {
  it('labels location as external-only and does not imply remote eligibility', async () => {
    vi.mocked(searchRemoteJobs).mockResolvedValue([listing]);
    await render();
    await change(host.querySelector('input[placeholder="City or region"]')!, 'London');
    await change(host.querySelector('input[placeholder="e.g. Frontend Engineer"]')!, 'Developer');
    await click('Search remote jobs');
    expect(searchRemoteJobs).toHaveBeenCalledWith('Developer');
    expect(host.textContent).toContain('Location for external links only');
    expect(host.textContent).toContain('not filtered by location');
    expect(host.textContent).toContain('location eligibility not specified');
    const linkedIn = Array.from(host.querySelectorAll('a')).find(a => a.textContent?.includes('LinkedIn'))!;
    expect(linkedIn.href).toContain('location=London');
  });

  it('ignores search responses after the query changes', async () => {
    let resolve!: (jobs: RemoteJobListing[]) => void;
    vi.mocked(searchRemoteJobs).mockImplementation(() => new Promise(r => { resolve = r; }));
    await render();
    await click('Search remote jobs');
    await change(host.querySelector('input[placeholder="e.g. Frontend Engineer"]')!, 'Different query');
    await act(async () => resolve([listing]));
    expect(host.textContent).not.toContain('Example');
  });

  it('ignores AI replies after a resume switch', async () => {
    store.dispatch(updateAISettings({ provider: 'openai', apiKey: 'key' }));
    let resolve!: (reply: string) => void;
    vi.mocked(callAIChat).mockImplementation(() => new Promise(r => { resolve = r; }));
    await render();
    await change(host.querySelector('input[aria-label="Message to career assistant"]')!, 'Suggest roles');
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Send message"]')!.click());
    await act(async () => { store.dispatch(setActiveResumeId('other')); });
    await act(async () => resolve('Outdated advice'));
    expect(host.textContent).not.toContain('Outdated advice');
    expect(host.textContent).not.toContain('Suggest roles');
  });

  it('provides a named dialog, traps focus, closes on Escape, and restores focus', async () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    await render();
    const dialog = host.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-labelledby')).toBe('job-finder-title');
    expect(document.activeElement).toBe(dialog);
    const close = host.querySelector<HTMLButtonElement>('button[aria-label="Close job finder"]')!;
    close.focus();
    await act(async () => close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })));
    expect(document.activeElement).not.toBe(close);
    await act(async () => dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(store.getState().resume.showJobFinderBot).toBe(false);
    await act(async () => root.render(null));
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
