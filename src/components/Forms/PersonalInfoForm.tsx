import React, { useState } from 'react';
import { useAppSelector, useAppDispatch } from '../../hooks';
import { updatePersonalInfo, loadResumeData } from '../../store/resumeSlice';
import { generateSummaryWithAI } from '../../utils/atsUtils';
import { extractTextFromFile } from '../../utils/resumeFileParser';
import { importResumeFromText } from '../../utils/resumeImport';
import { Sparkles, Loader, Upload, RefreshCw } from 'lucide-react';

const PersonalInfoForm: React.FC = () => {
  const dispatch = useAppDispatch();
  const info = useAppSelector(state => state.resume.data.personalInfo);
  const aiSettings = useAppSelector(state => state.resume.settings.ai);
  const resumeData = useAppSelector(state => state.resume.data);
  const darkMode = useAppSelector(state => state.resume.settings.darkMode);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);

  const handleChange = (field: keyof typeof info, value: string) => {
    dispatch(updatePersonalInfo({ [field]: value }));
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const confirmed = window.confirm(
      `Import "${file.name}" into this resume?\n\n` +
      'This will replace all current fields (personal info, experience, education, skills, etc.) ' +
      'with content extracted from the file. You can undo with Ctrl+Z if the result needs fixing.'
    );
    if (!confirmed) return;

    setImportError(null);
    setImportNote(null);
    setImporting(true);
    try {
      const text = await extractTextFromFile(file);
      const result = await importResumeFromText(text, aiSettings);
      dispatch(loadResumeData(result.data));
      setImportNote(
        result.warning ||
        (result.usedAI
          ? 'Imported with AI assistance — please review each section for accuracy.'
          : 'Imported using basic text parsing — please review each section, especially dates and job titles.')
      );
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Could not read this file.');
    } finally {
      setImporting(false);
    }
  };

  const handleGenerateSummary = async () => {
    setGeneratingSummary(true);
    try {
      const summary = await generateSummaryWithAI(resumeData, aiSettings);
      dispatch(updatePersonalInfo({ summary }));
    } finally {
      setGeneratingSummary(false);
    }
  };

  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors ${
    darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900'
  }`;
  const labelCls = `block text-xs font-semibold mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`;

  return (
    <div className="space-y-5">
      <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Personal Information</h2>

      <div className={`rounded-xl border p-4 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
        <h3 className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Already have a resume?</h3>
        <p className={`text-xs mt-0.5 mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Upload a .pdf, .docx, or .txt file to auto-fill every section below, then edit as needed.
          {aiSettings.provider !== 'none' && aiSettings.apiKey ? ' Your configured AI provider will parse it for accuracy.' : ' Add an AI key in Settings for more accurate parsing.'}
        </p>
        <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl px-4 py-5 cursor-pointer transition-colors ${
          darkMode ? 'border-gray-700 hover:border-indigo-500 hover:bg-gray-700/40' : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/50'
        }`}>
          <input type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={e => void handleImportFile(e)} disabled={importing} />
          {importing ? (
            <>
              <RefreshCw className="h-6 w-6 text-indigo-500 animate-spin" />
              <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Parsing your resume…</span>
            </>
          ) : (
            <>
              <Upload className={`h-6 w-6 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
              <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Click to upload your resume</span>
              <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>PDF, DOCX, or TXT · up to 10MB · processed locally</span>
            </>
          )}
        </label>
        {importError && (
          <div className={`mt-3 text-xs p-2.5 rounded-lg ${darkMode ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-700'}`}>{importError}</div>
        )}
        {importNote && !importError && (
          <div className={`mt-3 text-xs p-2.5 rounded-lg ${darkMode ? 'bg-amber-900/20 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>{importNote}</div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className={labelCls}>Full Name *</label>
          <input className={inputCls} value={info.name} onChange={e => handleChange('name', e.target.value)} placeholder="John Smith" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Email *</label>
            <input className={inputCls} type="email" value={info.email} onChange={e => handleChange('email', e.target.value)} placeholder="john@email.com" />
          </div>
          <div>
            <label className={labelCls}>Phone *</label>
            <input className={inputCls} type="tel" value={info.phone} onChange={e => handleChange('phone', e.target.value)} placeholder="+1 (555) 000-0000" />
          </div>
        </div>
        <div>
          <label className={labelCls}>Location</label>
          <input className={inputCls} value={info.location} onChange={e => handleChange('location', e.target.value)} placeholder="San Francisco, CA" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>LinkedIn URL</label>
            <input className={inputCls} value={info.linkedin || ''} onChange={e => handleChange('linkedin', e.target.value)} placeholder="linkedin.com/in/yourname" />
          </div>
          <div>
            <label className={labelCls}>GitHub URL</label>
            <input className={inputCls} value={info.github || ''} onChange={e => handleChange('github', e.target.value)} placeholder="github.com/yourname" />
          </div>
        </div>
        <div>
          <label className={labelCls}>Website / Portfolio</label>
          <input className={inputCls} value={info.website || ''} onChange={e => handleChange('website', e.target.value)} placeholder="yourportfolio.com" />
        </div>

        {/* Summary with AI */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={labelCls}>Professional Summary</label>
            <button
              onClick={handleGenerateSummary}
              disabled={generatingSummary}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {generatingSummary ? <Loader className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {generatingSummary ? 'Generating...' : aiSettings.provider !== 'none' && aiSettings.apiKey ? 'AI Generate' : 'Auto-Write'}
            </button>
          </div>
          <textarea
            className={`${inputCls} resize-none`}
            rows={4}
            value={info.summary || ''}
            onChange={e => handleChange('summary', e.target.value)}
            placeholder="2–4 sentences: your role, years of experience, top skills, and key achievement. This is the first thing recruiters read."
          />
          <p className={`mt-1 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            {(info.summary || '').length}/400 chars · Aim for 60–100 words with keywords from the job description.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PersonalInfoForm;
