import { describe, it, expect, vi, afterEach } from 'vitest';
import { searchRemoteJobs, buildExternalJobSearchLinks, guessDefaultJobQuery } from './jobSearchApi';

describe('buildExternalJobSearchLinks', () => {
  it('builds links for all job boards including the query', () => {
    const links = buildExternalJobSearchLinks('React Developer', 'Austin');
    expect(links.length).toBeGreaterThanOrEqual(4);
    expect(links.find(l => l.label === 'LinkedIn Jobs')?.url).toContain('React%20Developer');
    expect(links.find(l => l.label === 'Indeed')?.url).toContain('Austin');
  });

  it('omits location params when no location given', () => {
    const links = buildExternalJobSearchLinks('Backend Engineer');
    expect(links.find(l => l.label === 'Indeed')?.url).not.toContain('&l=');
  });
});

describe('guessDefaultJobQuery', () => {
  it('prefers the most recent title', () => {
    expect(guessDefaultJobQuery('Senior Engineer', ['React', 'Node'])).toBe('Senior Engineer');
  });

  it('falls back to top skills when no title is given', () => {
    expect(guessDefaultJobQuery('', ['React', 'Node', 'AWS'])).toBe('React Node');
  });
});

describe('searchRemoteJobs', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('maps API job fields to RemoteJobListing', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        jobs: [
          {
            id: 1,
            title: 'Frontend Engineer',
            company_name: 'Acme',
            url: 'https://example.com/job/1',
            candidate_required_location: 'Worldwide',
            tags: ['react', 'typescript'],
            publication_date: '2024-01-01',
          },
        ],
      }),
    }) as unknown as typeof fetch;

    const jobs = await searchRemoteJobs('frontend');
    expect(jobs).toEqual([
      {
        id: 1,
        title: 'Frontend Engineer',
        company: 'Acme',
        url: 'https://example.com/job/1',
        location: 'Worldwide',
        tags: ['react', 'typescript'],
        publicationDate: '2024-01-01',
      },
    ]);
  });

  it('throws a friendly error on network failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
    await expect(searchRemoteJobs('frontend')).rejects.toThrow(/could not reach/i);
  });

  it('throws a friendly error on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;
    await expect(searchRemoteJobs('frontend')).rejects.toThrow(/error \(500\)/i);
  });
});
