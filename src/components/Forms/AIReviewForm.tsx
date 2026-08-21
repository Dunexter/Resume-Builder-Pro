import React, { useState } from 'react';
import { Sparkles, Loader2, ThumbsUp, ThumbsDown, Lightbulb, MessageCircleQuestion, Bot } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../hooks';
import { setActiveSection } from '../../store/resumeSlice';
import { generateAIResumeReview, generateInterviewQuestions, AIReviewResult, InterviewQuestion } from '../../utils/aiReview';
import { humanizeAIError } from '../../utils/aiErrors';

const AIReviewForm: React.FC = () => {
  const dispatch = useAppDispatch();
  const resumeData = useAppSelector(state => state.resume.data);
  const jobDescription = useAppSelector(state => state.resume.jobDescription);
  const aiSettings = useAppSelector(state => state.resume.settings.ai);
  const darkMode = useAppSelector(state => state.resume.settings.darkMode);

  const [tab, setTab] = useState<'review' | 'interview'>('review');
  const [targetRole, setTargetRole] = useState('');

  const [review, setReview] = useState<AIReviewResult | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState<string | null>(null);

  const dm = darkMode;
  const hasAIKey = aiSettings.provider !== 'none' && !!aiSettings.apiKey;
  const cardCls = `rounded-xl border p-4 ${dm ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`;
  const tabActiveCls = `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${dm ? 'bg-indigo-900 text-indigo-200' : 'bg-indigo-100 text-indigo-700'}`;
  const tabInactiveCls = `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${dm ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}`;
  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-colors ${dm ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900'}`;

  const runReview = async () => {
    setReviewLoading(true);
    setReviewError(null);
    try {
      const result = await generateAIResumeReview(resumeData, aiSettings, targetRole || undefined);
      setReview(result);
    } catch (err) {
      setReviewError(humanizeAIError(err));
    } finally {
      setReviewLoading(false);
    }
  };

  const runInterviewPrep = async () => {
    setQuestionsLoading(true);
    setQuestionsError(null);
    try {
      const result = await generateInterviewQuestions(resumeData, aiSettings, jobDescription || undefined);
      setQuestions(result);
    } catch (err) {
      setQuestionsError(humanizeAIError(err));
    } finally {
      setQuestionsLoading(false);
    }
  };

  if (!hasAIKey) {
    return (
      <div className="space-y-5">
        <h2 className={`text-lg font-bold ${dm ? 'text-white' : 'text-gray-900'}`}>AI Resume Review</h2>
        <div className={`p-4 rounded-xl border ${dm ? 'border-amber-800/60 bg-amber-950/30' : 'border-amber-200 bg-amber-50'}`}>
          <div className="flex gap-2 items-start">
            <Bot className={`h-5 w-5 flex-shrink-0 mt-0.5 ${dm ? 'text-amber-300' : 'text-amber-700'}`} />
            <div>
              <p className={`text-sm font-semibold ${dm ? 'text-amber-200' : 'text-amber-900'}`}>Add an AI provider to unlock this feature</p>
              <p className={`text-xs mt-1 ${dm ? 'text-amber-200/80' : 'text-amber-800'}`}>Get a holistic resume critique and likely interview questions, generated from your own OpenAI or Gemini key.</p>
              <button
                onClick={() => dispatch(setActiveSection('aisettings'))}
                className="mt-3 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              >
                Open AI Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h2 className={`text-lg font-bold ${dm ? 'text-white' : 'text-gray-900'}`}>AI Resume Review</h2>

      <div className={`flex gap-1 p-1 rounded-xl ${dm ? 'bg-gray-800' : 'bg-gray-100'}`}>
        <button onClick={() => setTab('review')} className={tab === 'review' ? tabActiveCls : tabInactiveCls}>
          <Sparkles className="h-3.5 w-3.5 inline mr-1.5" />Resume Critique
        </button>
        <button onClick={() => setTab('interview')} className={tab === 'interview' ? tabActiveCls : tabInactiveCls}>
          <MessageCircleQuestion className="h-3.5 w-3.5 inline mr-1.5" />Interview Prep
        </button>
      </div>

      {tab === 'review' && (
        <div className="space-y-4">
          <div className={cardCls}>
            <label className={`block text-xs font-semibold mb-1 ${dm ? 'text-gray-300' : 'text-gray-600'}`}>Target role (optional)</label>
            <input className={inputCls} value={targetRole} onChange={e => setTargetRole(e.target.value)} placeholder="e.g. Senior Product Manager" />
            <button
              onClick={() => void runReview()}
              disabled={reviewLoading}
              className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {reviewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {reviewLoading ? 'Analyzing…' : review ? 'Regenerate review' : 'Generate AI review'}
            </button>
          </div>

          {reviewError && (
            <div className={`text-xs p-2.5 rounded-lg ${dm ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-700'}`}>{reviewError}</div>
          )}

          {review && (
            <div className="space-y-3">
              <div className={cardCls}>
                <h3 className={`text-xs font-bold uppercase tracking-wide mb-1.5 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>Overall impression</h3>
                <p className={`text-sm ${dm ? 'text-gray-200' : 'text-gray-800'}`}>{review.overallImpression}</p>
              </div>
              <div className={cardCls}>
                <h3 className={`text-xs font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5 ${dm ? 'text-green-400' : 'text-green-700'}`}>
                  <ThumbsUp className="h-3.5 w-3.5" /> Strengths
                </h3>
                <ul className="space-y-1.5">
                  {review.strengths.map((s, i) => (
                    <li key={i} className={`text-sm flex gap-2 ${dm ? 'text-gray-300' : 'text-gray-700'}`}><span>•</span><span>{s}</span></li>
                  ))}
                </ul>
              </div>
              <div className={cardCls}>
                <h3 className={`text-xs font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5 ${dm ? 'text-red-400' : 'text-red-700'}`}>
                  <ThumbsDown className="h-3.5 w-3.5" /> Weaknesses
                </h3>
                <ul className="space-y-1.5">
                  {review.weaknesses.map((s, i) => (
                    <li key={i} className={`text-sm flex gap-2 ${dm ? 'text-gray-300' : 'text-gray-700'}`}><span>•</span><span>{s}</span></li>
                  ))}
                </ul>
              </div>
              <div className={cardCls}>
                <h3 className={`text-xs font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5 ${dm ? 'text-indigo-300' : 'text-indigo-700'}`}>
                  <Lightbulb className="h-3.5 w-3.5" /> Recommendations
                </h3>
                <ul className="space-y-1.5">
                  {review.recommendations.map((s, i) => (
                    <li key={i} className={`text-sm flex gap-2 ${dm ? 'text-gray-300' : 'text-gray-700'}`}><span>•</span><span>{s}</span></li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'interview' && (
        <div className="space-y-4">
          <div className={cardCls}>
            <p className={`text-xs mb-3 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
              Generates likely interview questions from your resume{jobDescription ? ' and the job description pasted in JD Matcher' : ''}.
            </p>
            <button
              onClick={() => void runInterviewPrep()}
              disabled={questionsLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {questionsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircleQuestion className="h-4 w-4" />}
              {questionsLoading ? 'Generating…' : questions.length ? 'Regenerate questions' : 'Generate interview questions'}
            </button>
          </div>

          {questionsError && (
            <div className={`text-xs p-2.5 rounded-lg ${dm ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-700'}`}>{questionsError}</div>
          )}

          {questions.length > 0 && (
            <div className="space-y-3">
              {questions.map((q, i) => (
                <div key={i} className={`${cardCls} space-y-2`}>
                  <div className={`text-sm font-semibold ${dm ? 'text-gray-100' : 'text-gray-900'}`}>{i + 1}. {q.question}</div>
                  <div className={`text-xs p-2 rounded-lg ${dm ? 'bg-indigo-900/30 text-indigo-300' : 'bg-indigo-50 text-indigo-700'}`}>💡 {q.tip}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIReviewForm;
