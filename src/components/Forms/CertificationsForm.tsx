import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../../hooks';
import { addCertification, updateCertification, removeCertification, toggleSectionVisibility } from '../../store/resumeSlice';
import { CertificationEntry } from '../../types/resume';

const CertificationsForm: React.FC = () => {
  const dispatch = useAppDispatch();
  const certs = useAppSelector(state => state.resume.data.sections.certifications);
  const darkMode = useAppSelector(state => state.resume.settings.darkMode);
  const section = useAppSelector(state => state.resume.data.sectionOrder.find(s => s.type === 'certifications'));
  const update = (id: string, data: Partial<CertificationEntry>) => dispatch(updateCertification({ id, data }));
  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900'}`;
  const labelCls = `block text-xs font-semibold mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`;
  const cardCls = `rounded-xl border p-4 space-y-3 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Certifications</h2>
        <button onClick={() => dispatch(addCertification())} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors"><Plus className="h-3.5 w-3.5" /> Add</button>
      </div>
      {section && !section.visible && (
        <div role="status" className="rounded-lg border border-amber-400 p-3 text-sm text-amber-800 dark:text-amber-200">
          Certifications are hidden from your resume preview and exports. Your entries are still saved.
          <button onClick={() => dispatch(toggleSectionVisibility(section.id))} className="block mt-2 font-semibold underline">Show certifications on resume</button>
        </div>
      )}
      {certs.map(cert => (
        <div key={cert.id} className={cardCls}>
          <div className="flex justify-end"><button aria-label={`Remove certification: ${cert.name || 'untitled'}`} onClick={() => dispatch(removeCertification(cert.id))} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="h-4 w-4" /></button></div>
          <div><label htmlFor={`cert-${cert.id}-name`} className={labelCls}>Certification Name *</label><input id={`cert-${cert.id}-name`} aria-required="true" className={inputCls} value={cert.name} onChange={e => update(cert.id, { name: e.target.value })} placeholder="AWS Solutions Architect – Associate" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor={`cert-${cert.id}-issuer`} className={labelCls}>Issuing Organization *</label><input id={`cert-${cert.id}-issuer`} aria-required="true" className={inputCls} value={cert.issuer} onChange={e => update(cert.id, { issuer: e.target.value })} placeholder="Amazon Web Services" /></div>
            <div><label htmlFor={`cert-${cert.id}-date`} className={labelCls}>Issue Date</label><input id={`cert-${cert.id}-date`} className={inputCls} type="month" value={cert.date} onChange={e => update(cert.id, { date: e.target.value })} /></div>
            <div><label htmlFor={`cert-${cert.id}-expiry`} className={labelCls}>Expiry Date</label><input id={`cert-${cert.id}-expiry`} className={inputCls} type="month" value={cert.expiryDate || ''} onChange={e => update(cert.id, { expiryDate: e.target.value })} /></div>
            <div><label htmlFor={`cert-${cert.id}-credential`} className={labelCls}>Credential ID</label><input id={`cert-${cert.id}-credential`} className={inputCls} value={cert.credentialId || ''} onChange={e => update(cert.id, { credentialId: e.target.value })} placeholder="ABC123XYZ" /></div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CertificationsForm;
