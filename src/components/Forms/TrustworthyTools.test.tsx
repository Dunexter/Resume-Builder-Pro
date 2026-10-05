// @vitest-environment jsdom
import { act, ReactElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import resumeReducer, { setActiveResumeId, loadResumeData as setResumeData, setJobDescription, setJDMatchResult, updateAISettings, updateExperience, insertMissingKeyword } from '../../store/resumeSlice';
import { blankResumeData } from '../../data/sampleResume';
import { callAIText, listModels } from '../../utils/aiClient';
import { extractTextFromFile } from '../../utils/resumeFileParser';
import { matchJobDescriptionWithSynonyms } from '../../utils/jdMatch';
import ExperienceForm from './ExperienceForm';
import JDMatcherForm from './JDMatcherForm';
import AISettingsForm from './AISettingsForm';
import AIReviewForm from './AIReviewForm';
import ATSScoreForm from './ATSScoreForm';
import SkillsForm from './SkillsForm';

vi.mock('../../utils/aiClient', async importOriginal => ({ ...await importOriginal<typeof import('../../utils/aiClient')>(), callAIText: vi.fn(), listModels: vi.fn() }));
vi.mock('../../utils/resumeFileParser', () => ({ extractTextFromFile: vi.fn() }));

const makeStore = () => configureStore({ reducer: { resume: resumeReducer } });
let store: ReturnType<typeof makeStore>;
let root: Root;
let host: HTMLDivElement;
const render = async (element: ReactElement) => { await act(async () => root.render(<Provider store={store}>{element}</Provider>)); };
const click = async (text: string) => {
  const button = Array.from(host.querySelectorAll('button')).find(b => b.textContent?.includes(text));
  expect(button, `button ${text}`).toBeTruthy();
  await act(async () => button!.click());
};
const clickLabel = async (label: string) => { await act(async () => host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!.click()); };
const change = async (selector: string, value: string) => {
  const input = host.querySelector<HTMLInputElement>(selector)!;
  await act(async () => { input.value = value; Simulate.change(input); });
};
const seedExperience = () => {
  const data = structuredClone(blankResumeData);
  data.sections.experience = [{ id: 'exp', company: 'Acme', position: 'Developer', location: '', startDate: '2020-01', endDate: '', current: true, achievements: ['Assisted with deployment testing', 'Another original bullet'] }];
  store.dispatch(setResumeData(data));
  store.dispatch(updateAISettings({ provider: 'openai', apiKey: 'test', model: '' }));
};

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.resetAllMocks();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  store = makeStore();
  store.dispatch(setResumeData(structuredClone(blankResumeData)));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe('rewrite preview and source protection', () => {
  it('requires acceptance and changes only the selected bullet', async () => {
    seedExperience();
    vi.mocked(callAIText).mockResolvedValue('Assisted with testing deployments');
    await render(<ExperienceForm />);
    await clickLabel('Preview AI rewrite for achievement 1');
    expect(store.getState().resume.data.sections.experience[0].achievements[0]).toBe('Assisted with deployment testing');
    expect(host.textContent).toContain('AI suggestion');
    await click('Accept suggestion');
    expect(store.getState().resume.data.sections.experience[0].achievements).toEqual(['Assisted with testing deployments', 'Another original bullet']);
  });

  it.each(['edit', 'switch', 'provider', 'remove'] as const)('rejects a pending response after %s', async kind => {
    seedExperience();
    let resolve!: (value: string) => void;
    vi.mocked(callAIText).mockImplementation(() => new Promise(r => { resolve = r; }));
    await render(<ExperienceForm />);
    await clickLabel('Preview AI rewrite for achievement 1');
    await act(async () => {
      if (kind === 'edit') store.dispatch(updateExperience({ id: 'exp', data: { achievements: ['Live edit', 'Sibling edit'] } }));
      if (kind === 'switch') store.dispatch(setActiveResumeId('other'));
      if (kind === 'provider') store.dispatch(updateAISettings({ provider: 'gemini', apiKey: '', model: '' }));
      if (kind === 'remove') store.dispatch(updateExperience({ id: 'exp', data: { achievements: ['Another original bullet'] } }));
    });
    const before = store.getState().resume.data;
    await act(async () => resolve('Stale rewrite'));
    expect(store.getState().resume.data).toBe(before);
    expect(host.textContent).not.toContain('Stale rewrite');
    expect(host.textContent).not.toContain('Accept suggestion');
  });

  it('clears an existing preview on source changes and surfaces provider errors without edits', async () => {
    seedExperience();
    vi.mocked(callAIText).mockResolvedValueOnce('Preview text').mockRejectedValueOnce(new Error('Provider failed'));
    await render(<ExperienceForm />);
    await clickLabel('Preview AI rewrite for achievement 1');
    await change('textarea', 'Live edit');
    expect(host.textContent).not.toContain('Accept suggestion');
    await clickLabel('Preview AI rewrite for achievement 1');
    expect(host.textContent).toContain('No changes were made');
    expect(store.getState().resume.data.sections.experience[0].achievements[0]).toBe('Live edit');
  });
});

describe('current JD results', () => {
  it('ignores persisted results, recomputes from edits, and hides on resume switches', async () => {
    store.dispatch(setJDMatchResult({ score: 99, matchedKeywords: ['stale'], missingKeywords: [], suggestions: [] }));
    store.dispatch(setJobDescription('React and Python'));
    await render(<JDMatcherForm />);
    expect(host.textContent).not.toContain('99%');
    await click('Analyze match');
    expect(host.textContent).toContain('0/2');
    await clickLabel('Add react to Skills only if accurate');
    const state = store.getState().resume;
    const expected = matchJobDescriptionWithSynonyms(state.data, state.jobDescription);
    expect(host.textContent).toContain(`${expected.score}%`);
    expect(host.textContent).toContain('1/2');
    await change('textarea', 'React');
    expect(host.textContent).toContain('100%');
    await act(async () => { store.dispatch(setActiveResumeId('other')); });
    expect(host.textContent).not.toContain('Keyword overlap (');
  });
});

describe('explicit provider requests', () => {
  it('does not fetch while typing and clears key/model in one provider action', async () => {
    store.dispatch(updateAISettings({ provider: 'openai', apiKey: 'old', model: 'gpt-4o' }));
    await render(<AISettingsForm />);
    await change('#ai-api-key', 'new-key');
    expect(listModels).not.toHaveBeenCalled();
    const updates: unknown[] = [];
    const unsubscribe = store.subscribe(() => updates.push(store.getState().resume.settings.ai));
    await click('Gemini');
    unsubscribe();
    expect(updates).toEqual([{ provider: 'gemini', apiKey: '', model: '' }]);
    expect(listModels).not.toHaveBeenCalled();
  });

  it('ignores stale model and key-test responses after credentials change', async () => {
    store.dispatch(updateAISettings({ provider: 'openai', apiKey: 'old', model: '' }));
    let resolveModels!: (value: { value: string; label: string }[]) => void;
    let resolveKey!: (value: { value: string; label: string }[]) => void;
    vi.mocked(listModels).mockImplementationOnce(() => new Promise(r => { resolveModels = r; })).mockImplementationOnce(() => new Promise(r => { resolveKey = r; }));
    await render(<AISettingsForm />);
    await click('Refresh from provider');
    await click('Test key');
    await change('#ai-api-key', 'replacement');
    await act(async () => { resolveModels([{ value: 'stale-model', label: 'stale-model' }]); resolveKey([]); });
    expect(host.textContent).not.toContain('stale-model');
    expect(host.textContent).not.toContain('Model listing succeeded');
    expect(host.textContent).not.toContain('Fetching');
  });
});

describe('analysis UI honesty', () => {
  it('shows empty quality as unassessed, not excellent', async () => {
    await render(<ATSScoreForm />);
    await click('Content (');
    expect(host.textContent).toContain('No analyzable passages');
    expect(host.textContent).toContain('N/A');
    expect(host.textContent).not.toContain('Excellent');
  });

  it('shows uploaded content issues in the upload view and not builder scores before upload', async () => {
    vi.mocked(extractTextFromFile).mockResolvedValue('Projects\n- helped with various deployment tasks across the organization');
    await render(<ATSScoreForm />);
    await click('Upload Resume');
    expect(host.textContent).not.toContain('ATS Parse Safety');
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: [new File(['text'], 'resume.txt', { type: 'text/plain' })] });
    await act(async () => Simulate.change(input));
    expect(host.textContent).toContain('Uploaded content issues');
    expect(host.textContent).toContain('weak verb');
    expect(host.textContent).toContain('filler word');
  });

  it('rejects stale reviews and malformed AI structures', async () => {
    seedExperience();
    let resolve!: (value: string) => void;
    vi.mocked(callAIText).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    await render(<AIReviewForm />);
    await click('Generate AI review');
    await act(async () => { store.dispatch(setActiveResumeId('other')); });
    await act(async () => resolve(JSON.stringify({ overallImpression: 'Stale critique', strengths: [], weaknesses: [], recommendations: [] })));
    expect(host.textContent).not.toContain('Stale critique');
    vi.mocked(callAIText).mockResolvedValue(' {"overallImpression": {}, "strengths": [{}]} ');
    await click('Generate AI review');
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('adds the selected skill rather than a blank category', async () => {
    store.dispatch(insertMissingKeyword('React'));
    await render(<SkillsForm />);
    const suggestion = host.querySelector<HTMLButtonElement>('button[aria-label^="Add "][aria-label$="only if accurate"]');
    expect(suggestion).not.toBeNull();
    const skill = suggestion!.textContent!.trim();
    await act(async () => suggestion!.click());
    expect(store.getState().resume.data.sections.skills[0].skills).toBe(`React, ${skill}`);
  });
});
