import { ResumeData } from '../types/resume';
import { callAIText, parseAIJson, AISettingsLike } from './aiClient';

export interface AIReviewResult {
  overallImpression: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface InterviewQuestion {
  question: string;
  tip: string;
}

function buildResumeContext(data: ResumeData, targetRole?: string): string {
  const skills = data.sections.skills.flatMap(s => s.skills.split(',').map(sk => sk.trim())).filter(Boolean).join(', ');
  const experience = data.sections.experience
    .map(e => `- ${e.position} at ${e.company}: ${e.achievements.filter(Boolean).join(' | ')}`)
    .join('\n');
  const education = data.sections.education.map(e => `- ${e.degree} in ${e.field}, ${e.institution}`).join('\n');

  return `Name: ${data.personalInfo.name}
${targetRole ? `Target Role: ${targetRole}` : ''}
Summary: ${data.personalInfo.summary || 'N/A'}
Skills: ${skills || 'N/A'}
Experience:
${experience || 'N/A'}
Education:
${education || 'N/A'}`;
}

/** Generates a holistic AI critique of the whole resume (beyond bullet-level linting). */
export async function generateAIResumeReview(
  data: ResumeData,
  aiSettings: AISettingsLike,
  targetRole?: string
): Promise<AIReviewResult> {
  const prompt = `You are a senior technical recruiter reviewing a resume. Give a holistic, honest critique.

${buildResumeContext(data, targetRole)}

Respond with ONLY a JSON object in this exact shape, no markdown, no commentary:
{
  "overallImpression": "2-3 sentence overall assessment",
  "strengths": ["3-5 short bullet points on what's strong"],
  "weaknesses": ["3-5 short bullet points on what's weak or missing"],
  "recommendations": ["3-5 short, specific, actionable improvements"]
}`;

  const raw = await callAIText(prompt, aiSettings, 900);
  const parsed = parseAIJson<Partial<AIReviewResult>>(raw);

  return {
    overallImpression: parsed.overallImpression || '',
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
  };
}

/** Generates likely interview questions (and answer tips) tailored to this resume and an optional job description. */
export async function generateInterviewQuestions(
  data: ResumeData,
  aiSettings: AISettingsLike,
  jobDescription?: string
): Promise<InterviewQuestion[]> {
  const prompt = `You are an interview coach. Based on this candidate's resume${jobDescription ? ' and the target job description' : ''}, generate 6 likely interview questions they should prepare for — a mix of behavioral and technical/role-specific questions grounded in their actual experience.

${buildResumeContext(data)}
${jobDescription ? `\nJob Description:\n${jobDescription.slice(0, 1000)}` : ''}

Respond with ONLY a JSON array in this exact shape, no markdown, no commentary:
[{ "question": "...", "tip": "one short sentence on how to answer well, referencing their own background" }]`;

  const raw = await callAIText(prompt, aiSettings, 900);
  const parsed = parseAIJson<InterviewQuestion[]>(raw);
  return Array.isArray(parsed) ? parsed.filter(q => q && q.question) : [];
}
