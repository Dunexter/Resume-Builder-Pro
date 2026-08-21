import React, { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { store } from './store/store';
import Header from './components/Layout/Header';
import Sidebar from './components/Layout/Sidebar';
import FormContainer from './components/Forms/FormContainer';
import PreviewContainer from './components/Preview/PreviewContainer';
import TemplateGallery from './components/Modals/TemplateGallery';
import ResumeManager from './components/Modals/ResumeManager';
import CoverLetterBuilder from './components/Modals/CoverLetterBuilder';
import WelcomeModal from './components/Modals/WelcomeModal';
import VersionHistoryModal from './components/Modals/VersionHistoryModal';
import { useAutoSave } from './hooks';
import {
  loadResumeData,
  setResumeList,
  setActiveResumeId,
  updateSettings,
  DEFAULT_RESUME_ID,
} from './store/resumeSlice';
import { migrateFromLocalStorage, listResumes, saveResume, loadSettings } from './db/resumeDB';
import { useAppSelector } from './hooks';
import { blankResumeData, sampleResumeData } from './data/sampleResume';
import { ResumeData } from './types/resume';

const AppContent: React.FC = () => {
  useAutoSave();
  const darkMode = useAppSelector(state => state.resume.settings.darkMode);
  const showTemplateGallery = useAppSelector(state => state.resume.showTemplateGallery);
  const showCoverLetterBuilder = useAppSelector(state => state.resume.showCoverLetterBuilder);
  const [showResumeManager, setShowResumeManager] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [booting, setBooting] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit');

  useEffect(() => {
    const init = async () => {
      await migrateFromLocalStorage(DEFAULT_RESUME_ID);

      const savedSettings = await loadSettings();
      if (savedSettings) {
        store.dispatch(updateSettings(savedSettings));
      }

      const resumes = await listResumes();
      if (resumes.length > 0) {
        const list = resumes.map(r => ({
          id: r.id,
          name: r.name,
          updatedAt: r.updatedAt,
          targetJob: r.targetJob,
        }));
        store.dispatch(setResumeList(list));

        const latest = resumes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
        store.dispatch(setActiveResumeId(latest.id));
        store.dispatch(loadResumeData(latest.data));
        setShowWelcome(false);
      } else {
        // First visit — let the user pick blank vs sample before writing IndexedDB
        setShowWelcome(true);
      }
      setBooting(false);
    };
    init();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const persistFirstResume = async (data: ResumeData, name: string) => {
    const now = new Date().toISOString();
    await saveResume({
      id: DEFAULT_RESUME_ID,
      name,
      createdAt: now,
      updatedAt: now,
      data,
      versions: [],
    });
    store.dispatch(setResumeList([{ id: DEFAULT_RESUME_ID, name, updatedAt: now }]));
    store.dispatch(setActiveResumeId(DEFAULT_RESUME_ID));
    store.dispatch(loadResumeData(data));
    setShowWelcome(false);
  };

  const handleChooseBlank = () => {
    void persistFirstResume(blankResumeData, 'My Resume');
  };

  const handleChooseSample = () => {
    void persistFirstResume(sampleResumeData, sampleResumeData.personalInfo.name || 'Sample Resume');
  };

  if (booting) {
    return (
      <div className={`h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900 text-gray-300' : 'bg-gray-50 text-gray-600'}`}>
        <p className="text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col overflow-hidden transition-colors duration-200 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Header
        onOpenResumeManager={() => setShowResumeManager(true)}
        onOpenVersions={() => setShowVersions(true)}
        onToggleMobileSidebar={() => setMobileSidebarOpen(prev => !prev)}
      />

      <div className={`flex md:hidden border-b ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
        <button
          onClick={() => setMobileTab('edit')}
          className={`flex-1 py-2 text-sm font-medium ${mobileTab === 'edit' ? (darkMode ? 'text-indigo-300 border-b-2 border-indigo-400' : 'text-indigo-600 border-b-2 border-indigo-600') : (darkMode ? 'text-gray-400' : 'text-gray-500')}`}
        >
          Edit
        </button>
        <button
          onClick={() => setMobileTab('preview')}
          className={`flex-1 py-2 text-sm font-medium ${mobileTab === 'preview' ? (darkMode ? 'text-indigo-300 border-b-2 border-indigo-400' : 'text-indigo-600 border-b-2 border-indigo-600') : (darkMode ? 'text-gray-400' : 'text-gray-500')}`}
        >
          Preview
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
        <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />

        <div className="flex-1 flex min-w-0 overflow-hidden">
          <div className={`${mobileTab === 'preview' ? 'hidden md:flex' : 'flex'} w-full md:w-2/5 border-r flex-col min-h-0 overflow-hidden ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
            <FormContainer />
          </div>

          <div className={`${mobileTab === 'edit' ? 'hidden md:flex' : 'flex'} w-full md:w-3/5 overflow-hidden flex-col ${darkMode ? 'bg-gray-900' : ''}`}>
            <PreviewContainer />
          </div>
        </div>
      </div>

      {showTemplateGallery && <TemplateGallery />}
      {showCoverLetterBuilder && <CoverLetterBuilder />}
      {showResumeManager && <ResumeManager onClose={() => setShowResumeManager(false)} />}
      {showVersions && <VersionHistoryModal onClose={() => setShowVersions(false)} />}
      {showWelcome && (
        <WelcomeModal onChooseBlank={handleChooseBlank} onChooseSample={handleChooseSample} />
      )}
    </div>
  );
};

function App() {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
}

export default App;
