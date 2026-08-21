import React, { useState } from 'react';
import { CheckCircle, AlertCircle, XCircle, Target, RefreshCw, FileText, Shield } from 'lucide-react';
import { useAppSelector } from '../../hooks';
import { lintATSCompatibility, checkContentQuality, getCategoryScores } from '../../utils/atsUtils';
import { ATSRule } from '../../types/resume';

const ATSScoreForm: React.FC = () => {
  const resumeData = useAppSelector(state => state.resume.data);
  const darkMode = useAppSelector(state => state.resume.settings.darkMode);
  const [tab, setTab] = useState<'lint' | 'quality'>('lint');

  const lintResult = lintATSCompatibility(resumeData);
  const qualityResult = checkContentQuality(resumeData);

  const StatusIcon: React.FC<{ status: ATSRule['status'] }> = ({ status }) => {
    if (status === 'pass') return <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />;
    if (status === 'warn') return <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0" />;
    return <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />;
  };

  const scoreColor = (s: number) => s >= 80 ? 'text-green-600' : s >= 60 ? 'text-yellow-600' : 'text-red-600';
  const scoreBg = (s: number) => s >= 80 ? 'bg-green-100' : s >= 60 ? 'bg-yellow-100' : 'bg-red-100';
  const scoreRing = (s: number) => s >= 80 ? 'stroke-green-500' : s >= 60 ? 'stroke-yellow-500' : 'stroke-red-500';

  const categories = [...new Set(lintResult.rules.map(r => r.category))];
  const categoryScores = getCategoryScores(lintResult.rules);

  const dm = darkMode;
  const cardCls = `rounded-xl border p-4 ${dm ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`;
  const tabActiveCls = `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${dm ? 'bg-indigo-900 text-indigo-200' : 'bg-indigo-100 text-indigo-700'}`;
  const tabInactiveCls = `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${dm ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}`;

  return (
    <div className="space-y-5">
      <h2 className={`text-lg font-bold ${dm ? 'text-white' : 'text-gray-900'}`}>ATS Score & Analysis</h2>

      {/* Score gauges */}
      <div className="grid grid-cols-2 gap-3">
        {/* ATS Parse Safety */}
        <div className={`${cardCls} text-center`}>
          <div className="relative inline-flex items-center justify-center mb-2">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
              <path d="M18 2 a16 16 0 1 1 0 32 a16 16 0 1 1 0 -32" fill="none" stroke="#e5e7eb" strokeWidth="3" />
              <path d="M18 2 a16 16 0 1 1 0 32 a16 16 0 1 1 0 -32" fill="none" className={scoreRing(lintResult.score)} strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${lintResult.score} 100`} />
            </svg>
            <span className={`absolute text-xl font-bold ${scoreColor(lintResult.score)}`}>{lintResult.score}</span>
          </div>
          <div className={`text-xs font-semibold ${dm ? 'text-gray-300' : 'text-gray-600'}`}>ATS Parse Safety</div>
          <div className={`text-xs mt-1 ${lintResult.passed ? 'text-green-500' : 'text-red-400'}`}>
            {lintResult.passed ? '✓ Likely to Pass' : '✗ Needs Work'}
          </div>
        </div>
        {/* Content Quality */}
        <div className={`${cardCls} text-center`}>
          <div className="relative inline-flex items-center justify-center mb-2">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
              <path d="M18 2 a16 16 0 1 1 0 32 a16 16 0 1 1 0 -32" fill="none" stroke="#e5e7eb" strokeWidth="3" />
              <path d="M18 2 a16 16 0 1 1 0 32 a16 16 0 1 1 0 -32" fill="none" className={scoreRing(qualityResult.score)} strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${qualityResult.score} 100`} />
            </svg>
            <span className={`absolute text-xl font-bold ${scoreColor(qualityResult.score)}`}>{qualityResult.score}</span>
          </div>
          <div className={`text-xs font-semibold ${dm ? 'text-gray-300' : 'text-gray-600'}`}>Content Quality</div>
          <div className={`text-xs mt-1 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{qualityResult.issues.length} issues found</div>
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex gap-1 p-1 rounded-xl ${dm ? 'bg-gray-800' : 'bg-gray-100'}`}>
        <button onClick={() => setTab('lint')} className={tab === 'lint' ? tabActiveCls : tabInactiveCls}>
          <Shield className="h-3.5 w-3.5 inline mr-1.5" />ATS Rules ({lintResult.rules.filter(r => r.status === 'fail').length} fail)
        </button>
        <button onClick={() => setTab('quality')} className={tab === 'quality' ? tabActiveCls : tabInactiveCls}>
          <FileText className="h-3.5 w-3.5 inline mr-1.5" />Content ({qualityResult.issues.length} issues)
        </button>
      </div>

      {tab === 'lint' && (
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
                {lintResult.rules.filter(r => r.category === cat).map(rule => (
                  <div key={rule.id} className={`flex gap-3 p-2.5 rounded-lg ${
                    rule.status === 'pass' ? (dm ? 'bg-green-900/20' : 'bg-green-50') :
                    rule.status === 'warn' ? (dm ? 'bg-yellow-900/20' : 'bg-yellow-50') :
                    (dm ? 'bg-red-900/20' : 'bg-red-50')
                  }`}>
                    <StatusIcon status={rule.status} />
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

      {tab === 'quality' && (
        <div className="space-y-3">
          {qualityResult.issues.length === 0 ? (
            <div className={`${cardCls} text-center py-8`}>
              <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
              <div className={`font-semibold ${dm ? 'text-white' : 'text-gray-900'}`}>Excellent content quality!</div>
              <div className={`text-sm mt-1 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>No weak verbs, passive voice, or missing metrics detected.</div>
            </div>
          ) : qualityResult.issues.map((issue, i) => (
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
