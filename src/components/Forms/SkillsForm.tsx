import React, { useMemo } from 'react';
import { Plus, Trash2, Lightbulb } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../../hooks';
import { addSkill, updateSkill, removeSkill, insertMissingKeyword } from '../../store/resumeSlice';
import { SkillEntry } from '../../types/resume';
import { analyzeSkillGaps } from '../../utils/skillGap';

const SUGGESTED_CATEGORIES = ['Languages', 'Frameworks & Libraries', 'Cloud & DevOps', 'Databases', 'Tools & Platforms', 'Soft Skills', 'Certifications'];

const SkillsForm: React.FC = () => {
  const dispatch = useAppDispatch();
  const resumeData = useAppSelector(state => state.resume.data);
  const skills: SkillEntry[] = useAppSelector(state => state.resume.data.sections.skills);
  const darkMode = useAppSelector(state => state.resume.settings.darkMode);

  const skillGaps = useMemo(() => analyzeSkillGaps(resumeData), [resumeData]);

  const update = (id: string, data: Partial<SkillEntry>) => dispatch(updateSkill({ id, data }));

  const addMissingSkill = (skill: string) => {
    if (skills.some(s => s.skills.split(',').some(v => v.trim().toLowerCase() === skill.toLowerCase()))) return;
    dispatch(insertMissingKeyword(skill));
  };

  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors ${
    darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900'
  }`;
  const labelCls = `block text-xs font-semibold mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`;
  const cardCls = `rounded-xl border p-4 space-y-3 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Skills</h2>
        <button onClick={() => dispatch(addSkill())} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors">
          <Plus className="h-3.5 w-3.5" /> Add Category
        </button>
      </div>

      <div className={`p-3 rounded-lg text-xs ${darkMode ? 'bg-indigo-900/30 text-indigo-300' : 'bg-indigo-50 text-indigo-700'}`}>
        <strong>ATS Tip:</strong> Organize skills by category. Separate each skill with a comma. Include 8–15 skills that match the job description keywords.
      </div>

      {skillGaps.length > 0 && (
        <div className={`rounded-xl border p-4 space-y-3 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
          <div className={`flex items-center gap-1.5 text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            <Lightbulb className="h-4 w-4 text-amber-500" /> Skill gap intelligence
          </div>
          <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Commonly paired skills, not job requirements. Add only skills you actually have; otherwise use these as learning ideas.
          </p>
          {skillGaps.map(gap => (
            <div key={gap.cluster}>
              <div className={`text-xs font-semibold mb-1.5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{gap.cluster}</div>
              <div className="flex flex-wrap gap-1">
                {gap.missing.map(skill => (
                  <button
                    key={skill}
                    type="button"
                    aria-label={`Add ${skill} only if accurate`}
                    onClick={() => addMissingSkill(skill)}
                    className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 transition-colors ${
                      darkMode
                        ? 'bg-amber-900/40 text-amber-300 hover:bg-amber-900/70'
                        : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                    }`}
                  >
                    <Plus className="h-2.5 w-2.5" /> {skill}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {skills.map(skill => (
        <div key={skill.id} className={cardCls}>
          <div className="flex gap-3">
            <div className="flex-1 space-y-3">
              <div>
                <label htmlFor={`category-${skill.id}`} className={labelCls}>Category</label>
                <input
                  id={`category-${skill.id}`}
                  list={`cats-${skill.id}`}
                  className={inputCls}
                  value={skill.category}
                  onChange={e => update(skill.id, { category: e.target.value })}
                  placeholder="e.g. Languages, Cloud & DevOps"
                />
                <datalist id={`cats-${skill.id}`}>
                  {SUGGESTED_CATEGORIES.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <label htmlFor={`skills-${skill.id}`} className={labelCls}>Skills (comma-separated)</label>
                <textarea
                  id={`skills-${skill.id}`}
                  className={`${inputCls} resize-none`}
                  rows={2}
                  value={skill.skills}
                  onChange={e => update(skill.id, { skills: e.target.value })}
                  placeholder="Python, TypeScript, Go, Rust"
                />
                <div className={`mt-1 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  {skill.skills.split(',').filter(s => s.trim()).length} skills
                </div>
              </div>
            </div>
            <button aria-label={`Remove ${skill.category || 'skill'} category`} onClick={() => dispatch(removeSkill(skill.id))} className="p-1.5 h-fit text-red-400 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0 mt-6">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SkillsForm;
