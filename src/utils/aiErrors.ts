export class AIServiceError extends Error {
  constructor(
    message: string,
    public code: 'no_key' | 'unauthorized' | 'rate_limit' | 'not_found' | 'network' | 'unknown' = 'unknown'
  ) {
    super(message);
    this.name = 'AIServiceError';
  }
}

/** Best-effort extraction of the provider's own error message from a failed response body. */
async function extractProviderMessage(res: Response): Promise<string | null> {
  try {
    const clone = res.clone();
    const json = await clone.json();
    const msg = json?.error?.message || json?.error?.[0]?.message;
    return typeof msg === 'string' ? msg : null;
  } catch {
    return null;
  }
}

export async function mapFetchError(res: Response): Promise<AIServiceError> {
  const providerMessage = await extractProviderMessage(res);

  if (res.status === 401 || res.status === 403) {
    return new AIServiceError(
      providerMessage ? `API key rejected: ${providerMessage}` : 'API key rejected. Check the key in AI Settings.',
      'unauthorized'
    );
  }
  if (res.status === 404) {
    return new AIServiceError(
      providerMessage
        ? `Model not found: ${providerMessage}`
        : 'Model not found. Your key may not have access to this model yet — try a different model in AI Settings.',
      'not_found'
    );
  }
  if (res.status === 429) {
    return new AIServiceError('Rate limited by the provider. Try again in a minute.', 'rate_limit');
  }
  return new AIServiceError(
    providerMessage ? `Provider error (${res.status}): ${providerMessage}` : `Provider error (${res.status}).`,
    'unknown'
  );
}

export function humanizeAIError(err: unknown): string {
  if (err instanceof AIServiceError) return err.message;
  if (err instanceof TypeError) {
    return 'Network error — check your connection or try again.';
  }
  if (err instanceof Error) return err.message;
  return 'AI request failed. Falling back to rule-based suggestions.';
}
