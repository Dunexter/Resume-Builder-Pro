// @vitest-environment jsdom
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import resumeReducer from '../../store/resumeSlice';
import Sidebar from './Sidebar';
const { act } = React;

let root: Root;
let host: HTMLDivElement;
let desktop: boolean;
let mediaChange: () => void;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  desktop = false;
  vi.stubGlobal('matchMedia', () => ({
    get matches() { return desktop; },
    addEventListener: (_: string, listener: () => void) => { mediaChange = listener; },
    removeEventListener: vi.fn(),
  }));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it('hides only the closed mobile drawer from keyboard and assistive technology', () => {
  const store = configureStore({ reducer: { resume: resumeReducer } });
  const render = (open: boolean) => act(() => root.render(<Provider store={store}><Sidebar mobileOpen={open} /></Provider>));
  render(false);
  const drawer = host.querySelector('[inert]')!;
  expect(drawer.getAttribute('aria-hidden')).toBe('true');
  desktop = true;
  act(() => mediaChange());
  expect(drawer.hasAttribute('inert')).toBe(false);
  expect(drawer.hasAttribute('aria-hidden')).toBe(false);
  desktop = false;
  act(() => mediaChange());
  expect(drawer.hasAttribute('inert')).toBe(true);
  render(true);
  expect(drawer.hasAttribute('inert')).toBe(false);
});

it('closes and emits edit navigation for regular sections and tools', () => {
  const store = configureStore({ reducer: { resume: resumeReducer } });
  const close = vi.fn();
  const navigate = vi.fn();
  window.addEventListener('resume-navigate-edit', navigate);
  act(() => root.render(<Provider store={store}><Sidebar mobileOpen onCloseMobile={close} /></Provider>));
  for (const name of ['Education', 'Personal Info', 'Styling']) {
    act(() => Array.from(host.querySelectorAll('button')).find(b => b.textContent === name)!.click());
  }
  expect(close).toHaveBeenCalledTimes(3);
  expect(navigate).toHaveBeenCalledTimes(3);
  expect(navigate.mock.calls[0][0]).toBeInstanceOf(CustomEvent);
  expect(store.getState().resume.activeSection).toBe('styling');
  window.removeEventListener('resume-navigate-edit', navigate);
});
