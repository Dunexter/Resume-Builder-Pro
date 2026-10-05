// @vitest-environment jsdom
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Dialog from './Dialog';
import WelcomeModal from './WelcomeModal';
const { act } = React;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe('Dialog', () => {
  it('names the dialog, traps Tab, closes on Escape and restores focus and background', () => {
    const trigger = document.createElement('button');
    document.body.prepend(trigger);
    trigger.focus();
    const close = vi.fn();
    act(() => root.render(<Dialog labelledBy="title" onClose={close}>
      <h2 id="title">Test</h2><button>First</button><button>Last</button>
    </Dialog>));
    const dialog = host.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('title');
    const [first, last] = host.querySelectorAll('button');
    expect(document.activeElement).toBe(first);
    expect(trigger.hasAttribute('inert')).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(last);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(first);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(close).toHaveBeenCalledOnce();
    act(() => root.render(null));
    expect(document.activeElement).toBe(trigger);
    expect(trigger.hasAttribute('inert')).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });

  it('handles only the topmost modal and restores the underlying modal', () => {
    const closeFirst = vi.fn();
    const closeSecond = vi.fn();
    const first = <Dialog key="first" labelledBy="first" onClose={closeFirst}><h2 id="first">First</h2><button>First action</button></Dialog>;
    act(() => root.render(first));
    const action = host.querySelector('button');
    act(() => root.render(<>{first}<Dialog labelledBy="second" onClose={closeSecond}><h2 id="second">Second</h2><button>Second action</button></Dialog></>));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(closeSecond).toHaveBeenCalledOnce();
    expect(closeFirst).not.toHaveBeenCalled();
    act(() => root.render(first));
    expect(document.activeElement).toBe(action);
  });

  it('imports from welcome without creating or choosing a resume, including on Escape', () => {
    const blank = vi.fn();
    const sample = vi.fn();
    const listener = vi.fn();
    window.addEventListener('open-resume-import', listener);
    act(() => root.render(<WelcomeModal onChooseBlank={blank} onChooseSample={sample} />));
    act(() => host.querySelector('button')!.click());
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0]).toBeInstanceOf(CustomEvent);
    expect(blank).not.toHaveBeenCalled();
    expect(sample).not.toHaveBeenCalled();
    window.removeEventListener('open-resume-import', listener);
  });
});
