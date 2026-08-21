import React, { useRef, useState } from 'react';
import { X, Upload, FileText, AlertCircle } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../hooks';
import { addResumeToList, loadResumeData, setActiveResumeId } from '../../store/resumeSlice';
import { saveResume } from '../../db/resumeDB';
import { ResumeData } from '../../types/resume';
import { importResumeFile } from '../../utils/importUtils';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  onClose: () => void;
}

const ImportResumeModal: React.FC<Props> = ({ onClose }) => {
  const dispatch = useAppDispatch();
  const darkMode = useAppSelector((s) => s.resume.settings.darkMode);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [preview, setPreview] = useState<ResumeData | null>(null);
  const [sourceLabel, setSourceLabel] = useState('');

  const dm = darkMode;

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(null);
    setWarnings([]);
    setPreview(null);
    try {
      const result = await importResumeFile(file);
      setPreview(result.data);
      setWarnings(result.warnings);
      setSourceLabel(`${file.name} (${result.source.toUpperCase()})`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const id = uuidv4();
      const now = new Date().toISOString();
      const name = preview.personalInfo.name?.trim() || 'Imported Resume';
      await saveResume({
        id,
        name,
        createdAt: now,
        updatedAt: now,
        data: preview,
        versions: [],
      });
      dispatch(addResumeToList({ id, name }));
      dispatch(setActiveResumeId(id));
      dispatch(loadResumeData(preview));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save imported resume.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 w-full max-w-lg max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col ${
        dm ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-200'
      }`}>
        <div className={`flex items-center justify-between p-5 border-b ${dm ? 'border-gray-700' : 'border-gray-200'}`}>
          <div>
            <h2 className={`text-lg font-bold ${dm ? 'text-white' : 'text-gray-900'}`}>Import resume</h2>
            <p className={`text-sm ${dm ? 'text-gray-400' : 'text-gray-500'}`}>JSON, DOCX, or PDF (text layer)</p>
          </div>
          <button type="button" onClick={onClose} className={`p-2 rounded-xl ${dm ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept=".json,.docx,.pdf,application/json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />

          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className={`w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed transition-colors ${
              dm ? 'border-gray-600 hover:border-indigo-500 text-gray-300' : 'border-gray-300 hover:border-indigo-500 text-gray-600'
            }`}
          >
            <Upload className="h-6 w-6 text-indigo-500" />
            <span className="text-sm font-medium">{busy ? 'Reading file…' : 'Choose file'}</span>
            <span className={`text-xs ${dm ? 'text-gray-500' : 'text-gray-400'}`}>.json · .docx · .pdf</span>
          </button>

          {error && (
            <div className="flex gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-300 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {warnings.map((w) => (
            <div key={w} className={`text-xs rounded-lg p-2 ${dm ? 'bg-amber-950/40 text-amber-200' : 'bg-amber-50 text-amber-800'}`}>
              {w}
            </div>
          ))}

          {preview && (
            <div className={`rounded-xl border p-4 space-y-2 ${dm ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="h-4 w-4 text-indigo-500" />
                <span className={dm ? 'text-white' : 'text-gray-900'}>Preview</span>
              </div>
              <p className={`text-xs ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{sourceLabel}</p>
              <dl className={`text-sm space-y-1 ${dm ? 'text-gray-200' : 'text-gray-800'}`}>
                <div><span className="text-gray-500">Name:</span> {preview.personalInfo.name || '—'}</div>
                <div><span className="text-gray-500">Email:</span> {preview.personalInfo.email || '—'}</div>
                <div><span className="text-gray-500">Experience entries:</span> {preview.sections.experience.length}</div>
                <div><span className="text-gray-500">Education entries:</span> {preview.sections.education.length}</div>
                <div><span className="text-gray-500">Skill groups:</span> {preview.sections.skills.length}</div>
                <div><span className="text-gray-500">Projects:</span> {preview.sections.projects.length}</div>
              </dl>
              <p className={`text-xs ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                Imports as a <strong>new</strong> resume (does not overwrite the active one).
              </p>
            </div>
          )}
        </div>

        <div className={`p-4 border-t flex justify-end gap-2 ${dm ? 'border-gray-700' : 'border-gray-200'}`}>
          <button type="button" onClick={onClose} className={`px-4 py-2 rounded-lg text-sm ${dm ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-700'}`}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!preview || busy}
            onClick={() => void handleConfirm()}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            Import as new resume
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportResumeModal;
