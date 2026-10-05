import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../../hooks';
import { addProject, updateProject, removeProject } from '../../store/resumeSlice';
import { ProjectEntry } from '../../types/resume';

const ProjectsForm: React.FC = () => {
  const dispatch = useAppDispatch();
  const projects = useAppSelector(state => state.resume.data.sections.projects);
  const darkMode = useAppSelector(state => state.resume.settings.darkMode);

  const update = (id: string, data: Partial<ProjectEntry>) => dispatch(updateProject({ id, data }));

  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors ${
    darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900'
  }`;
  const labelCls = `block text-xs font-semibold mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`;
  const cardCls = `rounded-xl border p-4 space-y-3 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Projects</h2>
        <button onClick={() => dispatch(addProject())} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors">
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
      {projects.map(proj => (
        <div key={proj.id} className={cardCls}>
          <div className="flex justify-between items-center">
            <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{proj.title || 'New Project'}</span>
            <button aria-label={`Remove project: ${proj.title || 'untitled'}`} onClick={() => dispatch(removeProject(proj.id))} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label htmlFor={`project-${proj.id}-title`} className={labelCls}>Project Title *</label>
              <input id={`project-${proj.id}-title`} aria-required="true" className={inputCls} value={proj.title} onChange={e => update(proj.id, { title: e.target.value })} placeholder="Open Source Dashboard" />
            </div>
            <div>
              <label htmlFor={`project-${proj.id}-year`} className={labelCls}>Year</label>
              <input id={`project-${proj.id}-year`} className={inputCls} value={proj.year} onChange={e => update(proj.id, { year: e.target.value })} placeholder="2024" maxLength={4} />
            </div>
          </div>
          <div>
            <label htmlFor={`project-${proj.id}-description`} className={labelCls}>Description</label>
            <textarea id={`project-${proj.id}-description`} className={`${inputCls} resize-none`} rows={3} value={proj.description} onChange={e => update(proj.id, { description: e.target.value })} placeholder="Brief description: what it does, why you built it, key features." />
          </div>
          <div>
            <label htmlFor={`project-${proj.id}-technologies`} className={labelCls}>Technologies Used</label>
            <input id={`project-${proj.id}-technologies`} className={inputCls} value={proj.technologies || ''} onChange={e => update(proj.id, { technologies: e.target.value })} placeholder="React, TypeScript, Node.js, MongoDB" />
          </div>
          <div>
            <label htmlFor={`project-${proj.id}-url`} className={labelCls}>Project URL (optional)</label>
            <input id={`project-${proj.id}-url`} className={inputCls} value={proj.url || ''} onChange={e => update(proj.id, { url: e.target.value })} placeholder="github.com/username/project" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default ProjectsForm;
