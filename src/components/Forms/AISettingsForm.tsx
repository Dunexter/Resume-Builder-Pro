import React, { useEffect, useState, useRef } from 'react';
import { useStore } from 'react-redux';
import { ResumeState } from '../../types/resume';
import { Key, Eye, EyeOff, ExternalLink, CheckCircle, Shield, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../../hooks';
import { updateAISettings } from '../../store/resumeSlice';
import { listModels, type ModelOption } from '../../utils/aiClient';
import { humanizeAIError } from '../../utils/aiErrors';

const CUSTOM_MODEL_VALUE = '__custom__';

const OPENAI_MODELS = [
  { value: '', label: 'gpt-4o-mini (default)' },
  { value: 'gpt-4o', label: 'gpt-4o' },
  { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
  { value: 'gpt-4.1', label: 'gpt-4.1' },
  { value: 'gpt-4.1-mini', label: 'gpt-4.1-mini' },
  { value: 'gpt-4-turbo', label: 'gpt-4-turbo' },
  { value: 'gpt-3.5-turbo', label: 'gpt-3.5-turbo' },
  { value: 'o3-mini', label: 'o3-mini (reasoning)' },
];

const GEMINI_MODELS = [
  { value: '', label: 'gemini-1.5-flash (default)' },
  { value: 'gemini-1.5-flash', label: 'gemini-1.5-flash' },
  { value: 'gemini-1.5-pro', label: 'gemini-1.5-pro' },
  { value: 'gemini-2.0-flash', label: 'gemini-2.0-flash' },
  { value: 'gemini-2.0-flash-lite', label: 'gemini-2.0-flash-lite' },
  { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash' },
  { value: 'gemini-2.5-pro', label: 'gemini-2.5-pro' },
];

function getModelPresets(provider: string) {
  if (provider === 'openai') return OPENAI_MODELS;
  if (provider === 'gemini') return GEMINI_MODELS;
  return [];
}


const AISettingsForm: React.FC = () => {
  const dispatch = useAppDispatch();
  const store = useStore<{ resume: ResumeState }>();
  const aiSettings = useAppSelector(state => state.resume.settings.ai);
  const darkMode = useAppSelector(state => state.resume.settings.darkMode);
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [fetchedModels, setFetchedModels] = useState<ModelOption[] | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const modelRequest = useRef(0);
  const keyRequest = useRef(0);
  const staticPresets = getModelPresets(aiSettings.provider);
  const modelPresets: ModelOption[] =
    fetchedModels && fetchedModels.length
      ? [{ value: '', label: `App default (${aiSettings.provider === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-flash'})` }, ...fetchedModels]
      : staticPresets;
  const isKnownModel = modelPresets.some(m => m.value === (aiSettings.model || ''));
  const [customMode, setCustomMode] = useState(() => !!aiSettings.model && !isKnownModel);

  const refreshModels = async () => {
    if (!aiSettings.apiKey.trim() || aiSettings.provider === 'none') return;
    const request = ++modelRequest.current;
    const isCurrent = () => request === modelRequest.current && store.getState().resume.settings.ai.provider === aiSettings.provider && store.getState().resume.settings.ai.apiKey === aiSettings.apiKey;
    setModelsLoading(true);
    setModelsError(null);
    try {
      const models = await listModels(aiSettings);
      if (!isCurrent()) return;
      setFetchedModels(models);
      if (!models.length) setModelsError('No compatible models returned.');
    } catch (err) {
      if (!isCurrent()) return;
      setModelsError(humanizeAIError(err));
      setFetchedModels(null);
    } finally {
      if (isCurrent()) setModelsLoading(false);
    }
  };

  useEffect(() => {
    const modelsToken = modelRequest;
    const keyToken = keyRequest;
    setFetchedModels(null);
    setModelsError(null);
    setModelsLoading(false);
    setTestStatus('idle');
    setTestMessage(null);
    setShowKey(false);
    return () => { modelsToken.current++; keyToken.current++; };
  }, [aiSettings.provider, aiSettings.apiKey]);

  const dm = darkMode;
  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors ${dm ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900'}`;
  const labelCls = `block text-xs font-semibold mb-1 ${dm ? 'text-gray-300' : 'text-gray-600'}`;
  const cardCls = `rounded-xl border p-4 ${dm ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`;

  const handleTestKey = async () => {
    if (!aiSettings.apiKey.trim()) return;
    const request = ++keyRequest.current;
    const isCurrent = () => request === keyRequest.current && store.getState().resume.settings.ai.provider === aiSettings.provider && store.getState().resume.settings.ai.apiKey === aiSettings.apiKey;
    setTestStatus('testing');
    setTestMessage(null);
    try {
      await listModels(aiSettings);
      if (!isCurrent()) return;
      setTestStatus('ok');
      setTestMessage('Model listing succeeded. This does not verify generation access, model compatibility, or billing quota.');
    } catch (err) {
      if (!isCurrent()) return;
      setTestStatus('fail');
      setTestMessage(humanizeAIError(err));
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className={`text-lg font-bold ${dm ? 'text-white' : 'text-gray-900'}`}>AI Settings</h2>
        <p className={`text-sm mt-1 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
          Optional AI for writing suggestions. Local editing and checks work without a key; AI review and career chat require a provider, and live job search requires internet access.
        </p>
      </div>

      <div className={`p-4 rounded-xl border-l-4 border-green-500 ${dm ? 'bg-green-900/20' : 'bg-green-50'}`}>
        <p className={`text-sm font-semibold ${dm ? 'text-green-300' : 'text-green-700'}`}>Core resume tools work without AI</p>
        <p className={`text-xs mt-1 ${dm ? 'text-green-400' : 'text-green-600'}`}>
          Local writing checks and keyword matching stay free. AI output may be inaccurate; review every suggestion before using it.
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
        <div id="ai-provider-label" className={labelCls}>AI Provider</div>
        <div role="group" aria-labelledby="ai-provider-label" className="grid grid-cols-3 gap-2 mt-1">
          {(['none', 'openai', 'gemini'] as const).map(p => (
            <button
              key={p}
              type="button"
              aria-pressed={aiSettings.provider === p}
              onClick={() => {
                if (aiSettings.provider === p) return;
                modelRequest.current++;
                keyRequest.current++;
                dispatch(updateAISettings({ provider: p, apiKey: '', model: '' }));
                setTestStatus('idle');
                setTestMessage(null);
                setCustomMode(false);
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
                <label htmlFor="ai-api-key" className={labelCls}>API Key</label>
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
                  Get API key (usage may cost money) <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="relative">
                <input
                  id="ai-api-key"
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
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="ai-model" className={`${labelCls} mb-0`}>Model</label>
                <button
                  type="button"
                  onClick={() => void refreshModels()}
                  disabled={!aiSettings.apiKey.trim() || modelsLoading}
                  className={`flex items-center gap-1 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed ${dm ? 'text-indigo-300 hover:text-indigo-200' : 'text-indigo-600 hover:text-indigo-700'}`}
                  title="Fetch the current list of models available to your API key"
                >
                  <RefreshCw className={`h-3 w-3 ${modelsLoading ? 'animate-spin' : ''}`} />
                  {modelsLoading ? 'Fetching…' : 'Refresh from provider'}
                </button>
              </div>
              <select
                id="ai-model"
                className={inputCls}
                value={customMode || !isKnownModel ? CUSTOM_MODEL_VALUE : (aiSettings.model || '')}
                onChange={e => {
                  if (e.target.value === CUSTOM_MODEL_VALUE) {
                    setCustomMode(true);
                  } else {
                    setCustomMode(false);
                    dispatch(updateAISettings({ model: e.target.value }));
                  }
                }}
              >
                {modelPresets.map(m => (
                  <option key={m.value || 'default'} value={m.value}>{m.label}</option>
                ))}
                <option value={CUSTOM_MODEL_VALUE}>Custom model…</option>
              </select>
              {fetchedModels && fetchedModels.length > 0 ? (
                <p className={`text-xs mt-1 ${dm ? 'text-green-400' : 'text-green-600'}`}>
                  Provider listed {fetchedModels.length} candidate model{fetchedModels.length === 1 ? '' : 's'}. Generation compatibility and quota are not verified.
                </p>
              ) : modelsError ? (
                <p className={`text-xs mt-1 ${dm ? 'text-amber-300' : 'text-amber-700'}`}>
                  Couldn't fetch live models ({modelsError}). Showing a static list — it may include deprecated models.
                </p>
              ) : !aiSettings.apiKey ? (
                <p className={`text-xs mt-1 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                  Add an API key to fetch the live model list from the provider.
                </p>
              ) : <p className={`text-xs mt-1 ${dm ? 'text-gray-400' : 'text-gray-600'}`}>Static presets are unverified and may be deprecated. Refresh explicitly to request the provider's model list.</p>}
              {(customMode || !isKnownModel) && (
                <input
                  aria-label="Custom AI model name"
                  className={`${inputCls} mt-2`}
                  value={aiSettings.model || ''}
                  onChange={e => dispatch(updateAISettings({ model: e.target.value }))}
                  placeholder="Enter exact model name"
                  autoFocus
                />
              )}
              <p className={`text-xs mt-1.5 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                Getting a "model not found" (404) error? Use "Refresh from provider" above to see the models your
                key actually has access to — some models get deprecated or require a different tier/region.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void handleTestKey()}
              disabled={!aiSettings.apiKey.trim() || testStatus === 'testing'}
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
                  <CheckCircle className="h-4 w-4" /> Model listing succeeded
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
              <p role="status" className={`text-xs ${testStatus === 'ok' || testStatus === 'idle' ? (dm ? 'text-gray-400' : 'text-gray-600') : 'text-red-500'}`}>
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
              desc: 'Preview and accept suggestions on experience bullets. AI failures are shown, not silently replaced. With AI off, only local whitespace cleanup is offered.',
            },
            {
              icon: '📝',
              feature: 'Summary generator',
              desc: 'Summary generation uses supplied facts. Local summaries are available with provider set to None; configured provider failures are errors, not fallback text.',
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
