import React, { useState } from 'react';
import { X, Download, Copy, Sparkles, Loader } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../hooks';
import { setShowCoverLetterBuilder } from '../../store/resumeSlice';
import { callAIText } from '../../utils/aiClient';

const COVER_LETTER_TEMPLATES = [
  {
    id: 'standard',
    label: 'Standard',
    generate: (name: string, position: string, company: string, skills: string, achievement: string) =>
`Dear Hiring Manager,

I am excited to apply for the ${position || '[Position]'} role at ${company || '[Company]'}. With my background in ${skills || '[key skills]'}, I am confident in my ability to contribute meaningfully to your team.

${achievement ? `Most recently, ${achievement}` : 'In my previous roles, I have consistently delivered results that exceeded expectations and drove measurable business impact.'}

I am particularly drawn to ${company || 'your organization'} because of its reputation for innovation and commitment to excellence. I believe my technical skills and collaborative approach align well with your team's goals.

I would love the opportunity to discuss how my experience can benefit ${company || 'your team'}. Thank you for your consideration.

Sincerely,
${name || '[Your Name]'}`,
  },
  {
    id: 'concise',
    label: 'Concise (1 paragraph)',
    generate: (name: string, position: string, company: string, skills: string, achievement: string) =>
`Dear Hiring Manager,

I am writing to apply for the ${position || '[Position]'} position at ${company || '[Company]'}. With expertise in ${skills || '[key skills]'} and a proven track record — ${achievement || 'delivering high-impact solutions in fast-paced environments'} — I am well-positioned to make an immediate contribution to your team. I look forward to discussing how my background aligns with your needs.

Best regards,
${name || '[Your Name]'}`,
  },
  {
    id: 'story',
    label: 'Narrative Style',
    generate: (name: string, position: string, company: string, skills: string, achievement: string) =>
`Dear Hiring Manager,

When I first encountered ${company || 'your organization'}'s work, I knew I had found a team whose mission aligned with my own professional goals. The opportunity to join as ${position || '[Position]'} feels like a natural next step in my career.

Over the past several years, I have built deep expertise in ${skills || '[key skills]'}. ${achievement ? `A highlight of my journey has been: ${achievement}` : 'Throughout my career, I have consistently turned complex challenges into measurable outcomes.'} These experiences have shaped me into someone who thrives at the intersection of technical depth and business impact.

I would be thrilled to bring this mindset to ${company || 'your organization'}. Thank you for taking the time to read my letter — I hope we can connect soon.

Warmly,
${name || '[Your Name]'}`,
  },
];

const CoverLetterBuilder: React.FC = () => {
  const dispatch = useAppDispatch();
  const resumeData = useAppSelector(state => state.resume.data);
  const jobDescription = useAppSelector(state => state.resume.jobDescription);
  const aiSettings = useAppSelector(state => state.resume.settings.ai);
  const darkMode = useAppSelector(state => state.resume.settings.darkMode);

  const [company, setCompany] = useState('');
  const [position, setPosition] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('standard');
  const [content, setContent] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const dm = darkMode;

  const topSkills = resumeData.sections.skills
    .flatMap(s => s.skills.split(',').map(sk => sk.trim()))
    .slice(0, 5)
    .join(', ');

  const topAchievement = resumeData.sections.experience[0]?.achievements.find(a => /\d+/.test(a)) || resumeData.sections.experience[0]?.achievements[0] || '';

  const generate = async () => {
    setGenerating(true);
    const tmpl = COVER_LETTER_TEMPLATES.find(t => t.id === selectedTemplate)!;

    if (aiSettings.provider !== 'none' && aiSettings.apiKey) {
      const prompt = `Write a professional cover letter for this job application:

Applicant: ${resumeData.personalInfo.name}
Target Position: ${position}
Target Company: ${company}
Key Skills: ${topSkills}
Top Achievement: ${topAchievement}
${jobDescription ? `Job Description Summary: ${jobDescription.slice(0, 500)}` : ''}

Style: ${selectedTemplate === 'concise' ? 'Very concise, 1 paragraph' : selectedTemplate === 'story' ? 'Narrative, personal story format' : 'Professional standard 3-paragraph'}

Requirements: ATS-friendly, specific to the role, no generic phrases, include relevant keywords from the job description if provided. Return only the cover letter text.`;

      try {
        const result = await callAIText(prompt, aiSettings, 600);
        if (result) { setContent(result); setGenerating(false); return; }
      } catch { /* fall through to template */ }
    }

    setContent(tmpl.generate(resumeData.personalInfo.name, position, company, topSkills, topAchievement));
    setGenerating(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cover_letter_${company || 'application'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-colors ${dm ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900'}`;
  const labelCls = `block text-xs font-semibold mb-1 ${dm ? 'text-gray-300' : 'text-gray-600'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => dispatch(setShowCoverLetterBuilder(false))} />
      <div className={`relative z-10 w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col ${dm ? 'bg-gray-900' : 'bg-white'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-5 border-b flex-shrink-0 ${dm ? 'border-gray-700' : 'border-gray-200'}`}>
          <div>
            <h2 className={`text-lg font-bold ${dm ? 'text-white' : 'text-gray-900'}`}>Cover Letter Builder</h2>
            <p className={`text-sm ${dm ? 'text-gray-400' : 'text-gray-500'}`}>Generate a tailored cover letter from your resume data</p>
          </div>
          <button onClick={() => dispatch(setShowCoverLetterBuilder(false))} className={`p-2 rounded-xl ${dm ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>Target Company</label><input className={inputCls} value={company} onChange={e => setCompany(e.target.value)} placeholder="Google" /></div>
            <div><label className={labelCls}>Target Position</label><input className={inputCls} value={position} onChange={e => setPosition(e.target.value)} placeholder="Senior Software Engineer" /></div>
          </div>

          <div>
            <label className={labelCls}>Style</label>
            <div className="grid grid-cols-3 gap-2">
              {COVER_LETTER_TEMPLATES.map(t => (
                <button key={t.id} onClick={() => setSelectedTemplate(t.id)} className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${selectedTemplate === t.id ? 'bg-indigo-600 text-white border-indigo-600' : (dm ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50')}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={generate} disabled={generating} className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors">
            {generating ? <Loader className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? 'Generating...' : aiSettings.provider !== 'none' && aiSettings.apiKey ? 'Generate with AI' : 'Generate Cover Letter'}
          </button>

          {content && (
            <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelCls}>Cover Letter</label>
                  <div className="flex gap-2">
                    <button onClick={handleCopy} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${dm ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                      <Copy className="h-3.5 w-3.5" />{copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                      <Download className="h-3.5 w-3.5" />Download .txt
                    </button>
                  </div>
                </div>
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={16}
                  value={content}
                  onChange={e => setContent(e.target.value)}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoverLetterBuilder;
