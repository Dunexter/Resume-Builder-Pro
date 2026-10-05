import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../../hooks';
import { addCustomSectionEntry, updateCustomSectionEntry, removeCustomSectionEntry, removeCustomSection, updateCustomSection } from '../../store/resumeSlice';

interface Props { sectionId: string; }

const CustomSectionForm: React.FC<Props> = ({ sectionId }) => {
  const dispatch = useAppDispatch();
  const section = useAppSelector(state => state.resume.data.sections.custom.find(s => s.id === sectionId));
  const darkMode = useAppSelector(state => state.resume.settings.darkMode);

  if (!section) return null;

  const dm = darkMode;
  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-colors ${dm ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900'}`;
  const labelCls = `block text-xs font-semibold mb-1 ${dm ? 'text-gray-300' : 'text-gray-600'}`;
  const cardCls = `rounded-xl border p-4 space-y-3 ${dm ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <label htmlFor={`custom-${sectionId}-name`} className={labelCls}>Section Name</label>
          <input id={`custom-${sectionId}-name`} className={inputCls} value={section.name} onChange={e => dispatch(updateCustomSection({ id: sectionId, name: e.target.value }))} />
        </div>
        <button aria-label={`Remove section: ${section.name || 'untitled'}`} onClick={() => dispatch(removeCustomSection(sectionId))} className="ml-3 mt-4 p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <button onClick={() => dispatch(addCustomSectionEntry(sectionId))} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors">
        <Plus className="h-3.5 w-3.5" /> Add Entry
      </button>
      {section.entries.map(entry => (
        <div key={entry.id} className={cardCls}>
          <div className="flex justify-end">
            <button aria-label={`Remove entry: ${entry.title || 'untitled'}`} onClick={() => dispatch(removeCustomSectionEntry({ sectionId, entryId: entry.id }))} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div><label htmlFor={`custom-${sectionId}-${entry.id}-title`} className={labelCls}>Title</label><input id={`custom-${sectionId}-${entry.id}-title`} className={inputCls} value={entry.title} onChange={e => dispatch(updateCustomSectionEntry({ sectionId, entryId: entry.id, data: { title: e.target.value } }))} placeholder="Entry title" /></div>
          <div><label htmlFor={`custom-${sectionId}-${entry.id}-content`} className={labelCls}>Content</label><textarea id={`custom-${sectionId}-${entry.id}-content`} className={`${inputCls} resize-none`} rows={3} value={entry.content} onChange={e => dispatch(updateCustomSectionEntry({ sectionId, entryId: entry.id, data: { content: e.target.value } }))} placeholder="Content" /></div>
        </div>
      ))}
    </div>
  );
};

export default CustomSectionForm;
