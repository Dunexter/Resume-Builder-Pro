// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ImportResumeModal from './ImportResumeModal';

vi.mock('../../hooks', () => ({ useAppSelector: (select: (state: unknown) => unknown) => select({ resume: { settings: { ai: { provider: 'openai', apiKey: 'test-key' } } } }) }));

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

const button = (label: string) => Array.from(container.querySelectorAll('button')).find(b => b.textContent === label)!;
const field = (label: string, scope: ParentNode = container) => Array.from(scope.querySelectorAll('label')).find(node => {
  const copy = node.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('input, textarea').forEach(control => control.remove());
  return copy.textContent === label;
})!.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')!;
const group = (label: string) => Array.from(container.querySelectorAll('fieldset')).find(node => node.querySelector('legend')?.textContent === label)!;
const source = () => field('Paste or correct extracted text before parsing');
const review = () => field('I reviewed the candidate against the source, including dates and unmapped text.') as HTMLInputElement;
async function change(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await act(async () => { element.value = value; Simulate.change(element); });
}
async function check(element: HTMLInputElement, checked = true) {
  await act(async () => { element.checked = checked; Simulate.change(element); });
}

describe('ImportResumeModal', () => {
  it('reviews structured edits and creates a validated new candidate without automatic AI', async () => {
    const onImport = vi.fn().mockResolvedValue(undefined); const onClose = vi.fn();
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await act(async () => root.render(createElement(ImportResumeModal, { onClose, onImport })));
    expect((container.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(false);
    expect(button('Create new resume').disabled).toBe(true);
    await change(source(), 'Jane Doe\nEXPERIENCE\nEngineer | Acme\n2020-01 - 2023-06\n- Built tools\nSKILLS\nTypeScript');
    await act(async () => button('Parse and review').click());
    expect(fetch).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('JSON');
    expect(container.querySelector('[aria-label="Detected sections"]')?.textContent).toContain('Experience: 1 entry');
    expect(container.querySelector('[aria-label="Detected sections"]')?.textContent).toContain('Skills: 1 entry');
    expect(container.querySelector('[aria-label="Detected sections"]')?.textContent).toContain('Education: 0 entries');
    expect(container.querySelector('[aria-label="Import warnings"]')?.textContent).toContain('Parsing is best-effort');
    expect(button('Create new resume').disabled).toBe(true);
    expect(onImport).not.toHaveBeenCalled();
    await check(review());
    await change(field('Name', group('Contact and summary')), 'Janet Doe');
    expect(review().checked).toBe(false);
    expect(button('Create new resume').disabled).toBe(true);
    await change(field('Email'), 'janet@example.com');
    await change(field('Summary'), 'Builds reliable software.');
    await change(field('Company'), 'Corrected company');
    await change(field('Start date'), '2021-02');
    await change(field('End date'), '');
    await check(field('Currently work here') as HTMLInputElement);
    await change(field('Achievements (one per line)'), 'Built accessible tools\n\nReduced errors by 20%\n');
    await change(field('Skills', group('Skills 1')), 'TypeScript, React');
    await change(field('New resume name'), '  Reviewed resume  ');
    await check(review());
    await act(async () => button('Create new resume').click());
    expect(onImport).toHaveBeenCalledOnce();
    expect(onImport.mock.calls[0][0].personalInfo).toMatchObject({ name: 'Janet Doe', email: 'janet@example.com', summary: 'Builds reliable software.' });
    expect(onImport.mock.calls[0][0].sections.experience[0]).toMatchObject({ company: 'Corrected company', startDate: '2021-02', endDate: '', current: true, achievements: ['Built accessible tools', 'Reduced errors by 20%'] });
    expect(onImport.mock.calls[0][0].sections.skills[0].skills).toBe('TypeScript, React');
    expect(onImport.mock.calls[0][0].styling).toBeDefined();
    expect(onImport.mock.calls[0][1]).toBe('Reviewed resume');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('invalidates stale candidates when source text changes', async () => {
    await act(async () => root.render(createElement(ImportResumeModal, { onClose: vi.fn(), onImport: vi.fn() })));
    await change(source(), 'Jane Doe\nSKILLS\nTypeScript');
    await act(async () => button('Parse and review').click());
    await check(review());
    await change(source(), 'Corrected name');
    expect(container.querySelectorAll('textarea')).toHaveLength(1);
    expect(button('Create new resume').disabled).toBe(true);
  });

  it('rejects invalid edited dates before calling the owner and allows correction', async () => {
    const onImport = vi.fn();
    await act(async () => root.render(createElement(ImportResumeModal, { onClose: vi.fn(), onImport })));
    await change(source(), 'Jane Doe\nEXPERIENCE\nEngineer | Acme\n2020-01 - Present');
    await act(async () => button('Parse and review').click());
    await change(field('Start date'), '2020-13');
    await check(review());
    await act(async () => button('Create new resume').click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Invalid startDate');
    expect(onImport).not.toHaveBeenCalled();
    await change(field('Start date'), '2020-12');
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(button('Create new resume').disabled).toBe(true);
    await check(review());
    await act(async () => button('Create new resume').click());
    expect(onImport).toHaveBeenCalledOnce();
  });

  it('keeps the candidate open when safe creation fails', async () => {
    const onClose = vi.fn();
    await act(async () => root.render(createElement(ImportResumeModal, { onClose, onImport: vi.fn().mockRejectedValue(new Error('Storage is full')) })));
    await change(source(), 'Jane Doe');
    await act(async () => button('Parse and review').click());
    await change(field('Name', group('Contact and summary')), 'Reviewed name');
    await check(review());
    await act(async () => button('Create new resume').click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Storage is full');
    expect(onClose).not.toHaveBeenCalled();
    expect(field('Name', group('Contact and summary')).value).toBe('Reviewed name');
    expect(button('Create new resume').disabled).toBe(false);
  });

  it('edits every detected section and retains uncertain notes as hidden custom content', async () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    await act(async () => root.render(createElement(ImportResumeModal, { onClose: vi.fn(), onImport })));
    await change(source(), 'Jane Doe\nUnclassified detail\nEDUCATION\nUniversity | BS | Computing\n2016-01 - 2020-06\nPROJECTS\nPortfolio (2024)\n- Built a site\nCERTIFICATIONS\nCloud Certificate, Provider, 2024\nAWARDS\nTeam Award, Acme, Great work');
    await act(async () => button('Parse and review').click());
    const counts = container.querySelector('[aria-label="Detected sections"]')!.textContent;
    for (const section of ['Education', 'Projects', 'Certifications', 'Awards']) expect(counts).toContain(`${section}: 1 entry`);
    expect(counts).toContain('Import notes: 1 entry (hidden from resume)');
    expect(container.querySelector('[aria-label="Import warnings"]')?.textContent).toContain('Some lines could not be confidently mapped');
    expect(field('Notes').value).toContain('Unclassified detail');
    await change(field('Institution'), 'Corrected university');
    await change(field('Coursework'), 'Algorithms\nDatabases');
    await change(field('Description', group('Projects 1')), 'Accessible portfolio');
    await change(field('Project URL'), 'https://example.com');
    await change(field('Expiry date'), '2027-06');
    await change(field('Credential ID'), 'CERT-123');
    await change(field('Title', group('Awards 1')), 'Corrected award');
    await change(field('Notes'), 'Retained review notes\nUnclassified detail');
    await check(review());
    await act(async () => button('Create new resume').click());
    const data = onImport.mock.calls[0][0];
    expect(data.sections.education[0]).toMatchObject({ institution: 'Corrected university', coursework: 'Algorithms\nDatabases' });
    expect(data.sections.projects[0]).toMatchObject({ description: 'Accessible portfolio', url: 'https://example.com' });
    expect(data.sections.certifications[0]).toMatchObject({ expiryDate: '2027-06', credentialId: 'CERT-123' });
    expect(data.sections.awards[0].title).toBe('Corrected award');
    expect(data.sections.custom[0].entries[0].content).toBe('Retained review notes\nUnclassified detail');
    expect(data.sectionOrder).toContainEqual({ id: data.sections.custom[0].id, type: 'custom', name: 'Import notes', visible: false });
  });

  it('never creates a resume just by parsing, editing, or cancelling review', async () => {
    const onImport = vi.fn(); const onClose = vi.fn();
    await act(async () => root.render(createElement(ImportResumeModal, { onClose, onImport })));
    expect(container.textContent).toContain('Your current resume will not be overwritten.');
    await change(source(), 'Jane Doe\nSKILLS\nTypeScript');
    await act(async () => button('Parse and review').click());
    await change(field('Name', group('Contact and summary')), 'Edited name');
    await check(review());
    await act(async () => button('Cancel').click());
    expect(onClose).toHaveBeenCalledOnce();
    expect(onImport).not.toHaveBeenCalled();
  });

  it('isolates the background, traps focus, and restores it on dismissal', async () => {
    const trigger = document.createElement('button');
    document.body.prepend(trigger); trigger.focus();
    const onClose = vi.fn();
    try {
      await act(async () => root.render(createElement(ImportResumeModal, { onClose, onImport: vi.fn() })));
      const close = container.querySelector<HTMLButtonElement>('[aria-label="Close import"]')!;
      expect(document.activeElement).toBe(close);
      expect(trigger.hasAttribute('inert')).toBe(true);
      expect(document.body.style.overflow).toBe('hidden');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
      expect(document.activeElement).toBe(button('Cancel'));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      expect(document.activeElement).toBe(close);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(onClose).toHaveBeenCalledOnce();
      await act(async () => root.render(null));
      expect(trigger.hasAttribute('inert')).toBe(false);
      expect(document.body.style.overflow).toBe('');
      expect(document.activeElement).toBe(trigger);
    } finally { trigger.remove(); }
  });

  it('blocks Escape and duplicate creation while busy, then allows dismissal after failure', async () => {
    let rejectImport!: (error: Error) => void;
    const onImport = vi.fn(() => new Promise<void>((_, reject) => { rejectImport = reject; }));
    const onClose = vi.fn();
    await act(async () => root.render(createElement(ImportResumeModal, { onClose, onImport })));
    await change(source(), 'Jane Doe');
    await act(async () => button('Parse and review').click());
    await check(review());
    await act(async () => { button('Create new resume').click(); button('Create new resume').click(); });
    expect(onImport).toHaveBeenCalledOnce();
    expect(container.querySelector('[role="dialog"]')?.getAttribute('aria-busy')).toBe('true');
    expect(button('Cancel').disabled).toBe(true);
    expect(field('Name', group('Contact and summary')).disabled).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => rejectImport(new Error('Save failed; current resume unchanged')));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('current resume unchanged');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onImport).toHaveBeenCalledOnce();
  });
});
