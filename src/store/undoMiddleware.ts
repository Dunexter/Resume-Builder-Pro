import { Middleware } from '@reduxjs/toolkit';
import { pushHistorySnapshot } from './resumeSlice';
import type { RootState } from './store';

/** Action types that mutate `state.resume.data` and should be snapshot-able for undo/redo. */
const MUTATING_ACTIONS = new Set([
  'resume/updatePersonalInfo',
  'resume/addEducation', 'resume/updateEducation', 'resume/removeEducation',
  'resume/addExperience', 'resume/updateExperience', 'resume/removeExperience',
  'resume/addProject', 'resume/updateProject', 'resume/removeProject',
  'resume/addSkill', 'resume/updateSkill', 'resume/removeSkill',
  'resume/addAward', 'resume/updateAward', 'resume/removeAward',
  'resume/addCertification', 'resume/updateCertification', 'resume/removeCertification',
  'resume/addCustomSection', 'resume/updateCustomSection', 'resume/removeCustomSection',
  'resume/addCustomSectionEntry', 'resume/updateCustomSectionEntry', 'resume/removeCustomSectionEntry',
  'resume/updateSectionOrder', 'resume/toggleSectionVisibility',
  'resume/updateStyling',
  'resume/insertMissingKeyword',
  'resume/loadResumeData',
]);

/**
 * Captures a snapshot of `state.resume.data` before any mutating action is applied,
 * enabling `undo`/`redo` reducers in resumeSlice to restore prior states.
 */
export const undoRedoMiddleware: Middleware<object, RootState> = (storeApi) => (next) => (action) => {
  if (
    typeof action === 'object' &&
    action !== null &&
    'type' in action &&
    typeof (action as { type: unknown }).type === 'string' &&
    MUTATING_ACTIONS.has((action as { type: string }).type)
  ) {
    const snapshot = storeApi.getState().resume.data;
    storeApi.dispatch(pushHistorySnapshot(snapshot));
  }
  return next(action);
};
