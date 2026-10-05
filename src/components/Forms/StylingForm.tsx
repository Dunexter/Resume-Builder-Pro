import React from 'react';
import { useAppSelector, useAppDispatch } from '../../hooks';
import { updateStyling, setShowTemplateGallery } from '../../store/resumeSlice';
import { ResumeData } from '../../types/resume';
import { Layers } from 'lucide-react';

const FONTS = ['Arial', 'Calibri', 'Georgia', 'Times New Roman', 'Helvetica', 'Verdana'];

const TEMPLATES: { id: ResumeData['styling']['template']; label: string; description: string; preview: string }[] = [
  { id: 'professional', label: 'Professional', description: 'Clean, centered header with colored section bars. Best for most industries.', preview: '🏢' },
  { id: 'modern', label: 'Modern', description: 'Dark header bar, accent left stripe, pill-style skill tags. Great for tech roles.', preview: '💻' },
  { id: 'classic', label: 'Classic', description: 'Traditional Times New Roman style. Maximally ATS-safe, ideal for finance/law.', preview: '📄' },
  { id: 'compact', label: 'Compact', description: 'Two-column layout with high info density. Fits more in one page.', preview: '📊' },
  { id: 'executive', label: 'Executive', description: 'Bold left accent stripe, formal look for senior/leadership roles.', preview: '👔' },
];

const PALETTES = [
  { primary: '#1C033C', secondary: '#371e77', accent: '#6d28d9', label: 'Indigo' },
  { primary: '#1e3a5f', secondary: '#2563eb', accent: '#3b82f6', label: 'Navy Blue' },
  { primary: '#1a3a1a', secondary: '#16a34a', accent: '#22c55e', label: 'Forest Green' },
  { primary: '#1a1a1a', secondary: '#374151', accent: '#6b7280', label: 'Charcoal' },
  { primary: '#7c1c1c', secondary: '#dc2626', accent: '#ef4444', label: 'Crimson' },
  { primary: '#7c3a00', secondary: '#ea580c', accent: '#f97316', label: 'Burnt Orange' },
];

const StylingForm: React.FC = () => {
  const dispatch = useAppDispatch();
  const styling = useAppSelector(state => state.resume.data.styling);
  const darkMode = useAppSelector(state => state.resume.settings.darkMode);

  const dm = darkMode;
  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-colors ${dm ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`;
  const labelCls = `block text-xs font-semibold mb-1 ${dm ? 'text-gray-300' : 'text-gray-600'}`;
  const cardCls = `rounded-xl border p-4 space-y-4 ${dm ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`;

  return (
    <div className="space-y-5">
      <h2 className={`text-lg font-bold ${dm ? 'text-white' : 'text-gray-900'}`}>Resume Styling</h2>

      {/* Template picker */}
      <div className={cardCls}>
        <div className="flex items-center justify-between">
          <h3 className={`text-sm font-bold ${dm ? 'text-gray-200' : 'text-gray-800'}`}>Template</h3>
          <button onClick={() => dispatch(setShowTemplateGallery(true))} className="text-xs text-indigo-500 hover:underline flex items-center gap-1">
            <Layers className="h-3.5 w-3.5" /> Full Gallery
          </button>
        </div>
        <div className="space-y-2">
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              aria-pressed={styling.template === t.id}
              onClick={() => dispatch(updateStyling({ template: t.id }))}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                styling.template === t.id
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                  : (dm ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300')
              }`}
            >
              <span aria-hidden="true" className="text-2xl">{t.preview}</span>
              <div>
                <div className={`text-sm font-semibold ${dm ? 'text-gray-200' : 'text-gray-800'}`}>{t.label}</div>
                <div className={`text-xs ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{t.description}</div>
              </div>
              {styling.template === t.id && <div className="ml-auto w-2.5 h-2.5 rounded-full bg-indigo-500 flex-shrink-0" />}
            </button>
          ))}
        </div>
      </div>

      {/* Color palettes */}
      <div className={cardCls}>
        <h3 className={`text-sm font-bold ${dm ? 'text-gray-200' : 'text-gray-800'}`}>Color Palette</h3>
        <div className="grid grid-cols-3 gap-2">
          {PALETTES.map(p => (
            <button
              key={p.label}
              aria-pressed={styling.colors.primary === p.primary && styling.colors.secondary === p.secondary && styling.colors.accent === p.accent}
              onClick={() => dispatch(updateStyling({ colors: { primary: p.primary, secondary: p.secondary, accent: p.accent } }))}
              className={`p-2.5 rounded-xl border-2 transition-all ${styling.colors.primary === p.primary ? 'border-indigo-500 scale-105' : (dm ? 'border-gray-700' : 'border-gray-200')}`}
            >
              <div className="flex gap-1 mb-1.5 justify-center">
                <div className="w-5 h-5 rounded-full" style={{ backgroundColor: p.primary }} />
                <div className="w-5 h-5 rounded-full" style={{ backgroundColor: p.secondary }} />
                <div className="w-5 h-5 rounded-full" style={{ backgroundColor: p.accent }} />
              </div>
              <div className={`text-xs font-medium ${dm ? 'text-gray-300' : 'text-gray-600'}`}>{p.label}</div>
            </button>
          ))}
        </div>
        {/* Custom color pickers */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          {(['primary', 'secondary', 'accent'] as const).map(key => (
            <div key={key}>
              <label htmlFor={`styling-${key}-hex`} className={labelCls}>{key.charAt(0).toUpperCase() + key.slice(1)}</label>
              <div className="flex gap-1.5 items-center">
                <input aria-label={`${key} color picker`} type="color" value={styling.colors[key] || '#000000'} onChange={e => dispatch(updateStyling({ colors: { ...styling.colors, [key]: e.target.value } }))} className="w-8 h-8 rounded cursor-pointer border-0 p-0.5" />
                <input id={`styling-${key}-hex`} className={`${inputCls} text-xs py-1 flex-1 min-w-0`} value={styling.colors[key] || ''} onChange={e => dispatch(updateStyling({ colors: { ...styling.colors, [key]: e.target.value } }))} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Typography */}
      <div className={cardCls}>
        <h3 className={`text-sm font-bold ${dm ? 'text-gray-200' : 'text-gray-800'}`}>Typography</h3>
        <div>
          <label htmlFor="styling-font-family" className={labelCls}>Font Family</label>
          <select id="styling-font-family" className={inputCls} value={styling.fontFamily} onChange={e => dispatch(updateStyling({ fontFamily: e.target.value }))}>
            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <p className={`mt-1 text-xs ${dm ? 'text-gray-500' : 'text-gray-400'}`}>All options are ATS-safe fonts.</p>
        </div>
        <div>
          <label htmlFor="styling-font-size" className={labelCls}>Font Size: {styling.fontSize}pt</label>
          <input id="styling-font-size" aria-valuetext={`${styling.fontSize} points`} type="range" min="9" max="13" step="0.5" value={styling.fontSize} onChange={e => dispatch(updateStyling({ fontSize: parseFloat(e.target.value) }))} className="w-full accent-indigo-600" />
          <div className={`flex justify-between text-xs ${dm ? 'text-gray-500' : 'text-gray-400'}`}><span>9pt</span><span className="font-medium text-indigo-500">10–12pt optimal</span><span>13pt</span></div>
        </div>
        <div>
          <label htmlFor="styling-spacing" className={labelCls}>Line Spacing: {styling.spacing}×</label>
          <input id="styling-spacing" aria-valuetext={`${styling.spacing} times`} type="range" min="1.0" max="1.8" step="0.1" value={styling.spacing} onChange={e => dispatch(updateStyling({ spacing: parseFloat(e.target.value) }))} className="w-full accent-indigo-600" />
          <div className={`flex justify-between text-xs ${dm ? 'text-gray-500' : 'text-gray-400'}`}><span>Compact 1.0</span><span>Spacious 1.8</span></div>
        </div>
      </div>
    </div>
  );
};

export default StylingForm;
