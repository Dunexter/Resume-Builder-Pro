export interface RemoteJobListing {
  id: number;
  title: string;
  company: string;
  url: string;
  location: string;
  tags: string[];
  publicationDate?: string;
}

interface RemotiveApiJob {
  id: number;
  title: string;
  company_name: string;
  url: string;
  candidate_required_location?: string;
  tags?: string[];
  publication_date?: string;
}

interface RemotiveApiResponse {
  jobs?: RemotiveApiJob[];
}

/**
 * Searches live remote job listings via the free, keyless, CORS-enabled Remotive API.
 * Runs entirely client-side. Throws a user-friendly Error on network/API failure.
 */
export async function searchRemoteJobs(query: string, limit = 12): Promise<RemoteJobListing[]> {
  const params = new URLSearchParams();
  if (query.trim()) params.set('search', query.trim());

  let res: Response;
  try {
    res = await fetch(`https://remotive.com/api/remote-jobs?${params.toString()}`);
  } catch {
    throw new Error('Could not reach the job search service. Check your connection and try again.');
  }
  if (!res.ok) {
    throw new Error(`Job search service returned an error (${res.status}). Try again shortly.`);
  }

  const json: RemotiveApiResponse = await res.json();
  const jobs = Array.isArray(json.jobs) ? json.jobs : [];

  return jobs.slice(0, limit).map(j => ({
    id: j.id,
    title: j.title,
    company: j.company_name,
    url: j.url,
    location: j.candidate_required_location || 'Remote',
    tags: Array.isArray(j.tags) ? j.tags.slice(0, 5) : [],
    publicationDate: j.publication_date,
  }));
}

/** Builds external job-board search URLs — these boards don't offer free client-fetchable APIs, so we link out instead. */
export function buildExternalJobSearchLinks(query: string, location = ''): { label: string; url: string }[] {
  const q = encodeURIComponent(query);
  const l = encodeURIComponent(location);
  return [
    { label: 'LinkedIn Jobs', url: `https://www.linkedin.com/jobs/search/?keywords=${q}${location ? `&location=${l}` : ''}` },
    { label: 'Indeed', url: `https://www.indeed.com/jobs?q=${q}${location ? `&l=${l}` : ''}` },
    { label: 'Google Jobs', url: `https://www.google.com/search?q=${q}+jobs${location ? `+in+${l}` : ''}` },
    { label: 'Glassdoor', url: `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${q}` },
  ];
}

/** Guesses a reasonable default job-search query from the candidate's resume data (most recent title, else top skills). */
export function guessDefaultJobQuery(mostRecentTitle: string, topSkills: string[]): string {
  if (mostRecentTitle.trim()) return mostRecentTitle.trim();
  return topSkills.slice(0, 2).join(' ');
}
