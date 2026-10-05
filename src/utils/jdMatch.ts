import { ResumeData, JDMatchResult } from '../types/resume';
import { extractKeywords, getResumeText, hasKeyword } from './atsUtils';
import { expandKeyword } from './skillSynonyms';

/** JD match with skill synonym expansion (preferred over plain includes). */
export function matchJobDescriptionWithSynonyms(
  data: ResumeData,
  jobDescription: string
): JDMatchResult {
  if (!jobDescription.trim()) {
    return { score: 0, matchedKeywords: [], missingKeywords: [], suggestions: [] };
  }

  const jdKeywords = extractKeywords(jobDescription);
  const resumeText = getResumeText(data).toLowerCase();
  const matched: string[] = [];
  const missing: string[] = [];
  const unique = Array.from(new Set(jdKeywords));

  for (const kw of unique) {
    if (expandKeyword(kw).some(variant => hasKeyword(resumeText, variant))) matched.push(kw);
    else missing.push(kw);
  }

  const totalMeaningful = unique.length;
  const matchedMeaningful = matched.length;
  const rawScore =
    totalMeaningful === 0 ? 0 : Math.round((matchedMeaningful / totalMeaningful) * 100);
  const score = Math.min(rawScore, 100);

  const suggestions: string[] = [];
  if (missing.length > 0) {
    suggestions.push(`Consider these terms only if they accurately describe your experience: ${missing.slice(0, 8).join(', ')}`);
  }
  if (score < 50) {
    suggestions.push(
      'Your resume matches less than 50% of the job description keywords. Consider tailoring your experience bullet points.'
    );
  }
  if (!data.personalInfo.summary?.trim()) {
    suggestions.push(
      'Add a professional summary that incorporates key terms from the job description.'
    );
  }

  return {
    score,
    matchedKeywords: matched,
    missingKeywords: missing,
    suggestions,
  };
}
