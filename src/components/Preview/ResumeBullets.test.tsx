// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ResumeDocument } from './ResumePreview';
import { buildResumeDataFromParsed, heuristicParseResume } from '../../utils/resumeImport';

afterEach(() => { document.head.innerHTML = ''; document.body.innerHTML = ''; });

describe.each(['professional', 'modern', 'classic', 'compact', 'executive'] as const)('%s uploaded bullets', template => {
  it.each(['resume-preview', 'pdf-render'])('restores visible list markers after the CSS reset in %s', id => {
    const reset = document.createElement('style');
    reset.textContent = 'ol, ul, menu { list-style: none; margin: 0; padding: 0; }';
    document.head.append(reset);
    const data = buildResumeDataFromParsed(heuristicParseResume(
      'Jane Doe\nEXPERIENCE\nEngineer | Acme\n2020-03 - Present\n\u2022 Built reliable APIs\n\uf0b7 Reduced latency by 40%'
    ));
    data.styling.template = template;
    document.body.innerHTML = renderToStaticMarkup(<ResumeDocument data={data} id={id} />);
    const list = document.querySelector(`#${id} ul`)!;
    expect(list).not.toBeNull();
    expect(Array.from(list.querySelectorAll('li')).map(item => item.textContent)).toEqual([
      'Built reliable APIs', 'Reduced latency by 40%',
    ]);
    expect(getComputedStyle(list).listStyleType).toBe('disc');
    expect(getComputedStyle(list).listStylePosition).toBe('outside');
    expect(getComputedStyle(list.querySelector('li')!).display).toBe('list-item');
    expect(parseFloat((list as HTMLElement).style.marginLeft)).toBeGreaterThan(0);
  });
});
