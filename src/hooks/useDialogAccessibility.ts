import { useEffect, useRef } from 'react';

const dialogs: HTMLElement[] = [];

/** Attach to a mounted dialog with role, aria-modal, an accessible name and tabIndex=-1. */
export function useDialogAccessibility(onClose?: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const background: { element: HTMLElement; inert: boolean }[] = [];
    // Isolate siblings at every ancestor, including when the dialog is not portalled.
    let branch: HTMLElement = dialog;
    while (branch.parentElement) {
      for (const sibling of Array.from(branch.parentElement.children)) {
        if (sibling instanceof HTMLElement && sibling !== branch) {
          background.push({ element: sibling, inert: sibling.hasAttribute('inert') });
          sibling.setAttribute('inert', '');
        }
      }
      branch = branch.parentElement;
      if (branch === document.body) break;
    }
    dialogs.push(dialog);
    document.body.style.overflow = 'hidden';
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button, a[href], input, select, textarea, [tabindex], [contenteditable="true"]'
    )).filter(el => el.tabIndex >= 0 && !el.matches(':disabled') && !el.closest('[inert], [hidden], [aria-hidden="true"]')
      && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden');
    const focusFirst = () => (focusable()[0] || dialog).focus();
    focusFirst();
    const onKeyDown = (event: KeyboardEvent) => {
      if (dialogs[dialogs.length - 1] !== dialog) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current?.();
      } else if (event.key === 'Tab') {
        const elements = focusable();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (!first) {
          event.preventDefault();
          dialog.focus();
        } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const onFocus = (event: FocusEvent) => {
      if (dialogs[dialogs.length - 1] === dialog && !dialog.contains(event.target as Node)) focusFirst();
    };
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocus);
      dialogs.splice(dialogs.indexOf(dialog), 1);
      background.forEach(({ element, inert }) => { if (!inert) element.removeAttribute('inert'); });
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected && !previousFocus.closest('[inert]')) previousFocus.focus();
    };
  }, []);

  return ref;
}
