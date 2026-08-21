import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  ResumeState,
  ResumeData,
  PersonalInfo,
  EducationEntry,
  ExperienceEntry,
  ProjectEntry,
  SkillEntry,
  AwardEntry,
  CertificationEntry,
  CustomSection,
  CustomSectionEntry,
  SectionOrder,
  AppSettings,
  JDMatchResult,
} from '../types/resume';
import { v4 as uuidv4 } from 'uuid';
import { blankResumeData } from '../data/sampleResume';

export const DEFAULT_RESUME_ID = 'default-resume';

/** Default editor state is blank; sample lives in `src/data/sampleResume.ts`. */
export const initialResumeData: ResumeData = blankResumeData;

const defaultSettings: AppSettings = {
  ai: {
    provider: 'none',
    apiKey: '',
    model: '',
  },
  darkMode: false,
  autoSave: true,
};

const initialState: ResumeState = {
  resumeList: [{ id: DEFAULT_RESUME_ID, name: 'My Resume', updatedAt: new Date().toISOString() }],
  activeResumeId: DEFAULT_RESUME_ID,
  data: initialResumeData,
  activeSection: 'personal',
  isLoading: false,
  lastSaved: null,
  jobDescription: '',
  jdMatchResult: null,
  settings: defaultSettings,
  showTemplateGallery: false,
  showCoverLetterBuilder: false,
  history: { past: [], future: [] },
};

export const MAX_HISTORY = 50;

const resumeSlice = createSlice({
  name: 'resume',
  initialState,
  reducers: {
    setResumeList: (state, action: PayloadAction<typeof initialState.resumeList>) => {
      state.resumeList = action.payload;
    },
    setActiveResumeId: (state, action: PayloadAction<string>) => {
      state.activeResumeId = action.payload;
    },
    addResumeToList: (state, action: PayloadAction<{ id: string; name: string; targetJob?: string }>) => {
      state.resumeList.push({
        id: action.payload.id,
        name: action.payload.name,
        updatedAt: new Date().toISOString(),
        targetJob: action.payload.targetJob,
      });
    },
    removeResumeFromList: (state, action: PayloadAction<string>) => {
      state.resumeList = state.resumeList.filter(r => r.id !== action.payload);
    },
    updateResumeListItem: (state, action: PayloadAction<{ id: string; name?: string; targetJob?: string }>) => {
      const idx = state.resumeList.findIndex(r => r.id === action.payload.id);
      if (idx !== -1) {
        if (action.payload.name !== undefined) state.resumeList[idx].name = action.payload.name;
        if (action.payload.targetJob !== undefined) state.resumeList[idx].targetJob = action.payload.targetJob;
        state.resumeList[idx].updatedAt = new Date().toISOString();
      }
    },

    updatePersonalInfo: (state, action: PayloadAction<Partial<PersonalInfo>>) => {
      state.data.personalInfo = { ...state.data.personalInfo, ...action.payload };
    },

    addEducation: (state) => {
      state.data.sections.education.push({
        id: uuidv4(),
        institution: '',
        degree: '',
        field: '',
        startDate: '',
        endDate: '',
        gpa: '',
        coursework: '',
        honors: '',
      });
    },
    updateEducation: (state, action: PayloadAction<{ id: string; data: Partial<EducationEntry> }>) => {
      const idx = state.data.sections.education.findIndex(e => e.id === action.payload.id);
      if (idx !== -1) state.data.sections.education[idx] = { ...state.data.sections.education[idx], ...action.payload.data };
    },
    removeEducation: (state, action: PayloadAction<string>) => {
      state.data.sections.education = state.data.sections.education.filter(e => e.id !== action.payload);
    },

    addExperience: (state) => {
      state.data.sections.experience.push({
        id: uuidv4(),
        company: '',
        position: '',
        location: '',
        startDate: '',
        endDate: '',
        current: false,
        achievements: [''],
        technologies: '',
      });
    },
    updateExperience: (state, action: PayloadAction<{ id: string; data: Partial<ExperienceEntry> }>) => {
      const idx = state.data.sections.experience.findIndex(e => e.id === action.payload.id);
      if (idx !== -1) state.data.sections.experience[idx] = { ...state.data.sections.experience[idx], ...action.payload.data };
    },
    removeExperience: (state, action: PayloadAction<string>) => {
      state.data.sections.experience = state.data.sections.experience.filter(e => e.id !== action.payload);
    },

    addProject: (state) => {
      state.data.sections.projects.push({
        id: uuidv4(),
        title: '',
        year: '',
        description: '',
        technologies: '',
        url: '',
      });
    },
    updateProject: (state, action: PayloadAction<{ id: string; data: Partial<ProjectEntry> }>) => {
      const idx = state.data.sections.projects.findIndex(p => p.id === action.payload.id);
      if (idx !== -1) state.data.sections.projects[idx] = { ...state.data.sections.projects[idx], ...action.payload.data };
    },
    removeProject: (state, action: PayloadAction<string>) => {
      state.data.sections.projects = state.data.sections.projects.filter(p => p.id !== action.payload);
    },

    addSkill: (state) => {
      state.data.sections.skills.push({ id: uuidv4(), category: '', skills: '' });
    },
    updateSkill: (state, action: PayloadAction<{ id: string; data: Partial<SkillEntry> }>) => {
      const idx = state.data.sections.skills.findIndex(s => s.id === action.payload.id);
      if (idx !== -1) state.data.sections.skills[idx] = { ...state.data.sections.skills[idx], ...action.payload.data };
    },
    removeSkill: (state, action: PayloadAction<string>) => {
      state.data.sections.skills = state.data.sections.skills.filter(s => s.id !== action.payload);
    },

    addAward: (state) => {
      state.data.sections.awards.push({ id: uuidv4(), title: '', issuer: '', date: '', description: '' });
    },
    updateAward: (state, action: PayloadAction<{ id: string; data: Partial<AwardEntry> }>) => {
      const idx = state.data.sections.awards.findIndex(a => a.id === action.payload.id);
      if (idx !== -1) state.data.sections.awards[idx] = { ...state.data.sections.awards[idx], ...action.payload.data };
    },
    removeAward: (state, action: PayloadAction<string>) => {
      state.data.sections.awards = state.data.sections.awards.filter(a => a.id !== action.payload);
    },

    addCertification: (state) => {
      state.data.sections.certifications.push({
        id: uuidv4(),
        name: '',
        issuer: '',
        date: '',
        expiryDate: '',
        credentialId: '',
      });
    },
    updateCertification: (state, action: PayloadAction<{ id: string; data: Partial<CertificationEntry> }>) => {
      const idx = state.data.sections.certifications.findIndex(c => c.id === action.payload.id);
      if (idx !== -1) state.data.sections.certifications[idx] = { ...state.data.sections.certifications[idx], ...action.payload.data };
    },
    removeCertification: (state, action: PayloadAction<string>) => {
      state.data.sections.certifications = state.data.sections.certifications.filter(c => c.id !== action.payload);
    },

    addCustomSection: (state, action: PayloadAction<string>) => {
      const id = uuidv4();
      const newSection: CustomSection = { id, name: action.payload, entries: [] };
      state.data.sections.custom.push(newSection);
      state.data.sectionOrder.push({ id, type: 'custom', name: action.payload, visible: true });
    },
    updateCustomSection: (state, action: PayloadAction<{ id: string; name: string }>) => {
      const idx = state.data.sections.custom.findIndex(s => s.id === action.payload.id);
      if (idx !== -1) state.data.sections.custom[idx].name = action.payload.name;
      const orderIdx = state.data.sectionOrder.findIndex(s => s.id === action.payload.id);
      if (orderIdx !== -1) state.data.sectionOrder[orderIdx].name = action.payload.name;
    },
    removeCustomSection: (state, action: PayloadAction<string>) => {
      state.data.sections.custom = state.data.sections.custom.filter(s => s.id !== action.payload);
      state.data.sectionOrder = state.data.sectionOrder.filter(s => s.id !== action.payload);
    },
    addCustomSectionEntry: (state, action: PayloadAction<string>) => {
      const idx = state.data.sections.custom.findIndex(s => s.id === action.payload);
      if (idx !== -1) state.data.sections.custom[idx].entries.push({ id: uuidv4(), title: '', content: '' });
    },
    updateCustomSectionEntry: (state, action: PayloadAction<{ sectionId: string; entryId: string; data: Partial<CustomSectionEntry> }>) => {
      const sIdx = state.data.sections.custom.findIndex(s => s.id === action.payload.sectionId);
      if (sIdx !== -1) {
        const eIdx = state.data.sections.custom[sIdx].entries.findIndex(e => e.id === action.payload.entryId);
        if (eIdx !== -1) state.data.sections.custom[sIdx].entries[eIdx] = { ...state.data.sections.custom[sIdx].entries[eIdx], ...action.payload.data };
      }
    },
    removeCustomSectionEntry: (state, action: PayloadAction<{ sectionId: string; entryId: string }>) => {
      const idx = state.data.sections.custom.findIndex(s => s.id === action.payload.sectionId);
      if (idx !== -1) {
        state.data.sections.custom[idx].entries = state.data.sections.custom[idx].entries.filter(e => e.id !== action.payload.entryId);
      }
    },

    updateSectionOrder: (state, action: PayloadAction<SectionOrder[]>) => {
      state.data.sectionOrder = action.payload;
    },
    toggleSectionVisibility: (state, action: PayloadAction<string>) => {
      const idx = state.data.sectionOrder.findIndex(s => s.id === action.payload);
      if (idx !== -1) state.data.sectionOrder[idx].visible = !state.data.sectionOrder[idx].visible;
    },

    setActiveSection: (state, action: PayloadAction<string>) => {
      state.activeSection = action.payload;
    },
    setShowTemplateGallery: (state, action: PayloadAction<boolean>) => {
      state.showTemplateGallery = action.payload;
    },
    setShowCoverLetterBuilder: (state, action: PayloadAction<boolean>) => {
      state.showCoverLetterBuilder = action.payload;
    },

    updateStyling: (state, action: PayloadAction<Partial<ResumeData['styling']>>) => {
      state.data.styling = { ...state.data.styling, ...action.payload };
    },

    setLastSaved: (state, action: PayloadAction<string>) => {
      state.lastSaved = action.payload;
    },
    loadResumeData: (state, action: PayloadAction<ResumeData>) => {
      const loaded = action.payload;
      state.data = {
        personalInfo: { ...blankResumeData.personalInfo, ...loaded.personalInfo },
        sections: {
          education: loaded.sections?.education || [],
          experience: loaded.sections?.experience || [],
          skills: loaded.sections?.skills || [],
          projects: loaded.sections?.projects || [],
          awards: loaded.sections?.awards || [],
          certifications: loaded.sections?.certifications || [],
          custom: loaded.sections?.custom || [],
        },
        sectionOrder: loaded.sectionOrder || blankResumeData.sectionOrder,
        styling: {
          ...blankResumeData.styling,
          ...loaded.styling,
          colors: { ...blankResumeData.styling.colors, ...loaded.styling?.colors },
        },
      };
    },

    setJobDescription: (state, action: PayloadAction<string>) => {
      state.jobDescription = action.payload;
    },
    setJDMatchResult: (state, action: PayloadAction<JDMatchResult | null>) => {
      state.jdMatchResult = action.payload;
    },
    insertMissingKeyword: (state, action: PayloadAction<string>) => {
      const kw = action.payload;
      if (state.data.sections.skills.length > 0) {
        const last = state.data.sections.skills[state.data.sections.skills.length - 1];
        const existing = last.skills ? last.skills + ', ' + kw : kw;
        state.data.sections.skills[state.data.sections.skills.length - 1].skills = existing;
      } else {
        state.data.sections.skills.push({ id: uuidv4(), category: 'Additional Skills', skills: kw });
      }
    },

    updateSettings: (state, action: PayloadAction<Partial<AppSettings>>) => {
      state.settings = { ...state.settings, ...action.payload };
    },
    updateAISettings: (state, action: PayloadAction<Partial<AppSettings['ai']>>) => {
      state.settings.ai = { ...state.settings.ai, ...action.payload };
    },
    toggleDarkMode: (state) => {
      state.settings.darkMode = !state.settings.darkMode;
    },

    /** Internal: called by undoRedoMiddleware right before a mutating action is applied. */
    pushHistorySnapshot: (state, action: PayloadAction<ResumeData>) => {
      state.history.past.push(action.payload);
      if (state.history.past.length > MAX_HISTORY) state.history.past.shift();
      state.history.future = [];
    },
    undo: (state) => {
      const prev = state.history.past.pop();
      if (!prev) return;
      state.history.future.unshift(state.data);
      state.data = prev;
    },
    redo: (state) => {
      const next = state.history.future.shift();
      if (!next) return;
      state.history.past.push(state.data);
      state.data = next;
    },
  },
});

export const {
  setResumeList,
  setActiveResumeId,
  addResumeToList,
  removeResumeFromList,
  updateResumeListItem,
  updatePersonalInfo,
  addEducation, updateEducation, removeEducation,
  addExperience, updateExperience, removeExperience,
  addProject, updateProject, removeProject,
  addSkill, updateSkill, removeSkill,
  addAward, updateAward, removeAward,
  addCertification, updateCertification, removeCertification,
  addCustomSection, updateCustomSection, removeCustomSection,
  addCustomSectionEntry, updateCustomSectionEntry, removeCustomSectionEntry,
  updateSectionOrder, toggleSectionVisibility,
  setActiveSection,
  setShowTemplateGallery,
  setShowCoverLetterBuilder,
  updateStyling,
  setLastSaved,
  loadResumeData,
  setJobDescription,
  setJDMatchResult,
  insertMissingKeyword,
  updateSettings,
  updateAISettings,
  toggleDarkMode,
  pushHistorySnapshot,
  undo,
  redo,
} = resumeSlice.actions;

export default resumeSlice.reducer;
