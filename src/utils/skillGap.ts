import { ResumeData } from '../types/resume';
import { resumeHasKeyword } from './skillSynonyms';

/** Common skill clusters used to surface complementary skills the resume may be missing. */
export const SKILL_CLUSTERS: Record<string, string[]> = {
  Frontend: ['react', 'typescript', 'javascript', 'html', 'css', 'redux', 'next.js', 'tailwind', 'testing library', 'jest'],
  Backend: ['node.js', 'express', 'postgresql', 'mongodb', 'rest api', 'graphql', 'docker', 'redis'],
  'Cloud & DevOps': ['aws', 'gcp', 'azure', 'docker', 'kubernetes', 'terraform', 'ci/cd', 'jenkins'],
  'Data & ML': ['python', 'pandas', 'numpy', 'sql', 'tensorflow', 'pytorch', 'scikit-learn', 'spark'],
  'Product & Process': ['agile', 'scrum', 'jira', 'figma', 'product management'],
};

export interface SkillGapResult {
  cluster: string;
  matched: string[];
  missing: string[];
}

function getResumeSkillsText(data: ResumeData): string {
  return data.sections.skills.map(s => s.skills).join(', ').toLowerCase();
}

/**
 * For each skill cluster the resume already has a foothold in (at least one matched skill),
 * report which commonly-paired skills from that cluster are still missing.
 */
export function analyzeSkillGaps(data: ResumeData): SkillGapResult[] {
  const skillsText = getResumeSkillsText(data);
  if (!skillsText.trim()) return [];

  const results: SkillGapResult[] = [];

  for (const [cluster, clusterSkills] of Object.entries(SKILL_CLUSTERS)) {
    const matched = clusterSkills.filter(skill => resumeHasKeyword(skillsText, skill));
    if (matched.length === 0) continue; // not a relevant cluster for this resume

    const missing = clusterSkills.filter(skill => !matched.includes(skill));
    if (missing.length > 0) {
      results.push({ cluster, matched, missing });
    }
  }

  return results;
}
