import React, { useState } from 'react';
import { CheckCircle, AlertCircle, XCircle, RefreshCw, FileText, Shield, Upload, X } from 'lucide-react';
import { useAppSelector } from '../../hooks';
import { lintATSCompatibility, checkContentQuality, getCategoryScores, lintRawResumeText, checkRawContentQuality } from '../../utils/atsUtils';
import { extractTextFromFile } from '../../utils/resumeFileParser';
import { ATSRule, ATSLintResult } from '../../types/resume';

interface UploadedAnalysis {
  fileName: string;
  lint: ATSLintResult;
  quality: ReturnType<typeof checkRawContentQuality>;
  wordCount: number;
}

const ATSScoreForm: React.FC = () => {
  const resumeData = useAppSelector(state => state.resume.data);
  const darkMode = useAppSelector(state => state.resume.settings.darkMode);
  const [tab, setTab] = useState<'lint' | 'quality' | 'upload'>('lint');
  const [uploaded, setUploaded] = useState<UploadedAnalysis | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const lintResult = lintATSCompatibility(resumeData);
  const qualityResult = checkContentQuality(resumeData);

  const activeLint = tab === 'upload' && uploaded ? uploaded.lint : lintResult;
  const activeQuality = tab === 'upload' && uploaded ? uploaded.quality : qualityResult;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setParseError(null);
    setUploaded(null);
    setParsing(true);
    try {
      const text = await extractTextFromFile(file);
      const lint = lintRawResumeText(text);
      const quality = checkRawContentQuality(text);
      const wordCount = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
      setUploaded({ fileName: file.name, lint, quality, wordCount });
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Could not read this file.');
      setUploaded(null);
    } finally {
      setParsing(false);
    }
  };

  const StatusIcon: React.FC<{ status: ATSRule['status'] }> = ({ status }) => {
    if (status === 'pass') return <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />;
    if (status === 'warn') return <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0" />;
    return <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />;
  };

  const scoreColor = (s: number) => s >= 80 ? 'text-green-600' : s >= 60 ? 'text-yellow-600' : 'text-red-600';
  const scoreBg = (s: number) => s >= 80 ? 'bg-green-100' : s >= 60 ? 'bg-yellow-100' : 'bg-red-100';
  const scoreRing = (s: number) => s >= 80 ? 'stroke-green-500' : s >= 60 ? 'stroke-yellow-500' : 'stroke-red-500';

  const categories = [...new Set(activeLint.rules.map(r => r.category))];
  const categoryScores = getCategoryScores(activeLint.rules);

  const dm = darkMode;
  const cardCls = `rounded-xl border p-4 ${dm ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`;
  const tabActiveCls = `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${dm ? 'bg-indigo-900 text-indigo-200' : 'bg-indigo-100 text-indigo-700'}`;
  const tabInactiveCls = `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${dm ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}`;

  return (
    <div className="space-y-5">
      <h2 className={`text-lg font-bold ${dm ? 'text-white' : 'text-gray-900'}`}>ATS Score & Analysis</h2>
      <p className={`text-xs ${dm ? 'text-gray-400' : 'text-gray-600'}`}>Local heuristic checks, not a guarantee of ATS parsing or selection. {tab === 'upload' ? 'Uploaded text cannot verify the original file layout or fonts.' : 'Only enabled sections with content are analyzed.'}</p>

      {/* Score gauges */}
      {(tab !== 'upload' || uploaded) && <div className="grid grid-cols-2 gap-3">
        {/* ATS Parse Safety */}
        <div className={`${cardCls} text-center`}>
          <div className="relative inline-flex items-center justify-center mb-2">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
              <path d="M18 2 a16 16 0 1 1 0 32 a16 16 0 1 1 0 -32" fill="none" stroke="#e5e7eb" strokeWidth="3" />
              <path d="M18 2 a16 16 0 1 1 0 32 a16 16 0 1 1 0 -32" fill="none" className={scoreRing(activeLint.score)} strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${activeLint.score} 100`} />
            </svg>
            <span className={`absolute text-xl font-bold ${scoreColor(activeLint.score)}`}>{activeLint.score}</span>
          </div>
          <div className={`text-xs font-semibold ${dm ? 'text-gray-300' : 'text-gray-600'}`}>ATS Parse Safety</div>
          <div className={`text-xs mt-1 ${activeLint.passed ? 'text-green-500' : 'text-red-400'}`}>
            {activeLint.passed ? 'Most checks passed' : 'Review flagged checks'}
          </div>
        </div>
        {/* Content Quality */}
        <div className={`${cardCls} text-center`}>
          <div className="relative inline-flex items-center justify-center mb-2">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
              <path d="M18 2 a16 16 0 1 1 0 32 a16 16 0 1 1 0 -32" fill="none" stroke="#e5e7eb" strokeWidth="3" />
              <path d="M18 2 a16 16 0 1 1 0 32 a16 16 0 1 1 0 -32" fill="none" className={scoreRing(activeQuality.score)} strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${activeQuality.score} 100`} />
            </svg>
            <span className={`absolute text-xl font-bold ${scoreColor(activeQuality.score)}`}>{activeQuality.analyzedCount ? activeQuality.score : 'N/A'}</span>
          </div>
          <div className={`text-xs font-semibold ${dm ? 'text-gray-300' : 'text-gray-600'}`}>Content Quality</div>
          <div className={`text-xs mt-1 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{activeQuality.analyzedCount ? `${activeQuality.issues.length} issues in ${activeQuality.analyzedCount} analyzed passages` : 'No analyzable content'}</div>
        </div>
      </div>}

      {/* Tabs */}
      <div className={`flex flex-wrap gap-1 p-1 rounded-xl ${dm ? 'bg-gray-800' : 'bg-gray-100'}`}>
        <button aria-pressed={tab === 'lint'} onClick={() => setTab('lint')} className={tab === 'lint' ? tabActiveCls : tabInactiveCls}>
          <Shield className="h-3.5 w-3.5 inline mr-1.5" />ATS Rules ({lintResult.rules.filter(r => r.status === 'fail').length} fail)
        </button>
        <button aria-pressed={tab === 'quality'} onClick={() => setTab('quality')} className={tab === 'quality' ? tabActiveCls : tabInactiveCls}>
          <FileText className="h-3.5 w-3.5 inline mr-1.5" />Content ({qualityResult.issues.length} issues)
        </button>
        <button aria-pressed={tab === 'upload'} onClick={() => setTab('upload')} className={tab === 'upload' ? tabActiveCls : tabInactiveCls}>
          <Upload className="h-3.5 w-3.5 inline mr-1.5" />Upload Resume
        </button>
      </div>

      {tab === 'upload' && (
        <div className={cardCls}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className={`text-sm font-semibold ${dm ? 'text-white' : 'text-gray-900'}`}>Check an existing resume file</h3>
              <p className={`text-xs mt-0.5 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
                Upload a .pdf, .docx, or .txt resume to check its ATS score. Everything runs locally in your browser — nothing is uploaded anywhere.
              </p>
            </div>
            {uploaded && !parsing && (
              <button
                onClick={() => { setUploaded(null); setParseError(null); }}
                className={`p-1.5 rounded-lg flex-shrink-0 ${dm ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                title="Remove file"
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <label className={`mt-3 flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl px-4 py-6 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-indigo-500 ${
            dm ? 'border-gray-700 hover:border-indigo-500 hover:bg-gray-700/40' : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/50'
          }`}>
            <input aria-label="Upload resume for local ATS analysis" type="file" accept=".pdf,.docx,.txt" className="sr-only" onChange={e => void handleFileUpload(e)} disabled={parsing} />
            {parsing ? (
              <>
                <RefreshCw className="h-6 w-6 text-indigo-500 animate-spin" />
                <span className={`text-sm ${dm ? 'text-gray-300' : 'text-gray-600'}`}>Analyzing…</span>
              </>
            ) : (
              <>
                <Upload className={`h-6 w-6 ${dm ? 'text-gray-500' : 'text-gray-400'}`} />
                <span className={`text-sm font-medium ${dm ? 'text-gray-300' : 'text-gray-600'}`}>
                  {uploaded ? uploaded.fileName : 'Click to upload your resume'}
                </span>
                <span className={`text-xs ${dm ? 'text-gray-500' : 'text-gray-400'}`}>PDF, DOCX, or TXT · up to 10MB</span>
              </>
            )}
          </label>

          {parseError && (
            <div role="alert" className={`mt-3 text-xs p-2.5 rounded-lg ${dm ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-700'}`}>
              {parseError}
            </div>
          )}

          {uploaded && !parseError && (
            <div className={`mt-3 text-xs ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
              {uploaded.wordCount.toLocaleString()} words extracted. Results below reflect the uploaded file, not your in-progress resume.
            </div>
          )}
        </div>
      )}

      {(tab === 'lint' || (tab === 'upload' && uploaded)) && (
        <div className="space-y-4">
          {categories.map(cat => (
            <div key={cat} className={cardCls}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-xs font-bold uppercase tracking-wide ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{cat}</h3>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scoreBg(categoryScores[cat])} ${scoreColor(categoryScores[cat])}`}>
                  {categoryScores[cat]}%
                </span>
              </div>
              <div className="space-y-2">
                {activeLint.rules.filter(r => r.category === cat).map(rule => (
                  <div key={rule.id} className={`flex gap-3 p-2.5 rounded-lg ${
                    rule.status === 'pass' ? (dm ? 'bg-green-900/20' : 'bg-green-50') :
                    rule.status === 'warn' ? (dm ? 'bg-yellow-900/20' : 'bg-yellow-50') :
                    (dm ? 'bg-red-900/20' : 'bg-red-50')
                  }`}>
                    <StatusIcon status={rule.status} />
                    <span className="sr-only">{rule.status}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${dm ? 'text-gray-200' : 'text-gray-800'}`}>{rule.label}</div>
                      <div className={`text-xs mt-0.5 ${dm ? 'text-gray-400' : 'text-gray-600'}`}>{rule.detail}</div>
                      {rule.status !== 'pass' && rule.fix && (
                        <div className={`text-xs mt-1 font-medium ${rule.status === 'fail' ? 'text-red-600' : 'text-yellow-700'}`}>
                          Fix: {rule.fix}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {(tab === 'quality' || (tab === 'upload' && uploaded)) && (
        <div className="space-y-3">
          <h3 className={`text-sm font-semibold ${dm ? 'text-white' : 'text-gray-900'}`}>{tab === 'upload' ? 'Uploaded content issues' : 'Content issues'}</h3>
          {activeQuality.analyzedCount === 0 ? (
            <div className={cardCls}>No analyzable {tab === 'upload' ? 'bullet points were detected in the extracted text. This does not mean the file has no writing issues.' : 'passages yet. Add experience bullets, project descriptions, award descriptions, or custom content.'}</div>
          ) : activeQuality.issues.length === 0 ? (
            <div className={`${cardCls} text-center py-8`}>
              <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
              <div className={`font-semibold ${dm ? 'text-white' : 'text-gray-900'}`}>No issues detected by these checks</div>
              <div className={`text-sm mt-1 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>Review accuracy, relevance, and wording yourself; these checks are limited.</div>
            </div>
          ) : activeQuality.issues.map((issue, i) => (
            <div key={i} className={`${cardCls} space-y-2`}>
              <div className="flex items-start gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                  issue.type === 'weak_verb' ? 'bg-orange-100 text-orange-700' :
                  issue.type === 'no_metric' ? 'bg-blue-100 text-blue-700' :
                  issue.type === 'passive_voice' ? 'bg-purple-100 text-purple-700' :
                  issue.type === 'filler_word' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {issue.type.replace('_', ' ')}
                </span>
                <span className={`text-xs ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{issue.section}</span>
              </div>
              <div className={`text-xs italic ${dm ? 'text-gray-300' : 'text-gray-600'}`}>"{issue.text}"</div>
              <div className={`text-xs p-2 rounded-lg ${dm ? 'bg-indigo-900/30 text-indigo-300' : 'bg-indigo-50 text-indigo-700'}`}>
                💡 {issue.suggestion}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ATSScoreForm;
