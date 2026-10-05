import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../../hooks';
import { addEducation, updateEducation, removeEducation } from '../../store/resumeSlice';
import { EducationEntry } from '../../types/resume';

const EducationForm: React.FC = () => {
  const dispatch = useAppDispatch();
  const education = useAppSelector(state => state.resume.data.sections.education);
  const darkMode = useAppSelector(state => state.resume.settings.darkMode);

  const update = (id: string, data: Partial<EducationEntry>) => dispatch(updateEducation({ id, data }));

  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors ${
    darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900'
  }`;
  const labelCls = `block text-xs font-semibold mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`;
  const cardCls = `rounded-xl border p-4 space-y-3 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Education</h2>
        <button onClick={() => dispatch(addEducation())} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors">
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      {education.map(edu => (
        <div key={edu.id} className={cardCls}>
          <div className="flex justify-end">
            <button aria-label={`Remove education: ${edu.institution || 'untitled'}`} onClick={() => dispatch(removeEducation(edu.id))} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div>
            <label htmlFor={`edu-${edu.id}-institution`} className={labelCls}>Institution *</label>
            <input id={`edu-${edu.id}-institution`} aria-required="true" className={inputCls} value={edu.institution} onChange={e => update(edu.id, { institution: e.target.value })} placeholder="Massachusetts Institute of Technology" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`edu-${edu.id}-degree`} className={labelCls}>Degree *</label>
              <input id={`edu-${edu.id}-degree`} aria-required="true" className={inputCls} value={edu.degree} onChange={e => update(edu.id, { degree: e.target.value })} placeholder="Bachelor of Science" />
            </div>
            <div>
              <label htmlFor={`edu-${edu.id}-field`} className={labelCls}>Field of Study *</label>
              <input id={`edu-${edu.id}-field`} aria-required="true" className={inputCls} value={edu.field} onChange={e => update(edu.id, { field: e.target.value })} placeholder="Computer Science" />
            </div>
            <div>
              <label htmlFor={`edu-${edu.id}-start`} className={labelCls}>Start Date</label>
              <input id={`edu-${edu.id}-start`} className={inputCls} type="month" value={edu.startDate} onChange={e => update(edu.id, { startDate: e.target.value })} />
            </div>
            <div>
              <label htmlFor={`edu-${edu.id}-end`} className={labelCls}>End Date (or Expected)</label>
              <input id={`edu-${edu.id}-end`} className={inputCls} type="month" value={edu.endDate} onChange={e => update(edu.id, { endDate: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`edu-${edu.id}-gpa`} className={labelCls}>GPA (optional)</label>
              <input id={`edu-${edu.id}-gpa`} className={inputCls} value={edu.gpa || ''} onChange={e => update(edu.id, { gpa: e.target.value })} placeholder="3.9/4.0" />
            </div>
            <div>
              <label htmlFor={`edu-${edu.id}-honors`} className={labelCls}>Honors / Distinction</label>
              <input id={`edu-${edu.id}-honors`} className={inputCls} value={edu.honors || ''} onChange={e => update(edu.id, { honors: e.target.value })} placeholder="Summa Cum Laude" />
            </div>
          </div>
          <div>
            <label htmlFor={`edu-${edu.id}-coursework`} className={labelCls}>Relevant Coursework (optional)</label>
            <textarea id={`edu-${edu.id}-coursework`} className={`${inputCls} resize-none`} rows={2} value={edu.coursework || ''} onChange={e => update(edu.id, { coursework: e.target.value })} placeholder="Data Structures, Algorithms, Machine Learning, Distributed Systems" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default EducationForm;
