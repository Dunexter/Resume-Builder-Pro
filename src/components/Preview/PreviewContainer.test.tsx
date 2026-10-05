// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import PreviewContainer from './PreviewContainer';
import { fullResume } from './shared/fieldFidelity.fixture';

vi.mock('../../hooks', () => ({ useAppSelector: (selector: (state: unknown) => unknown) => selector({ resume: { data, settings: { darkMode: false } } }) }));
const data = fullResume();

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.innerHTML = ''; });

it('fits to resized viewport width, exposes named controls, and preserves manual zoom', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  let width = 648;
  let height = 1123;
  let resize = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resize = callback; }
    observe() {}
    disconnect = disconnect;
  });
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) { return this.id === 'resume-preview' ? 800 : width; });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(() => height);
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(800);
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({ paddingLeft: '24px', paddingRight: '24px' } as CSSStyleDeclaration);
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(React.createElement(PreviewContainer)));
  expect(host.textContent).toContain('75%');
  width = 448;
  act(() => resize());
  expect(host.textContent).toContain('50%');
  const button = (label: string) => host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  act(() => button('Zoom in').click());
  expect(host.textContent).toContain('60%');
  width = 688;
  height = 2400;
  act(() => resize());
  expect(host.textContent).toContain('60%');
  expect(host.textContent).toContain('Content exceeds one A4 page');
  act(() => button('Fit resume to available width').click());
  expect(host.textContent).toContain('80%');
  expect(button('Fit resume to available width').getAttribute('aria-pressed')).toBe('true');
  act(() => button('Reset zoom to 100 percent').click());
  expect(host.querySelector('[aria-label="Zoom 100%"]')).not.toBeNull();
  act(() => root.unmount());
  expect(disconnect).toHaveBeenCalled();
});
