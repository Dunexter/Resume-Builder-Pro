import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ResumeDocument } from './ResumePreview';
import { fieldValues, fullResume } from './shared/fieldFidelity.fixture';

describe.each(['professional', 'modern', 'classic', 'compact', 'executive'] as const)('%s template', template => {
  it('renders every field including optional details and uncategorized skills', () => {
    const data = fullResume();
    data.styling.template = template;
    data.sectionOrder[6].name = 'Stale custom heading';
    const html = renderToStaticMarkup(React.createElement(ResumeDocument, { data }));
    for (const field of [...fieldValues, 'Feb 2010', 'Jun 2014', 'Jan 2015']) expect(html).toContain(field);
    expect(html).toContain('data-pdf-row');
    expect(html).toContain('Volunteering');
    expect(html).not.toContain('Stale custom heading');
  });

  it('respects section visibility and keeps certificate dates without issuer', () => {
    const data = fullResume();
    data.styling.template = template;
    data.sectionOrder[0].visible = false;
    data.sectionOrder[6].visible = false;
    data.sections.certifications[0].issuer = '';
    const html = renderToStaticMarkup(React.createElement(ResumeDocument, { data }));
    expect(html).not.toContain('Summa Cum Laude');
    expect(html).not.toContain('Volunteer content');
    expect(html).toContain('2024');
  });
});
