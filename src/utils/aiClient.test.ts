import { describe, it, expect, vi, afterEach } from 'vitest';
import { callAIChat, callAIText, parseAIJson, listModels } from './aiClient';

describe('parseAIJson', () => {
  it('parses a plain JSON object', () => {
    expect(parseAIJson<{ a: number }>('{"a": 1}')).toEqual({ a: 1 });
  });

  it('parses JSON wrapped in a markdown code fence', () => {
    const raw = '```json\n{"a": 1, "b": [1,2,3]}\n```';
    expect(parseAIJson<{ a: number; b: number[] }>(raw)).toEqual({ a: 1, b: [1, 2, 3] });
  });

  it('parses JSON with leading/trailing commentary', () => {
    const raw = 'Sure! Here is the result:\n{"ok": true}\nLet me know if you need more.';
    expect(parseAIJson<{ ok: boolean }>(raw)).toEqual({ ok: true });
  });

  it('parses a JSON array', () => {
    const raw = '[{"question":"Q1","tip":"T1"}]';
    expect(parseAIJson(raw)).toEqual([{ question: 'Q1', tip: 'T1' }]);
  });

  it('throws when there is no JSON in the response', () => {
    expect(() => parseAIJson('no json here')).toThrow();
  });
});

describe('callAIChat / callAIText', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('throws when provider is none or key is missing', async () => {
    await expect(callAIText('hi', { provider: 'none', apiKey: '' })).rejects.toThrow(/no ai provider/i);
    await expect(callAIText('hi', { provider: 'openai', apiKey: '' })).rejects.toThrow(/no ai provider/i);
  });

  it('returns the OpenAI response text on success', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Hello from OpenAI' } }] }),
    }) as unknown as typeof fetch;

    const result = await callAIText('hi', { provider: 'openai', apiKey: 'sk-test' });
    expect(result).toBe('Hello from OpenAI');
  });

  it('returns the Gemini response text on success', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'Hello from Gemini' }] } }] }),
    }) as unknown as typeof fetch;

    const result = await callAIText('hi', { provider: 'gemini', apiKey: 'AIza-test' });
    expect(result).toBe('Hello from Gemini');
  });

  it('throws AIServiceError with unauthorized code on 401', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;
    await expect(callAIText('hi', { provider: 'openai', apiKey: 'bad-key' })).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('throws AIServiceError with not_found code on 404 and surfaces the provider message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      clone: () => ({ json: async () => ({ error: { message: 'models/gemini-2.5-pro is not found for API version v1beta' } }) }),
    }) as unknown as typeof fetch;

    await expect(callAIText('hi', { provider: 'gemini', apiKey: 'AIza-test' })).rejects.toMatchObject({
      code: 'not_found',
      message: expect.stringContaining('gemini-2.5-pro is not found'),
    });
  });

  it('falls back to a generic 404 message when the body cannot be parsed', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch;
    await expect(callAIText('hi', { provider: 'gemini', apiKey: 'AIza-test' })).rejects.toMatchObject({ code: 'not_found' });
  });

  it('passes full chat history through to the provider', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'reply' } }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await callAIChat(
      [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'hello' },
      ],
      { provider: 'openai', apiKey: 'sk-test' }
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages).toHaveLength(2);
    expect(body.max_completion_tokens).toBe(500);
    expect(body.temperature).toBeUndefined();
  });

  it('sends Gemini system instructions separately, honors token limits, and joins text parts', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'private', thought: true }, { text: 'Hello ' }, { text: 'world' }] } }] }) });
    global.fetch = fetchMock;
    expect(await callAIChat([{ role: 'system', content: 'Rules' }, { role: 'user', content: 'Hi' }], { provider: 'gemini', apiKey: 'secret' }, 321)).toBe('Hello world');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).not.toContain('secret');
    const body = JSON.parse(options.body);
    expect(body.systemInstruction.parts[0].text).toBe('Rules');
    expect(body.contents[0].parts[0].text).toBe('Hi');
    expect(body.generationConfig.maxOutputTokens).toBe(321);
  });

  it('rejects truncated output instead of offering an incomplete suggestion', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ finish_reason: 'length', message: { content: 'Partial' } }] }) });
    await expect(callAIText('hi', { provider: 'openai', apiKey: 'key' })).rejects.toThrow(/truncated/i);
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'Partial' }] } }] }) });
    await expect(callAIText('hi', { provider: 'gemini', apiKey: 'key' })).rejects.toThrow(/truncated/i);
  });
});

describe('listModels', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches and filters Gemini models that support generateContent', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          { name: 'models/gemini-1.5-flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] },
          { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] },
        ],
      }),
    }) as unknown as typeof fetch;

    const models = await listModels({ provider: 'gemini', apiKey: 'AIza-test' });
    expect(models).toEqual([
      { value: 'gemini-1.5-flash', label: 'gemini-1.5-flash' },
      { value: 'gemini-2.5-pro', label: 'gemini-2.5-pro' },
    ]);
  });

  it('fetches and filters OpenAI chat models', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'gpt-4o-mini' }, { id: 'whisper-1' }, { id: 'text-embedding-3-small' }, { id: 'gpt-4o' }],
      }),
    }) as unknown as typeof fetch;

    const models = await listModels({ provider: 'openai', apiKey: 'sk-test' });
    expect(models).toEqual([
      { value: 'gpt-4o', label: 'gpt-4o' },
      { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
    ]);
  });

  it('throws AIServiceError when no API key is set', async () => {
    await expect(listModels({ provider: 'gemini', apiKey: '' })).rejects.toMatchObject({ code: 'no_key' });
  });

  it('throws with unauthorized code when the provider rejects the key', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;
    await expect(listModels({ provider: 'openai', apiKey: 'bad-key' })).rejects.toMatchObject({ code: 'unauthorized' });
  });
});

