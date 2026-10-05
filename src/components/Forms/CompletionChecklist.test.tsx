// @vitest-environment jsdom
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import resumeReducer, { addProject, addSkill, updatePersonalInfo, updateProject, updateSkill } from '../../store/resumeSlice';
import CompletionChecklist from './CompletionChecklist';

const { act } = React;
let host: HTMLDivElement;
let root: Root;
const makeStore = () => configureStore({ reducer: { resume: resumeReducer } });
let store: ReturnType<typeof makeStore>;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
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

it('does not complete empty entries and accepts substantive student projects and skills', async () => {
  store.dispatch(addProject());
  store.dispatch(addSkill());
  await act(async () => root.render(<Provider store={store}><CompletionChecklist /></Provider>));
  expect(host.textContent).toContain('0 of 4 steps complete');
  await act(async () => {
    store.dispatch(updatePersonalInfo({ name: 'Student', email: 'bad@email' }));
    store.dispatch(updateProject({ id: store.getState().resume.data.sections.projects[0].id, data: { title: 'Class project', description: 'Built a course directory.' } }));
    store.dispatch(updateSkill({ id: store.getState().resume.data.sections.skills[0].id, data: { skills: 'HTML' } }));
  });
  expect(host.textContent).toContain('2 of 4 steps complete');
  await act(async () => { store.dispatch(updatePersonalInfo({ email: 'student@example.edu' })); });
  expect(host.textContent).toContain('3 of 4 steps complete');
  await act(async () => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  expect(host.textContent).toContain('4 of 4 steps complete');
  await act(async () => { store.dispatch(updatePersonalInfo({ phone: '123' })); });
  expect(host.textContent).toContain('3 of 4 steps complete');
  expect(host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(false);
});

it('dispatches editor navigation, emits the mobile event, and calls the optional callback', async () => {
  const onNavigate = vi.fn();
  const navigateEvent = vi.fn();
  window.addEventListener('resume-navigate-edit', navigateEvent);
  try {
    await act(async () => root.render(<Provider store={store}><CompletionChecklist onNavigate={onNavigate} /></Provider>));
    await act(async () => Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Describe experience or a project'))!.click());
    expect(store.getState().resume.activeSection).toBe('projects');
    expect(onNavigate).toHaveBeenCalledWith('projects');
    expect(navigateEvent).toHaveBeenCalledOnce();
  } finally {
    window.removeEventListener('resume-navigate-edit', navigateEvent);
  }
});

it('dismisses only in local component state and reappears on remount', async () => {
  await act(async () => root.render(<Provider store={store}><CompletionChecklist /></Provider>));
  const state = store.getState();
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Dismiss completion checklist"]')!.click());
  expect(host.textContent).toBe('');
  expect(store.getState()).toBe(state);
  await act(async () => root.render(null));
  await act(async () => root.render(<Provider store={store}><CompletionChecklist /></Provider>));
  expect(host.textContent).toContain('Resume completion');
});
