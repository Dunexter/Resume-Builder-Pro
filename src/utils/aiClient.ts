import { AIServiceError, mapFetchError } from './aiErrors';

export interface AISettingsLike {
  provider: string;
  apiKey: string;
  model?: string;
}

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_GEMINI_MODEL = 'gemini-1.5-flash';

/**
 * Low-level call to the user's configured AI provider (OpenAI or Gemini) with full chat
 * history. Requests go directly from the browser to the provider using the user's own
 * API key — never through a server. Throws AIServiceError on any failure.
 */
export async function callAIChat(
  messages: ChatMessage[],
  aiSettings: AISettingsLike,
  maxTokens = 500
): Promise<string> {
  if (aiSettings.provider === 'none' || !aiSettings.apiKey) {
    throw new AIServiceError('No AI provider configured. Add an API key in AI Settings.', 'no_key');
  }

  if (aiSettings.provider === 'openai') {
    let res: Response;
    try {
      res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aiSettings.apiKey}` },
        body: JSON.stringify({
          model: aiSettings.model || DEFAULT_OPENAI_MODEL,
          messages,
          max_tokens: maxTokens,
          temperature: 0.7,
        }),
      });
    } catch {
      throw new AIServiceError('Network error — could not reach OpenAI.', 'network');
    }
    if (!res.ok) throw await mapFetchError(res);
    const json = await res.json();
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) throw new AIServiceError('OpenAI returned an empty response.', 'unknown');
    return text;
  }

  if (aiSettings.provider === 'gemini') {
    const model = aiSettings.model || DEFAULT_GEMINI_MODEL;
    // Gemini has no "system" role — fold system messages into the start of the first turn.
    const systemParts = messages.filter(m => m.role === 'system').map(m => m.content);
    const turns = messages.filter(m => m.role !== 'system');
    const contents = turns.map((m, i) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: i === 0 && systemParts.length ? `${systemParts.join('\n')}\n\n${m.content}` : m.content }],
    }));

    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(aiSettings.apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents }),
        }
      );
    } catch {
      throw new AIServiceError('Network error — could not reach Gemini.', 'network');
    }
    if (!res.ok) throw await mapFetchError(res);
    const json = await res.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) throw new AIServiceError('Gemini returned an empty response.', 'unknown');
    return text;
  }

  throw new AIServiceError('Unsupported AI provider.', 'unknown');
}

/** Convenience wrapper for a single-turn prompt (no chat history). */
export async function callAIText(prompt: string, aiSettings: AISettingsLike, maxTokens = 300): Promise<string> {
  return callAIChat([{ role: 'user', content: prompt }], aiSettings, maxTokens);
}

/**
 * Parses a JSON object/array out of a raw AI text response, tolerating markdown code
 * fences (```json ... ```) and any leading/trailing commentary the model may add.
 */
export function parseAIJson<T>(raw: string): T {
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();

  const firstObj = text.indexOf('{');
  const firstArr = text.indexOf('[');
  const start = firstObj === -1 ? firstArr : firstArr === -1 ? firstObj : Math.min(firstObj, firstArr);
  const lastObj = text.lastIndexOf('}');
  const lastArr = text.lastIndexOf(']');
  const end = Math.max(lastObj, lastArr);

  if (start === -1 || end === -1 || end < start) {
    throw new AIServiceError('AI response was not valid JSON.', 'unknown');
  }

  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    throw new AIServiceError('Could not parse the AI response. Try again.', 'unknown');
  }
}
