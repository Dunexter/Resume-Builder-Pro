import React, { useState } from 'react';
import { Target, Plus, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../../hooks';
import { setJobDescription, setJDMatchResult, insertMissingKeyword } from '../../store/resumeSlice';
import { matchJobDescriptionWithSynonyms } from '../../utils/jdMatch';
import { ResumeData } from '../../types/resume';

const JDMatcherForm: React.FC = () => {
  const dispatch = useAppDispatch();
  const jobDescription = useAppSelector(state => state.resume.jobDescription);
  const resumeData: ResumeData = useAppSelector(state => state.resume.data);
  const resumeId = useAppSelector(state => state.resume.activeResumeId);
  const darkMode = useAppSelector(state => state.resume.settings.darkMode);
  const [analyzedResume, setAnalyzedResume] = useState<string | null>(null);
  // Store results have no source identity. Display only a locally requested, current computation.
  const jdMatchResult = analyzedResume === resumeId && jobDescription.trim()
    ? matchJobDescriptionWithSynonyms(resumeData, jobDescription) : null;

  const runMatch = () => {
    const result = matchJobDescriptionWithSynonyms(resumeData, jobDescription);
    dispatch(setJDMatchResult(result));
    setAnalyzedResume(resumeId);
  };

  const addKeyword = (kw: string) => {
    if (resumeData.sections.skills.some(s => s.skills.split(',').some(value => value.trim().toLowerCase() === kw.toLowerCase()))) return;
    dispatch(insertMissingKeyword(kw));
  };

  const scoreColor =
    !jdMatchResult
      ? ''
      : jdMatchResult.score >= 70
        ? 'text-green-500'
        : jdMatchResult.score >= 40
          ? 'text-amber-500'
          : 'text-red-500';

  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none ${
    darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900'
  }`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Target className="h-5 w-5 text-indigo-500" />
        <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Job Description Match</h2>
      </div>
      <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        Estimate keyword overlap in visible resume content, not hiring probability or an employer's ATS score. Results update with your edits.
      </p>

      <textarea
        aria-label="Job description"
        className={inputCls}
        rows={8}
        value={jobDescription}
        onChange={e => dispatch(setJobDescription(e.target.value))}
        placeholder="Paste the full job description here…"
      />

      <button
        type="button"
        onClick={runMatch}
        disabled={!jobDescription.trim()}
        className="w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
      >
        Analyze match
      </button>

      {jdMatchResult && (
        <div className={`rounded-xl border p-4 space-y-3 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Keyword overlap ({jdMatchResult.matchedKeywords.length}/{jdMatchResult.matchedKeywords.length + jdMatchResult.missingKeywords.length})</span>
            <span className={`text-2xl font-bold ${scoreColor}`}>{jdMatchResult.score}%</span>
          </div>

          {jdMatchResult.suggestions.map((s, i) => (
            <div key={i} className={`flex gap-2 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
              <span>{s}</span>
            </div>
          ))}

          {jdMatchResult.matchedKeywords.length > 0 && (
            <div>
              <div className={`text-xs font-semibold mb-1.5 flex items-center gap-1 ${darkMode ? 'text-green-400' : 'text-green-700'}`}>
                <CheckCircle className="h-3.5 w-3.5" /> Matched ({jdMatchResult.matchedKeywords.length})
              </div>
              <div className="flex flex-wrap gap-1">
                {jdMatchResult.matchedKeywords.map(kw => (
                  <span key={kw} className={`text-[10px] px-1.5 py-0.5 rounded ${darkMode ? 'bg-green-900/40 text-green-300' : 'bg-green-100 text-green-800'}`}>
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {jdMatchResult.missingKeywords.length > 0 && (
            <div>
              <div className={`text-xs font-semibold mb-1.5 flex items-center gap-1 ${darkMode ? 'text-red-400' : 'text-red-700'}`}>
                <XCircle className="h-3.5 w-3.5" /> Missing terms: add only skills you actually have
              </div>
              {!resumeData.sectionOrder.some(s => s.type === 'skills' && s.visible) && <p className="text-xs mb-2">Skills is hidden. Adding a term there will not improve visible keyword overlap until you enable that section.</p>}
              <div className="flex flex-wrap gap-1">
                {jdMatchResult.missingKeywords.map(kw => (
                  <button
                    key={kw}
                    type="button"
                    aria-label={`Add ${kw} to Skills only if accurate`}
                    disabled={resumeData.sections.skills.some(s => s.skills.split(',').some(value => value.trim().toLowerCase() === kw.toLowerCase()))}
                    onClick={() => addKeyword(kw)}
                    className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 transition-colors disabled:opacity-40 ${
                      darkMode
                        ? 'bg-red-900/40 text-red-300 hover:bg-red-900/70'
                        : 'bg-red-100 text-red-800 hover:bg-red-200'
                    }`}
                  >
                    <Plus className="h-2.5 w-2.5" /> {kw}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default JDMatcherForm;
