import React, { useState } from 'react';
import { Key, Eye, EyeOff, ExternalLink, CheckCircle, Shield, AlertTriangle } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../../hooks';
import { updateAISettings } from '../../store/resumeSlice';

const AISettingsForm: React.FC = () => {
  const dispatch = useAppDispatch();
  const aiSettings = useAppSelector(state => state.resume.settings.ai);
  const darkMode = useAppSelector(state => state.resume.settings.darkMode);
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const dm = darkMode;
  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors ${dm ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900'}`;
  const labelCls = `block text-xs font-semibold mb-1 ${dm ? 'text-gray-300' : 'text-gray-600'}`;
  const cardCls = `rounded-xl border p-4 ${dm ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`;

  const handleTestKey = async () => {
    if (!aiSettings.apiKey) return;
    setTestStatus('testing');
    setTestMessage(null);
    try {
      let res: Response;
      if (aiSettings.provider === 'openai') {
        res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${aiSettings.apiKey}` },
        });
      } else if (aiSettings.provider === 'gemini') {
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(aiSettings.apiKey)}`
        );
      } else {
        setTestStatus('fail');
        setTestMessage('Select OpenAI or Gemini first.');
        return;
      }

      if (res.ok) {
        setTestStatus('ok');
        setTestMessage('Key works. Requests go from your browser to the provider only.');
      } else if (res.status === 401 || res.status === 403) {
        setTestStatus('fail');
        setTestMessage('Invalid or unauthorized API key.');
      } else if (res.status === 429) {
        setTestStatus('fail');
        setTestMessage('Rate limited — try again shortly.');
      } else {
        setTestStatus('fail');
        setTestMessage(`Provider returned ${res.status}.`);
      }
    } catch {
      setTestStatus('fail');
      setTestMessage('Network error — could not reach the provider.');
    }
    setTimeout(() => {
      setTestStatus('idle');
    }, 6000);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className={`text-lg font-bold ${dm ? 'text-white' : 'text-gray-900'}`}>AI Settings</h2>
        <p className={`text-sm mt-1 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
          Optional AI for bullet rewrites and summary generation. Everything else works offline without a key.
        </p>
      </div>

      <div className={`p-4 rounded-xl border-l-4 border-green-500 ${dm ? 'bg-green-900/20' : 'bg-green-50'}`}>
        <p className={`text-sm font-semibold ${dm ? 'text-green-300' : 'text-green-700'}`}>All features work without AI</p>
        <p className={`text-xs mt-1 ${dm ? 'text-green-400' : 'text-green-600'}`}>
          Rule-based suggestions (weak verbs, metrics, keyword matching) stay free. AI only upgrades rewrite quality.
        </p>
      </div>

      <div className={`p-4 rounded-xl border ${dm ? 'border-amber-800/60 bg-amber-950/30' : 'border-amber-200 bg-amber-50'}`}>
        <div className="flex gap-2 items-start">
          <Shield className={`h-4 w-4 flex-shrink-0 mt-0.5 ${dm ? 'text-amber-300' : 'text-amber-700'}`} />
          <div>
            <p className={`text-sm font-semibold ${dm ? 'text-amber-200' : 'text-amber-900'}`}>Privacy — keys stay in this browser</p>
            <ul className={`text-xs mt-1 space-y-1 list-disc pl-4 ${dm ? 'text-amber-200/80' : 'text-amber-800'}`}>
              <li>API keys are stored in IndexedDB / local settings on this device only.</li>
              <li>When you use AI features, prompts are sent from your browser directly to OpenAI or Google — not through our servers (there are none).</li>
              <li>Clearing site data removes keys. Do not use a shared computer for paid keys without clearing afterward.</li>
              <li>Never commit keys to git or paste them into public issues.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className={cardCls}>
        <label className={labelCls}>AI Provider</label>
        <div className="grid grid-cols-3 gap-2 mt-1">
          {(['none', 'openai', 'gemini'] as const).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => {
                dispatch(updateAISettings({ provider: p }));
                setTestStatus('idle');
                setTestMessage(null);
              }}
              className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                aiSettings.provider === p
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : dm
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p === 'none' ? 'None (Free)' : p === 'openai' ? 'OpenAI' : 'Gemini'}
            </button>
          ))}
        </div>

        {aiSettings.provider !== 'none' && (
          <div className="mt-4 space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls}>API Key</label>
                <a
                  href={
                    aiSettings.provider === 'openai'
                      ? 'https://platform.openai.com/api-keys'
                      : 'https://aistudio.google.com/app/apikey'
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-500 flex items-center gap-1 hover:underline"
                >
                  Get free key <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="relative">
                <input
                  className={inputCls}
                  type={showKey ? 'text' : 'password'}
                  value={aiSettings.apiKey}
                  onChange={e => dispatch(updateAISettings({ apiKey: e.target.value }))}
                  placeholder={aiSettings.provider === 'openai' ? 'sk-...' : 'AIza...'}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showKey ? 'Hide API key' : 'Show API key'}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className={labelCls}>Model (optional)</label>
              <input
                className={inputCls}
                value={aiSettings.model || ''}
                onChange={e => dispatch(updateAISettings({ model: e.target.value }))}
                placeholder={
                  aiSettings.provider === 'openai' ? 'gpt-4o-mini (default)' : 'gemini-1.5-flash (default)'
                }
              />
            </div>

            <button
              type="button"
              onClick={() => void handleTestKey()}
              disabled={!aiSettings.apiKey || testStatus === 'testing'}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                testStatus === 'ok'
                  ? 'bg-green-600 text-white'
                  : testStatus === 'fail'
                    ? 'bg-red-600 text-white'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
              } disabled:opacity-50`}
            >
              {testStatus === 'ok' ? (
                <>
                  <CheckCircle className="h-4 w-4" /> Key valid
                </>
              ) : testStatus === 'fail' ? (
                <>
                  <AlertTriangle className="h-4 w-4" /> Failed
                </>
              ) : testStatus === 'testing' ? (
                'Testing…'
              ) : (
                <>
                  <Key className="h-4 w-4" /> Test key
                </>
              )}
            </button>
            {testMessage && (
              <p className={`text-xs ${testStatus === 'ok' || testStatus === 'idle' ? (dm ? 'text-gray-400' : 'text-gray-600') : 'text-red-500'}`}>
                {testMessage}
              </p>
            )}
          </div>
        )}
      </div>

      <div className={cardCls}>
        <h3 className={`text-sm font-bold mb-3 ${dm ? 'text-gray-200' : 'text-gray-800'}`}>AI features</h3>
        <div className="space-y-3">
          {[
            {
              icon: '✏️',
              feature: 'Bullet rewrite',
              desc: 'Sparkle icon on experience bullets. Falls back to rule-based rewrite if AI fails or is off.',
            },
            {
              icon: '📝',
              feature: 'Summary generator',
              desc: 'AI Generate in Personal Info. Errors surface in the UI; rule-based summary is the fallback.',
            },
            {
              icon: '🎯',
              feature: 'JD matching',
              desc: 'Keyword score is always free/local. AI is not required.',
            },
            {
              icon: '🔍',
              feature: 'AI Resume Review',
              desc: 'Holistic critique — strengths, weaknesses, and specific recommendations. See "AI Review" in the sidebar.',
            },
            {
              icon: '🎤',
              feature: 'Interview Prep',
              desc: 'Generates likely interview questions and answer tips from your resume (and JD if provided).',
            },
            {
              icon: '✉️',
              feature: 'Cover Letter Builder',
              desc: 'AI-written cover letters tailored to a company/role, with template fallbacks.',
            },
            {
              icon: '🤖',
              feature: 'AI Job Finder',
              desc: 'Chat assistant for job-search strategy, plus live remote job search — click "Find Jobs" in the header.',
            },
          ].map(item => (
            <div key={item.feature} className={`flex gap-3 p-3 rounded-lg ${dm ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <span className="text-lg">{item.icon}</span>
              <div>
                <div className={`text-sm font-semibold ${dm ? 'text-gray-200' : 'text-gray-800'}`}>{item.feature}</div>
                <div className={`text-xs ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AISettingsForm;
