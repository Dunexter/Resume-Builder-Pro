import React, { useEffect, useId, useRef, useState } from 'react';
import { useStore } from 'react-redux';
import { useAppSelector, useAppDispatch } from '../../hooks';
import { updatePersonalInfo } from '../../store/resumeSlice';
import { generateSummaryWithAI } from '../../utils/atsUtils';
import { ResumeState } from '../../types/resume';
import { Sparkles, Loader, Upload } from 'lucide-react';

const PersonalInfoForm: React.FC = () => {
  const dispatch = useAppDispatch();
  const store = useStore<{ resume: ResumeState }>();
  const fieldId = useId();
  const info = useAppSelector(state => state.resume.data.personalInfo);
  const resumeId = useAppSelector(state => state.resume.activeResumeId);
  const aiSettings = useAppSelector(state => state.resume.settings.ai);
  const resumeData = useAppSelector(state => state.resume.data);
  const darkMode = useAppSelector(state => state.resume.settings.darkMode);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [preview, setPreview] = useState<{ text: string; source: ResumeState } | null>(null);
  const [notice, setNotice] = useState('');
  const generation = useRef(0);

  useEffect(() => {
    const token = generation;
    setPreview(null);
    setNotice('');
    setGeneratingSummary(false);
    return () => { token.current++; };
  }, [resumeData, resumeId, aiSettings]);

  const isCurrent = (source: ResumeState) => {
    const current = store.getState().resume;
    return current.activeResumeId === source.activeResumeId && current.data === source.data
      && current.settings.ai === source.settings.ai
      && current.data.personalInfo.summary === source.data.personalInfo.summary;
  };

  const handleChange = (field: keyof typeof info, value: string) => {
    dispatch(updatePersonalInfo({ [field]: value }));
  };

  const handleGenerateSummary = async () => {
    const source = store.getState().resume;
    const request = ++generation.current;
    setGeneratingSummary(true);
    setPreview(null);
    setNotice('');
    try {
      const summary = await generateSummaryWithAI(source.data, source.settings.ai);
      if (request !== generation.current || !isCurrent(source)) return;
      if (!summary.trim()) {
        setNotice('No summary was generated. Add experience or skills and try again. Your summary was not changed.');
        return;
      }
      setPreview({ text: summary.trim(), source });
    } catch (error) {
      if (request === generation.current && isCurrent(source)) {
        setNotice(`${error instanceof Error ? error.message : 'Summary generation failed.'} Your summary was not changed. Check AI settings or try again.`);
      }
    } finally {
      if (request === generation.current) setGeneratingSummary(false);
    }
  };

  const acceptSummary = () => {
    if (!preview) return;
    if (!isCurrent(preview.source)) {
      setPreview(null);
      setNotice('The resume, source text, or AI settings changed. Generate a new summary before accepting.');
      return;
    }
    dispatch(updatePersonalInfo({ summary: preview.text }));
    setPreview(null);
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
          Import PDF, DOCX, TXT, or pasted text into a new resume. Review and correct the result first.
          AI is optional and off by default; this resume will not be overwritten.
        </p>
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-resume-import'))} className={`w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl px-4 py-5 cursor-pointer transition-colors ${
          darkMode ? 'border-gray-700 hover:border-indigo-500 hover:bg-gray-700/40' : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/50'
        }`}>
          <Upload className="h-6 w-6 text-indigo-500" />
          <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Import into a new resume</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label htmlFor={`${fieldId}-name`} className={labelCls}>Full Name *</label>
          <input id={`${fieldId}-name`} className={inputCls} value={info.name} onChange={e => handleChange('name', e.target.value)} placeholder="John Smith" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${fieldId}-email`} className={labelCls}>Email *</label>
            <input id={`${fieldId}-email`} className={inputCls} type="email" value={info.email} onChange={e => handleChange('email', e.target.value)} placeholder="john@email.com" />
          </div>
          <div>
            <label htmlFor={`${fieldId}-phone`} className={labelCls}>Phone *</label>
            <input id={`${fieldId}-phone`} className={inputCls} type="tel" value={info.phone} onChange={e => handleChange('phone', e.target.value)} placeholder="+1 (555) 000-0000" />
          </div>
        </div>
        <div>
          <label htmlFor={`${fieldId}-location`} className={labelCls}>Location</label>
          <input id={`${fieldId}-location`} className={inputCls} value={info.location} onChange={e => handleChange('location', e.target.value)} placeholder="San Francisco, CA" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${fieldId}-linkedin`} className={labelCls}>LinkedIn URL</label>
            <input id={`${fieldId}-linkedin`} className={inputCls} value={info.linkedin || ''} onChange={e => handleChange('linkedin', e.target.value)} placeholder="linkedin.com/in/yourname" />
          </div>
          <div>
            <label htmlFor={`${fieldId}-github`} className={labelCls}>GitHub URL</label>
            <input id={`${fieldId}-github`} className={inputCls} value={info.github || ''} onChange={e => handleChange('github', e.target.value)} placeholder="github.com/yourname" />
          </div>
        </div>
        <div>
          <label htmlFor={`${fieldId}-website`} className={labelCls}>Website / Portfolio</label>
          <input id={`${fieldId}-website`} className={inputCls} value={info.website || ''} onChange={e => handleChange('website', e.target.value)} placeholder="yourportfolio.com" />
        </div>

        {/* Summary with AI */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor={`${fieldId}-summary`} className={labelCls}>Professional Summary</label>
            <button
              type="button"
              onClick={handleGenerateSummary}
              disabled={generatingSummary}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {generatingSummary ? <Loader className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {generatingSummary ? 'Generating...' : aiSettings.provider !== 'none' ? 'AI Generate' : 'Auto-Write'}
            </button>
          </div>
          <textarea
            id={`${fieldId}-summary`}
            aria-describedby={`${fieldId}-summary-help`}
            className={`${inputCls} resize-none`}
            rows={4}
            value={info.summary || ''}
            onChange={e => handleChange('summary', e.target.value)}
            placeholder="2–4 sentences: your role, years of experience, top skills, and key achievement. This is the first thing recruiters read."
          />
          <p id={`${fieldId}-summary-help`} className={`mt-1 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            {(info.summary || '').length}/400 chars · Aim for 60–100 words with keywords from the job description.
          </p>
          {notice && <p role="alert" className={`mt-2 text-sm ${darkMode ? 'text-amber-200' : 'text-amber-800'}`}>{notice}</p>}
          {preview && (
            <section aria-labelledby={`${fieldId}-preview-title`} className={`mt-3 p-3 rounded-lg border space-y-3 ${darkMode ? 'border-gray-600 bg-gray-800 text-gray-200' : 'border-indigo-200 bg-indigo-50 text-gray-800'}`}>
              <h3 id={`${fieldId}-preview-title`} className="text-sm font-semibold">{preview.source.settings.ai.provider === 'none' ? 'Local summary preview' : 'AI summary preview'}</h3>
              <p role="status" className="text-xs">Review the suggestion for accuracy. Your current summary stays unchanged until you accept.</p>
              <p className="text-sm whitespace-pre-wrap break-words">{preview.text}</p>
              <div className="flex gap-2">
                <button type="button" onClick={acceptSummary} className="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Accept summary</button>
                <button type="button" onClick={() => setPreview(null)} className="px-3 py-1.5 text-sm rounded-lg border">Discard suggestion</button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default PersonalInfoForm;
