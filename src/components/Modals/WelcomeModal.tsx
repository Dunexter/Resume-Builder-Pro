import React from 'react';
import { FileText, Sparkles, PenLine, Upload, X } from 'lucide-react';
import Dialog from './Dialog';

interface Props {
  onChooseBlank: () => void;
  onChooseSample: () => void;
  onClose?: () => void;
  error?: string;
}

const WelcomeModal: React.FC<Props> = ({ onChooseBlank, onChooseSample, onClose, error }) => {
  return (
    <Dialog labelledBy="welcome-title" onClose={onClose} className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
        {onClose && <button aria-label="Close welcome" onClick={onClose} className="absolute right-3 top-3 p-2 text-gray-500"><X className="h-4 w-4" /></button>}
        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-indigo-600 p-2.5 rounded-xl">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 id="welcome-title" className="text-xl font-bold text-gray-900 dark:text-white">Welcome to ResumeBuilder Pro</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Free · Local-first · ATS-friendly</p>
            </div>
          </div>

          {error && <p role="alert" className="mb-4 text-sm text-red-600">{error}</p>}
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
            How would you like to start? Resumes are saved in this browser. AI features send selected content to your configured provider only when used. No account required.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-resume-import'))}
              className="sm:col-span-2 text-left rounded-xl border-2 border-indigo-500 p-4 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <Upload aria-hidden="true" className="h-5 w-5 text-indigo-600 mb-2" />
              <div className="font-semibold text-gray-900 dark:text-white text-sm">Import Resume</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Start with an existing resume. Review it before creating a new resume.</div>
            </button>
            <button
              type="button"
              onClick={onChooseBlank}
              className="text-left rounded-xl border-2 border-gray-200 dark:border-gray-600 p-4 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <PenLine className="h-5 w-5 text-indigo-600 mb-2" />
              <div className="font-semibold text-gray-900 dark:text-white text-sm">Start blank</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Empty sections with sensible defaults. Build your resume from scratch.
              </div>
            </button>

            <button
              type="button"
              onClick={onChooseSample}
              className="text-left rounded-xl border-2 border-gray-200 dark:border-gray-600 p-4 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <Sparkles className="h-5 w-5 text-indigo-600 mb-2" />
              <div className="font-semibold text-gray-900 dark:text-white text-sm">Load sample</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Explore templates and ATS tools with a filled-in demo resume.
              </div>
            </button>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 mt-5">
            You can always create more resumes from <span className="font-medium">My Resumes</span>.
          </p>
        </div>
    </Dialog>
  );
};

export default WelcomeModal;
