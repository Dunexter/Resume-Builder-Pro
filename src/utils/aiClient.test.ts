import { describe, it, expect, vi, afterEach } from 'vitest';
import { callAIChat, callAIText, parseAIJson } from './aiClient';

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
  });
});
