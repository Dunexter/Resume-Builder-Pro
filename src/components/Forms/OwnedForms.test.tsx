// @vitest-environment jsdom
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import resumeReducer, { addEducation, addCertification, addProject, addAward, addCustomSection, addCustomSectionEntry, toggleSectionVisibility } from '../../store/resumeSlice';
import EducationForm from './EducationForm';
import CertificationsForm from './CertificationsForm';
import ProjectsForm from './ProjectsForm';
import AwardsForm from './AwardsForm';
import CustomSectionForm from './CustomSectionForm';
import StylingForm from './StylingForm';
const { act } = React;

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it('associates all owned form labels and names every input and icon button', () => {
  const store = configureStore({ reducer: { resume: resumeReducer } });
  store.dispatch(addEducation());
  store.dispatch(addCertification());
  store.dispatch(addProject());
  store.dispatch(addAward());
  store.dispatch(addCustomSection('Volunteering'));
  const sectionId = store.getState().resume.data.sections.custom[0].id;
  store.dispatch(addCustomSectionEntry(sectionId));
  act(() => root.render(<Provider store={store}>
    <EducationForm /><CertificationsForm /><ProjectsForm /><AwardsForm /><CustomSectionForm sectionId={sectionId} /><StylingForm />
  </Provider>));
  for (const label of host.querySelectorAll('label')) expect(label.control, label.textContent || '').not.toBeNull();
  for (const input of host.querySelectorAll<HTMLInputElement>('input, textarea, select')) {
    expect(input.labels?.length || input.getAttribute('aria-label'), input.outerHTML).toBeTruthy();
  }
  for (const button of host.querySelectorAll('button')) expect(button.textContent?.trim() || button.getAttribute('aria-label')).toBeTruthy();
});

it('explains hidden certifications and enables them without losing entries', () => {
  const store = configureStore({ reducer: { resume: resumeReducer } });
  store.dispatch(addCertification());
  const section = store.getState().resume.data.sectionOrder.find(s => s.type === 'certifications')!;
  if (section.visible) store.dispatch(toggleSectionVisibility(section.id));
  act(() => root.render(<Provider store={store}><CertificationsForm /></Provider>));
  expect(host.textContent).toContain('Certifications are hidden');
  act(() => Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'Show certifications on resume')!.click());
  expect(store.getState().resume.data.sectionOrder.find(s => s.id === section.id)!.visible).toBe(true);
  expect(store.getState().resume.data.sections.certifications).toHaveLength(1);
  expect(host.textContent).not.toContain('Certifications are hidden');
});
