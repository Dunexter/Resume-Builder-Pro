import React, { useId, useState } from 'react';
import { CheckCircle2, Circle, X } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../hooks';
import { setActiveSection } from '../../store/resumeSlice';
import { getResumeCompletion } from '../../utils/validationUtils';

interface CompletionChecklistProps {
  onNavigate?: (section: string) => void;
}

const CompletionChecklist: React.FC<CompletionChecklistProps> = ({ onNavigate }) => {
  const dispatch = useAppDispatch();
  const data = useAppSelector(state => state.resume.data);
  const darkMode = useAppSelector(state => state.resume.settings.darkMode);
  const [dismissed, setDismissed] = useState(false);
  const [reviewedData, setReviewedData] = useState<typeof data | null>(null);
  const titleId = useId();
  const completion = getResumeCompletion(data);
  const reviewed = reviewedData === data;
  const steps = [
    { section: 'personal', label: 'Add your name and valid email', complete: completion.contact },
    { section: completion.experience ? 'experience' : 'projects', label: 'Describe experience or a project', complete: completion.experience || completion.projects },
    { section: 'skills', label: 'List your skills', complete: completion.skills },
  ];
  const completed = steps.filter(step => step.complete).length + Number(reviewed);

  if (dismissed) return null;

  const navigate = (section: string) => {
    dispatch(setActiveSection(section));
    window.dispatchEvent(new CustomEvent('resume-navigate-edit'));
    onNavigate?.(section);
  };

  return (
    <section aria-labelledby={titleId} className={`mb-5 rounded-xl border p-4 ${darkMode ? 'border-gray-700 bg-gray-800 text-gray-100' : 'border-gray-200 bg-gray-50 text-gray-900'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={titleId} className="text-sm font-semibold">Resume completion</h2>
          <p className="mt-1 text-xs" role="status">{completed} of 4 steps complete. This is a guide, not an export requirement.</p>
        </div>
        <button type="button" aria-label="Dismiss completion checklist" onClick={() => setDismissed(true)} className="rounded p-1 focus-visible:outline-indigo-500"><X className="h-4 w-4" /></button>
      </div>
      <ul className="mt-3 space-y-2">
        {steps.map(step => (
          <li key={step.section}>
            <button type="button" onClick={() => navigate(step.section)} className="flex items-center gap-2 text-left text-sm hover:underline focus-visible:outline-indigo-500">
              {step.complete ? <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-green-600" /> : <Circle aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-400" />}
              <span className="sr-only">{step.complete ? 'Complete: ' : 'To do: '}</span>{step.label}
            </button>
          </li>
        ))}
        <li>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={reviewed} onChange={event => setReviewedData(event.target.checked ? data : null)} />
            I reviewed the preview, contact details, dates, and claims.
          </label>
        </li>
      </ul>
      <p className="mt-3 text-xs">Coursework, personal projects, and volunteering count. No paid work experience is needed. Review again after edits.</p>
    </section>
  );
};

export default CompletionChecklist;
