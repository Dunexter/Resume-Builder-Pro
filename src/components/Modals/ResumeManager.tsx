import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  FileText,
  Copy,
  Clock,
  Download,
  Upload,
} from 'lucide-react';

import { useAppDispatch, useAppSelector } from '../../hooks';
import {
  setActiveResumeId,
  loadResumeData,
  addResumeToList,
  removeResumeFromList,
  setResumeList,
  updateSettings,
} from '../../store/resumeSlice';

import { initialResumeData } from '../../store/resumeSlice';

import {
  listResumes,
  saveResume,
  deleteResume,
  loadSettings,
} from '../../db/resumeDB';

import { ResumeRecord } from '../../types/resume';
import { v4 as uuidv4 } from 'uuid';

import ImportResumeModal from './ImportResumeModal';

import {
  exportWorkspaceBackup,
  importWorkspaceBackup,
  readBackupFile,
} from '../../utils/backupUtils';


interface Props { onClose: () => void; }

const ResumeManager: React.FC<Props> = ({ onClose }) => {
  const dispatch = useAppDispatch();
  const activeResumeId = useAppSelector(state => state.resume.activeResumeId);
  const currentData = useAppSelector(state => state.resume.data);
  const darkMode = useAppSelector(state => state.resume.settings.darkMode);
  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [includeApiKey, setIncludeApiKey] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dm = darkMode;

  const refreshList = async () => {
    const list = await listResumes();
    const sorted = list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    setResumes(sorted);
    dispatch(setResumeList(sorted.map(r => ({
      id: r.id,
      name: r.name,
      updatedAt: r.updatedAt,
      targetJob: r.targetJob,
    }))));
    return sorted;
  };

  useEffect(() => {
    listResumes().then(list => {
      setResumes(list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
      setLoading(false);
    });
  }, [showImport]);
    refreshList().finally(() => setLoading(false));
  }, []);

  const handleNewResume = async () => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const record: ResumeRecord = {
      id,
      name: 'New Resume',
      createdAt: now,
      updatedAt: now,
      data: { ...initialResumeData, personalInfo: { ...initialResumeData.personalInfo, name: '', email: '', phone: '', summary: '' } },
      versions: [],
    };
    await saveResume(record);
    dispatch(addResumeToList({ id, name: 'New Resume' }));
    dispatch(setActiveResumeId(id));
    dispatch(loadResumeData(record.data));
    onClose();
  };

  const handleDuplicate = async (record: ResumeRecord) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const dup: ResumeRecord = { ...record, id, name: `${record.name} (copy)`, createdAt: now, updatedAt: now, versions: [] };
    await saveResume(dup);
    setResumes(prev => [dup, ...prev]);
    dispatch(addResumeToList({ id, name: dup.name }));
  };

  const handleSwitch = async (record: ResumeRecord) => {
    const existing = resumes.find(r => r.id === activeResumeId);
    if (existing) {
      await saveResume({ ...existing, data: currentData, updatedAt: new Date().toISOString() });
    }
    dispatch(setActiveResumeId(record.id));
    dispatch(loadResumeData(record.data));
    onClose();
  };

  const handleDelete = async (id: string) => {
    if (resumes.length === 1) return;
    await deleteResume(id);
    setResumes(prev => prev.filter(r => r.id !== id));
    dispatch(removeResumeFromList(id));
    if (id === activeResumeId) {
      const remaining = resumes.filter(r => r.id !== id);
      if (remaining.length > 0) {
        dispatch(setActiveResumeId(remaining[0].id));
        dispatch(loadResumeData(remaining[0].data));
      }
    }
  };

  const handleExport = async () => {
    setBackupBusy(true);
    setBackupMsg(null);
    try {
      // Persist current editor state before export
      const existing = resumes.find(r => r.id === activeResumeId);
      if (existing) {
        await saveResume({
          ...existing,
          data: currentData,
          name: currentData.personalInfo.name || existing.name,
          updatedAt: new Date().toISOString(),
        });
      }
      await exportWorkspaceBackup({ includeApiKey });
      setBackupMsg(includeApiKey
        ? 'Backup downloaded (includes API key — keep this file private).'
        : 'Backup downloaded (API key excluded).');
    } catch (e) {
      setBackupMsg(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleImportFile = async (file: File) => {
    setBackupBusy(true);
    setBackupMsg(null);
    try {
      const backup = await readBackupFile(file);
      const mode = window.confirm(
        `Import ${backup.resumes.length} resume(s)?\n\n` +
        `OK = Merge (upsert by id, keep other local resumes)\n` +
        `Cancel = stop\n\n` +
        `After this dialog you can choose Replace-all if you prefer.`
      );
      if (!mode) {
        setBackupBusy(false);
        return;
      }

      const replace = window.confirm(
        'Replace ALL local resumes and cover letters with this backup?\n\n' +
        'OK = Replace all\nCancel = Merge only'
      );

      const result = await importWorkspaceBackup(backup, replace ? 'replace' : 'merge');

      if (result.settingsImported) {
        const settings = await loadSettings();
        if (settings) dispatch(updateSettings(settings));
      }

      const sorted = await refreshList();
      if (sorted.length > 0) {
        const active = sorted.find(r => r.id === activeResumeId) || sorted[0];
        dispatch(setActiveResumeId(active.id));
        dispatch(loadResumeData(active.data));
      }

      setBackupMsg(
        `Imported ${result.resumesImported} resume(s), ${result.coverLettersImported} cover letter(s)` +
        (result.settingsImported ? ', settings updated' : '') + '.'
      );
    } catch (e) {
      setBackupMsg(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setBackupBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const cardCls = `rounded-xl border p-4 ${dm ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col ${dm ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className={`flex items-center justify-between p-5 border-b flex-shrink-0 ${dm ? 'border-gray-700' : 'border-gray-200'}`}>
          <div>
            <h2 className={`text-lg font-bold ${dm ? 'text-white' : 'text-gray-900'}`}>My Resumes</h2>
            <p className={`text-sm ${dm ? 'text-gray-400' : 'text-gray-500'}`}>Switch between resumes or create tailored versions per job</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleNewResume} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors">
              <Plus className="h-3.5 w-3.5" /> New Resume
            </button>
            <button onClick={onClose} className={`p-2 rounded-xl ${dm ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}><X className="h-4 w-4" /></button>
          </div>

        {/* Backup bar */}
        <div className={`px-5 py-3 border-b flex flex-wrap items-center gap-2 flex-shrink-0 ${dm ? 'border-gray-700 bg-gray-900/80' : 'border-gray-200 bg-white'}`}>
          <button
            type="button"
            disabled={backupBusy}
            onClick={handleExport}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${dm ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
          >
            <Download className="h-3.5 w-3.5" />
            Export All
          </button>
          <button
            type="button"
            disabled={backupBusy}
            onClick={() => fileInputRef.current?.click()}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${dm ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
          >
            <Upload className="h-3.5 w-3.5" />
            Import All
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImportFile(f);
            }}
          />
          <label className={`flex items-center gap-1.5 text-xs cursor-pointer ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
            <input
              type="checkbox"
              checked={includeApiKey}
              onChange={(e) => setIncludeApiKey(e.target.checked)}
              className="rounded border-gray-400"
            />
            Include AI API key in export
          </label>
          {backupMsg && (
            <p className={`w-full text-xs mt-1 ${dm ? 'text-gray-300' : 'text-gray-600'}`}>{backupMsg}</p>
          )}
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <div className="text-center py-10 text-gray-400">Loading...</div>
          ) : resumes.map(r => (
            <div key={r.id} className={`${cardCls} flex items-center gap-4 ${r.id === activeResumeId ? (dm ? 'border-indigo-600 ring-1 ring-indigo-600' : 'border-indigo-400 ring-1 ring-indigo-400') : ''}`}>
              <div className={`p-2.5 rounded-xl ${dm ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <FileText className={`h-5 w-5 ${r.id === activeResumeId ? 'text-indigo-500' : (dm ? 'text-gray-400' : 'text-gray-600')}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`font-semibold text-sm ${dm ? 'text-white' : 'text-gray-900'}`}>
                  {r.name}
                  {r.id === activeResumeId && <span className="ml-2 text-xs text-indigo-500 font-medium">Active</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold text-sm ${dm ? 'text-white' : 'text-gray-900'}`}>
                    {r.name}
                    {r.id === activeResumeId && <span className="ml-2 text-xs text-indigo-500 font-medium">Active</span>}
                  </div>
                  {r.targetJob && <div className={`text-xs ${dm ? 'text-gray-400' : 'text-gray-500'}`}>Target: {r.targetJob}</div>}
                  <div className={`flex items-center gap-1 text-xs ${dm ? 'text-gray-500' : 'text-gray-400'} mt-0.5`}>
                    <Clock className="h-3 w-3" />
                    {new Date(r.updatedAt).toLocaleDateString()} {new Date(r.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {r.id !== activeResumeId && (
                    <button onClick={() => handleSwitch(r)} className="px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                      Open
                    </button>
                  )}
                  <button onClick={() => handleDuplicate(r)} className={`p-1.5 rounded-lg transition-colors ${dm ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`} title="Duplicate">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDelete(r.id)} disabled={resumes.length === 1} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors disabled:opacity-30" title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showImport && (
        <ImportResumeModal
          onClose={() => {
            setShowImport(false);
          }}
        />
      )}
    </>
  );
};

export default ResumeManager;
