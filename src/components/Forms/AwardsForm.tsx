import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../../hooks';
import { addAward, updateAward, removeAward } from '../../store/resumeSlice';
import { AwardEntry } from '../../types/resume';

const AwardsForm: React.FC = () => {
  const dispatch = useAppDispatch();
  const awards = useAppSelector(state => state.resume.data.sections.awards);
  const darkMode = useAppSelector(state => state.resume.settings.darkMode);
  const update = (id: string, data: Partial<AwardEntry>) => dispatch(updateAward({ id, data }));
  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900'}`;
  const labelCls = `block text-xs font-semibold mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`;
  const cardCls = `rounded-xl border p-4 space-y-3 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Awards & Recognition</h2>
        <button onClick={() => dispatch(addAward())} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors"><Plus className="h-3.5 w-3.5" /> Add</button>
      </div>
      {awards.map(aw => (
        <div key={aw.id} className={cardCls}>
          <div className="flex justify-end"><button aria-label={`Remove award: ${aw.title || 'untitled'}`} onClick={() => dispatch(removeAward(aw.id))} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="h-4 w-4" /></button></div>
          <div><label htmlFor={`award-${aw.id}-title`} className={labelCls}>Award / Recognition Title *</label><input id={`award-${aw.id}-title`} aria-required="true" className={inputCls} value={aw.title} onChange={e => update(aw.id, { title: e.target.value })} placeholder="Employee of the Year" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor={`award-${aw.id}-issuer`} className={labelCls}>Issuing Organization</label><input id={`award-${aw.id}-issuer`} className={inputCls} value={aw.issuer || ''} onChange={e => update(aw.id, { issuer: e.target.value })} placeholder="Google" /></div>
            <div><label htmlFor={`award-${aw.id}-date`} className={labelCls}>Date</label><input id={`award-${aw.id}-date`} className={inputCls} type="month" value={aw.date || ''} onChange={e => update(aw.id, { date: e.target.value })} /></div>
          </div>
          <div><label htmlFor={`award-${aw.id}-description`} className={labelCls}>Description</label><textarea id={`award-${aw.id}-description`} className={`${inputCls} resize-none`} rows={2} value={aw.description} onChange={e => update(aw.id, { description: e.target.value })} placeholder="Brief description of the award and why it was received." /></div>
        </div>
      ))}
    </div>
  );
};

export default AwardsForm;
