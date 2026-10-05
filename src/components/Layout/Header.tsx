import React, { useEffect, useRef, useState } from 'react';
import {
  FileText, Download, Save, Moon, Sun, Layers, ChevronDown,
  FileCode, AlignLeft, Sparkles, History, Undo2, Redo2, Menu, Bot,
} from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../../hooks';
import { toggleDarkMode, setShowTemplateGallery, setShowCoverLetterBuilder, setShowJobFinderBot, undo, redo } from '../../store/resumeSlice';
import { flushEditor } from '../../utils/editorPersistence';
import { validateResumeForExport, formatValidationMessage } from '../../utils/validationUtils';

interface HeaderProps {
  onOpenResumeManager: () => void;
  onOpenVersions: () => void;
  onToggleMobileSidebar?: () => void;
}

type ExportFormat = 'ats' | 'visual' | 'docx' | 'txt' | 'markdown' | 'latex';

const Header: React.FC<HeaderProps> = ({ onOpenResumeManager, onOpenVersions, onToggleMobileSidebar }) => {
  const dispatch = useAppDispatch();
  const { lastSaved, hydrated, saveStatus, saveError, settings, data: resumeData, activeResumeId, resumeList, history } = useAppSelector(state => state.resume);
  const darkMode = settings.darkMode;
  const documentName = resumeList.find(record => record.id === activeResumeId)?.name || 'My Resume';
  const [exportOpen, setExportOpen] = useState(false);
  const [busy, setBusy] = useState<'save' | 'export' | 'transition' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const exportButton = useRef<HTMLButtonElement>(null);
  const exportPanel = useRef<HTMLDivElement>(null);
  const disabled = !hydrated || busy !== null;

  useEffect(() => {
    if (!exportOpen) return;
    exportPanel.current?.querySelector('button')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setExportOpen(false);
        exportButton.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [exportOpen]);

  const saveOrOpen = async (afterSave?: () => void) => {
    if (!hydrated || busyRef.current) return;
    busyRef.current = true;
    setBusy(afterSave ? 'transition' : 'save');
    setError(null);
    try {
      await flushEditor();
      afterSave?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your resume. Please retry.');
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  };

  const handleExport = async (format: ExportFormat) => {
    if (!hydrated || busyRef.current) return;
    setExportOpen(false);
    exportButton.current?.focus();
    setError(null);
    // Validate every format before entering the busy state, including cancelled warnings.
    const issues = validateResumeForExport(resumeData);
    if (issues.some(issue => issue.level === 'error')) {
      setError(formatValidationMessage(issues));
      return;
    }
    if (issues.some(issue => issue.level === 'warn') &&
      !window.confirm(`${formatValidationMessage(issues)}\n\nExport anyway?`)) return;

    busyRef.current = true;
    setBusy('export');
    try {
      // Downloads must remain available to rescue in-memory edits when storage fails.
      switch (format) {
        case 'ats':
          await (await import('../../utils/pdfExport')).exportAtsPDF(resumeData);
          break;
        case 'visual':
          await (await import('../../utils/pdfExport')).exportVisualPDF(resumeData);
          break;
        case 'docx':
          await (await import('../../utils/exportUtils')).exportDOCX(resumeData);
          break;
        case 'txt':
          await (await import('../../utils/exportUtils')).exportTXT(resumeData);
          break;
        case 'markdown':
          await (await import('../../utils/markdownExport')).exportMarkdown(resumeData);
          break;
        case 'latex':
          await (await import('../../utils/latexExport')).exportLatex(resumeData);
          break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed. Please try again.');
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  };

  const base = darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900';
  const btnBase = `disabled:opacity-40 disabled:cursor-not-allowed ${darkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`;
  const toolClass = `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${btnBase}`;
  const menuItem = `w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors ${darkMode ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-50 text-gray-700'}`;
  const statusText = !hydrated ? 'Loading...' : busy === 'save' || saveStatus === 'saving' ? 'Saving...' :
    saveStatus === 'error' ? 'Save failed' : saveStatus === 'dirty' ? 'Unsaved changes' :
      lastSaved ? `Saved at ${new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Saved';

  return (
    <header className={`app-chrome min-w-0 max-w-full border-b px-4 py-3 flex-shrink-0 z-20 ${base}`}>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 max-w-full items-center gap-2">
          {onToggleMobileSidebar && <button onClick={onToggleMobileSidebar} className={`p-2 rounded-lg md:hidden ${btnBase}`} aria-label="Toggle menu">
            <Menu className="h-5 w-5" />
          </button>}
          <FileText className="h-7 w-7 shrink-0 text-indigo-500" />
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-tight">ResumeBuilder Pro</h1>
            <p className="truncate text-sm" title={documentName} aria-label="Document name">{documentName}</p>
          </div>
        </div>
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
          <button onClick={() => dispatch(toggleDarkMode())} disabled={disabled} className={`p-2 rounded-lg ${btnBase}`} aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button onClick={() => dispatch(undo())} disabled={disabled || !history.past.length} aria-label="Undo" className={`p-2 rounded-lg ${btnBase}`}><Undo2 className="h-4 w-4" /></button>
          <button onClick={() => dispatch(redo())} disabled={disabled || !history.future.length} aria-label="Redo" className={`p-2 rounded-lg ${btnBase}`}><Redo2 className="h-4 w-4" /></button>
          <button onClick={() => void saveOrOpen()} disabled={disabled} className={toolClass}>
            <Save className="h-3.5 w-3.5" />{busy === 'save' ? 'Saving...' : saveStatus === 'error' ? 'Retry save' : 'Save'}
          </button>
          <div className="relative">
            <button ref={exportButton} onClick={() => setExportOpen(open => !open)} disabled={disabled}
              aria-expanded={exportOpen} aria-controls="resume-export-options"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-40">
              <Download className="h-3.5 w-3.5" />{busy === 'export' ? 'Exporting...' : 'Export'}<ChevronDown className="h-3 w-3" />
            </button>
            {exportOpen && <>
              <div className="fixed inset-0 z-10" aria-hidden="true" onClick={() => setExportOpen(false)} />
              <div ref={exportPanel} id="resume-export-options" role="group" aria-label="Export formats"
                className={`fixed left-4 right-4 mt-2 max-h-[60vh] overflow-y-auto rounded-xl shadow-xl border z-20 sm:absolute sm:left-auto sm:right-0 sm:w-56 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <button onClick={() => void handleExport('ats')} className={menuItem}><FileText className="h-4 w-4 text-red-500" />PDF (ATS)</button>
                <button onClick={() => void handleExport('visual')} className={menuItem}><FileText className="h-4 w-4 text-orange-500" />PDF (Visual)</button>
                <button onClick={() => void handleExport('docx')} className={menuItem}><FileCode className="h-4 w-4 text-blue-500" />Word (.docx)</button>
                <button onClick={() => void handleExport('txt')} className={menuItem}><AlignLeft className="h-4 w-4" />Plain Text</button>
                <button onClick={() => void handleExport('markdown')} className={menuItem}><FileCode className="h-4 w-4 text-purple-500" />Markdown (.md)</button>
                <button onClick={() => void handleExport('latex')} className={menuItem}><FileCode className="h-4 w-4 text-teal-500" />LaTeX (.tex)</button>
              </div>
            </>}
          </div>
        </div>
      </div>
      <nav aria-label="Resume tools" className="mt-3 flex min-w-0 max-w-full flex-wrap items-center gap-2">
        <button disabled={disabled} onClick={() => void saveOrOpen(onOpenResumeManager)} className={toolClass}><Layers className="h-3.5 w-3.5" />My Resumes</button>
        <button disabled={disabled} onClick={() => void saveOrOpen(onOpenVersions)} className={toolClass}><History className="h-3.5 w-3.5" />Versions</button>
        <button disabled={disabled} onClick={() => void saveOrOpen(() => dispatch(setShowTemplateGallery(true)))} className={toolClass}><Sparkles className="h-3.5 w-3.5" />Templates</button>
        <button disabled={disabled} onClick={() => void saveOrOpen(() => dispatch(setShowCoverLetterBuilder(true)))} className={toolClass}><AlignLeft className="h-3.5 w-3.5" />Cover Letter</button>
        <button disabled={disabled} onClick={() => void saveOrOpen(() => dispatch(setShowJobFinderBot(true)))} className={toolClass}><Bot className="h-3.5 w-3.5" />Find Jobs</button>
        <span role="status" className="text-xs text-gray-500">{statusText}</span>
      </nav>
      {(error || saveError) && <p role="alert" className="mt-2 break-words whitespace-pre-line text-sm text-red-500">{error || saveError}</p>}
    </header>
  );
};

export default Header;
