import React from 'react';
import { X, Check } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../hooks';
import { setShowTemplateGallery, updateStyling } from '../../store/resumeSlice';
import { ResumeData } from '../../types/resume';
import Dialog from './Dialog';

const TEMPLATES: { id: ResumeData['styling']['template']; label: string; description: string; tags: string[]; preview: React.ReactNode }[] = [
  {
    id: 'professional',
    label: 'Professional',
    description: 'Clean centered header with colored section separators. Widely accepted across all industries.',
    tags: ['ATS Safe', 'All Industries', 'Most Popular'],
    preview: (
      <div className="w-full h-full bg-white p-3 text-left" style={{ fontFamily: 'Arial', fontSize: 6 }}>
        <div className="text-center border-b-2 border-indigo-700 pb-1 mb-2">
          <div className="font-bold text-indigo-800 text-sm">Your Name</div>
          <div className="text-gray-500" style={{ fontSize: 5 }}>email · phone · location</div>
        </div>
        {['Skills', 'Experience', 'Education'].map(s => (
          <div key={s} className="mb-1.5">
            <div className="text-indigo-800 font-bold border-b border-indigo-700 mb-0.5" style={{ fontSize: 5.5 }}>{s.toUpperCase()}</div>
            <div className="bg-gray-100 h-1.5 rounded w-full mb-0.5" />
            <div className="bg-gray-100 h-1.5 rounded w-4/5" />
          </div>
        ))}
      </div>
    )
  },
  {
    id: 'modern',
    label: 'Modern',
    description: 'Solid color header bar, accent left stripe on sections, pill-style skill tags. Perfect for tech.',
    tags: ['Tech', 'Design', 'Startup'],
    preview: (
      <div className="w-full h-full bg-white text-left overflow-hidden" style={{ fontFamily: 'Arial', fontSize: 6 }}>
        <div className="bg-indigo-800 p-2 mb-2">
          <div className="font-bold text-white text-sm">Your Name</div>
          <div className="text-indigo-200" style={{ fontSize: 5 }}>email · phone · location</div>
        </div>
        <div className="px-2">
          {['Experience', 'Skills', 'Education'].map(s => (
            <div key={s} className="mb-1.5 flex gap-1">
              <div className="w-1 bg-indigo-400 rounded flex-shrink-0" />
              <div className="flex-1">
                <div className="font-bold text-indigo-800" style={{ fontSize: 5.5 }}>{s.toUpperCase()}</div>
                <div className="bg-gray-100 h-1.5 rounded w-full mb-0.5" />
                <div className="bg-gray-100 h-1.5 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  },
  {
    id: 'classic',
    label: 'Classic',
    description: 'Traditional Times New Roman style with double-line borders. Maximally ATS-safe for conservative industries.',
    tags: ['Finance', 'Law', 'Academia', 'Most ATS-Safe'],
    preview: (
      <div className="w-full h-full bg-white p-3 text-left" style={{ fontFamily: 'Times New Roman', fontSize: 6 }}>
        <div className="text-center mb-1.5">
          <div className="font-bold text-sm tracking-wider uppercase">Your Name</div>
          <div className="text-gray-600" style={{ fontSize: 5 }}>email · phone · location</div>
        </div>
        {['Experience', 'Education', 'Skills'].map(s => (
          <div key={s} className="mb-1.5">
            <div className="border-t-2 border-b border-black py-0.5 font-bold uppercase tracking-wider" style={{ fontSize: 5 }}>{s}</div>
            <div className="bg-gray-100 h-1.5 rounded w-full mt-0.5 mb-0.5" />
            <div className="bg-gray-100 h-1.5 rounded w-4/5" />
          </div>
        ))}
      </div>
    )
  },
  {
    id: 'compact',
    label: 'Compact',
    description: 'Two-column layout maximizing content density. Fits more experience on one page.',
    tags: ['Senior Roles', 'More Content', 'Two-Column'],
    preview: (
      <div className="w-full h-full bg-white overflow-hidden text-left" style={{ fontFamily: 'Arial', fontSize: 6 }}>
        <div className="bg-indigo-800 p-2 mb-0">
          <div className="font-bold text-white text-sm">Your Name</div>
        </div>
        <div className="flex">
          <div className="flex-1 p-1.5 border-r border-gray-200">
            {['Experience', 'Projects'].map(s => (
              <div key={s} className="mb-1">
                <div className="bg-indigo-800 text-white font-bold px-1" style={{ fontSize: 4.5 }}>{s.toUpperCase()}</div>
                <div className="bg-gray-100 h-1 rounded w-full mt-0.5 mb-0.5" />
                <div className="bg-gray-100 h-1 rounded w-4/5" />
              </div>
            ))}
          </div>
          <div className="w-1/3 p-1.5 bg-gray-50">
            {['Skills', 'Awards'].map(s => (
              <div key={s} className="mb-1">
                <div className="bg-indigo-800 text-white font-bold px-1" style={{ fontSize: 4.5 }}>{s.toUpperCase()}</div>
                <div className="bg-gray-100 h-1 rounded w-full mt-0.5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'executive',
    label: 'Executive',
    description: 'Bold left color stripe with formal typography. Designed for senior and leadership positions.',
    tags: ['Senior', 'Leadership', 'C-Suite', 'Director'],
    preview: (
      <div className="w-full h-full bg-white text-left overflow-hidden flex" style={{ fontFamily: 'Arial', fontSize: 6 }}>
        <div className="w-2 bg-indigo-800 flex-shrink-0" />
        <div className="flex-1 p-2">
          <div className="border-b-2 border-double border-indigo-800 pb-1 mb-1.5">
            <div className="font-black text-indigo-800 text-sm tracking-tight">Your Name</div>
            <div className="text-gray-500" style={{ fontSize: 5 }}>email · phone · location</div>
          </div>
          {['Experience', 'Skills', 'Education'].map(s => (
            <div key={s} className="mb-1.5">
              <div className="flex items-center gap-1 mb-0.5">
                <div className="font-bold text-indigo-800 uppercase tracking-wider" style={{ fontSize: 5 }}>{s}</div>
                <div className="flex-1 h-px bg-indigo-300" />
              </div>
              <div className="bg-gray-100 h-1.5 rounded w-full mb-0.5" />
              <div className="bg-gray-100 h-1.5 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    )
  },
];

const TemplateGallery: React.FC = () => {
  const dispatch = useAppDispatch();
  const currentTemplate = useAppSelector(state => state.resume.data.styling.template);
  const darkMode = useAppSelector(state => state.resume.settings.darkMode);
  const dm = darkMode;

  return (
    <Dialog labelledBy="template-gallery-title" onClose={() => dispatch(setShowTemplateGallery(false))}
      className={`w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden ${dm ? 'bg-gray-900' : 'bg-white'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${dm ? 'border-gray-700' : 'border-gray-200'}`}>
          <div>
            <h2 id="template-gallery-title" className={`text-xl font-bold ${dm ? 'text-white' : 'text-gray-900'}`}>Choose a Template</h2>
            <p className={`text-sm mt-0.5 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>All templates are ATS-safe and free to use</p>
          </div>
          <button aria-label="Close template gallery" onClick={() => dispatch(setShowTemplateGallery(false))} className={`p-2 rounded-xl ${dm ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Grid */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {TEMPLATES.map(t => (
              <button
                key={t.id}
                aria-pressed={currentTemplate === t.id}
                onClick={() => { dispatch(updateStyling({ template: t.id })); dispatch(setShowTemplateGallery(false)); }}
                className={`group relative rounded-xl border-2 overflow-hidden transition-all hover:scale-[1.02] hover:shadow-lg text-left ${
                  currentTemplate === t.id
                    ? 'border-indigo-500 shadow-md shadow-indigo-200'
                    : (dm ? 'border-gray-700 hover:border-gray-500' : 'border-gray-200 hover:border-gray-300')
                }`}
              >
                {currentTemplate === t.id && (
                  <div className="absolute top-2 right-2 z-10 bg-indigo-500 rounded-full p-0.5">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}
                {/* Preview */}
                <div aria-hidden="true" className="h-40 overflow-hidden border-b border-gray-100">{t.preview}</div>
                {/* Info */}
                <div className={`p-3 ${dm ? 'bg-gray-800' : 'bg-white'}`}>
                  <div className={`font-bold text-sm mb-0.5 ${dm ? 'text-white' : 'text-gray-900'}`}>{t.label}</div>
                  <div className={`text-xs mb-2 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{t.description}</div>
                  <div className="flex flex-wrap gap-1">
                    {t.tags.map(tag => (
                      <span key={tag} className={`text-xs px-1.5 py-0.5 rounded-full ${dm ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>{tag}</span>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
    </Dialog>
  );
};

export default TemplateGallery;
