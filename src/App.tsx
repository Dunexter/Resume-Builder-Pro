import React, { useEffect, useRef, useState } from 'react';
import { Provider } from 'react-redux';
import { Analytics } from '@vercel/analytics/react';
import { store } from './store/store';
import Header from './components/Layout/Header';
import Sidebar from './components/Layout/Sidebar';
import FormContainer from './components/Forms/FormContainer';
import PreviewContainer from './components/Preview/PreviewContainer';
import TemplateGallery from './components/Modals/TemplateGallery';
import ResumeManager from './components/Modals/ResumeManager';
import CoverLetterBuilder from './components/Modals/CoverLetterBuilder';
import JobFinderBot from './components/Modals/JobFinderBot';
import WelcomeModal from './components/Modals/WelcomeModal';
import VersionHistoryModal from './components/Modals/VersionHistoryModal';
import ImportResumeModal from './components/Modals/ImportResumeModal';
import { useAutoSave, useAppSelector } from './hooks';
import { setResumeList, setActiveSection, updateSettings, undo, redo, DEFAULT_RESUME_ID } from './store/resumeSlice';
import { migrateFromLocalStorage, listResumes, loadSettings } from './db/resumeDB';
import { createEditorResume, openEditorRecord, flushEditor } from './utils/editorPersistence';
import { validateAppSettings, validateResumeRecord } from './utils/resumeSchema';
import { blankResumeData, sampleResumeData } from './data/sampleResume';
import { ResumeData } from './types/resume';

export const AppContent: React.FC = () => {
  useAutoSave();
  const { settings: { darkMode }, showTemplateGallery, showCoverLetterBuilder, showJobFinderBot } = useAppSelector(state => state.resume);
  const [showResumeManager, setShowResumeManager] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [booting, setBooting] = useState(true);
  const [startupError, setStartupError] = useState('');
  const [creationError, setCreationError] = useState('');
  const [retry, setRetry] = useState(0);
  const [showWelcome, setShowWelcome] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit');
  const creating = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      setBooting(true);
      setStartupError('');
      try {
        await migrateFromLocalStorage(DEFAULT_RESUME_ID);
        const savedSettings = await loadSettings();
        const resumes = await listResumes();
        if (cancelled) return;
        if (savedSettings) {
          validateAppSettings(savedSettings);
          store.dispatch(updateSettings(savedSettings));
        }
        resumes.forEach(validateResumeRecord);
        store.dispatch(setResumeList(resumes.map(({ id, name, updatedAt, targetJob }) => ({ id, name, updatedAt, targetJob }))));
        if (resumes.length) {
          openEditorRecord(resumes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]);
          setShowWelcome(false);
        } else {
          setShowWelcome(true);
        }
      } catch (error) {
        if (!cancelled) setStartupError(error instanceof Error ? error.message : 'Unable to open browser storage.');
      } finally {
        if (!cancelled) setBooting(false);
      }
    };
    void init();
    return () => { cancelled = true; };
  }, [retry]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    const openImport = () => { setShowResumeManager(false); setShowImport(true); };
    const navigate = () => { setMobileTab('edit'); setMobileSidebarOpen(false); };
    const keyboard = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !store.getState().resume.hydrated || document.querySelector('[role="dialog"]')) return;
      const target = event.target as HTMLElement;
      if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        void flushEditor().catch(() => {});
      } else if (!target.closest('input, textarea, [contenteditable="true"]')) {
        if (event.key.toLowerCase() === 'z') {
          event.preventDefault();
          store.dispatch(event.shiftKey ? redo() : undo());
        } else if (event.key.toLowerCase() === 'y') {
          event.preventDefault();
          store.dispatch(redo());
        }
      }
    };
    window.addEventListener('open-resume-import', openImport);
    window.addEventListener('resume-navigate-edit', navigate);
    window.addEventListener('keydown', keyboard);
    return () => {
      window.removeEventListener('open-resume-import', openImport);
      window.removeEventListener('resume-navigate-edit', navigate);
      window.removeEventListener('keydown', keyboard);
    };
  }, []);

  const createResume = async (data: ResumeData, name: string) => {
    if (creating.current) throw new Error('A resume is already being created.');
    creating.current = true;
    try {
      await createEditorResume(data, name);
      store.dispatch(setActiveSection('personal'));
      setCreationError('');
      setShowWelcome(false);
      setMobileTab('edit');
    } finally {
      creating.current = false;
    }
  };

  const chooseResume = (data: ResumeData, name: string) => {
    void createResume(data, name).catch(error => setCreationError(error instanceof Error ? error.message : 'Could not save. Please retry.'));
  };

  if (booting) return <div role="status" className="h-screen flex items-center justify-center">Loading workspace...</div>;
  if (startupError) return (
    <main className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
      <div className="max-w-lg space-y-4">
        <h1 className="text-xl font-bold">Unable to load your workspace</h1>
        <p role="alert" className="break-words">{startupError}</p>
        <p>Your saved data has not been deleted. Check that browser storage is available, then retry. Do not clear site data unless you have a backup.</p>
        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-white" onClick={() => setRetry(value => value + 1)}>Retry</button>
      </div>
    </main>
  );

  return (
    <div className={`h-screen h-[100dvh] flex flex-col overflow-hidden transition-colors duration-200 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Header onOpenResumeManager={() => setShowResumeManager(true)} onOpenVersions={() => setShowVersions(true)} onToggleMobileSidebar={() => setMobileSidebarOpen(prev => !prev)} />
      <div className={`flex lg:hidden border-b ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`} aria-label="Editor view">
        {(['edit', 'preview'] as const).map(tab => <button key={tab} aria-pressed={mobileTab === tab} onClick={() => setMobileTab(tab)} className={`flex-1 py-2 text-sm font-medium ${mobileTab === tab ? 'text-indigo-500 border-b-2 border-indigo-500' : 'text-gray-500'}`}>{tab === 'edit' ? 'Edit' : 'Preview'}</button>)}
      </div>
      <div className="flex-1 flex overflow-hidden min-h-0">
        <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />
        <div className="flex-1 flex min-w-0 overflow-hidden">
          <div className={`${mobileTab === 'preview' ? 'hidden lg:flex' : 'flex'} w-full lg:w-1/2 xl:w-2/5 border-r flex-col min-h-0 overflow-hidden ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
            <FormContainer />
          </div>
          <div className={`${mobileTab === 'edit' ? 'hidden lg:flex' : 'flex'} w-full lg:w-1/2 xl:w-3/5 overflow-hidden flex-col ${darkMode ? 'bg-gray-900' : ''}`}>
            <PreviewContainer />
          </div>
        </div>
      </div>
      {showTemplateGallery && <TemplateGallery />}
      {showCoverLetterBuilder && <CoverLetterBuilder />}
      {showJobFinderBot && <JobFinderBot />}
      {showResumeManager && <ResumeManager onClose={() => setShowResumeManager(false)} />}
      {showVersions && <VersionHistoryModal onClose={() => setShowVersions(false)} />}
      {showWelcome && !showImport && <WelcomeModal
        onChooseBlank={() => chooseResume(blankResumeData, 'My Resume')}
        onChooseSample={() => chooseResume(sampleResumeData, 'Sample Resume')}
        error={creationError}
      />}
      {showImport && <ImportResumeModal onClose={() => setShowImport(false)} onImport={createResume} />}
    </div>
  );
};

function App() {
  return <Provider store={store}><AppContent /><Analytics /></Provider>;
}

export default App;
