import React, { useEffect, useRef, useState } from 'react';
import { X, Plus, Trash2, FileText, Copy, Clock, Download, Upload, Pencil } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../hooks';
import { initialResumeData, setResumeList, updateSettings } from '../../store/resumeSlice';
import { listResumes, loadResume, saveResume, loadSettings, updateResumeRecord } from '../../db/resumeDB';
import { ResumeRecord } from '../../types/resume';
import { v4 as uuidv4 } from 'uuid';
import { createEditorResume, deleteEditorResume, flushEditor, openEditorRecord } from '../../utils/editorPersistence';
import { exportWorkspaceBackup, importWorkspaceBackup, readBackupFile, ImportMode, WorkspaceBackup } from '../../utils/backupUtils';
import Dialog from './Dialog';

interface Props { onClose: () => void; }

const ResumeManager: React.FC<Props> = ({ onClose }) => {
  const dispatch = useAppDispatch();
  const activeResumeId = useAppSelector(state => state.resume.activeResumeId);
  const hydrated = useAppSelector(state => state.resume.hydrated);
  const dm = useAppSelector(state => state.resume.settings.darkMode);
  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [includeApiKey, setIncludeApiKey] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<WorkspaceBackup | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [editing, setEditing] = useState<{ id: string; name: string; targetJob: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const disabled = busy || loading || !hydrated;

  const refreshList = async () => {
    const list = await listResumes();
    const sorted = list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    setResumes(sorted);
    dispatch(setResumeList(sorted.map(({ id, name, updatedAt, targetJob }) => ({ id, name, updatedAt, targetJob }))));
    return sorted;
  };

  useEffect(() => {
    let cancelled = false;
    listResumes().then(list => {
      if (cancelled) return;
      const sorted = list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setResumes(sorted);
      dispatch(setResumeList(sorted.map(({ id, name, updatedAt, targetJob }) => ({ id, name, updatedAt, targetJob }))));
    }).catch(err => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load resumes.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [dispatch]);

  const run = async (operation: () => Promise<void>) => {
    if (busyRef.current || loading || !hydrated) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await operation();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The operation failed. Please try again.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const close = () => { if (!busyRef.current) onClose(); };

  const handleSwitch = (id: string) => run(async () => {
    await flushEditor();
    const record = await loadResume(id);
    if (!record) throw new Error('This resume no longer exists. Close and reopen My Resumes to refresh.');
    openEditorRecord(record);
    onClose();
  });

  const handleDuplicate = (id: string) => run(async () => {
    await flushEditor();
    // The list is only a display snapshot; duplicate the freshly persisted editor/record.
    const record = await loadResume(id);
    if (!record) throw new Error('This resume no longer exists.');
    const now = new Date().toISOString();
    await saveResume({ ...record, id: uuidv4(), name: `${record.name} (copy)`, createdAt: now, updatedAt: now, versions: [] });
    await refreshList();
    setMessage('Resume duplicated.');
  });

  const handleMetadataSave = () => {
    if (!editing) return;
    const { id, name, targetJob } = editing;
    if (!name.trim()) { setError('Enter a document name.'); return; }
    return run(async () => {
      await flushEditor();
      await updateResumeRecord(id, record => ({ ...record, name: name.trim(), targetJob: targetJob.trim(), updatedAt: new Date().toISOString() }));
      await refreshList();
      setEditing(null);
      setMessage('Resume details updated.');
    });
  };

  const handleImportFile = (file: File) => run(async () => {
    try {
      const backup = await readBackupFile(file);
      setPendingBackup(backup);
      setImportMode('merge');
      setEditing(null);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  });

  const handleRestore = () => run(async () => {
    if (!pendingBackup) return;
    if (importMode === 'replace' && pendingBackup.resumes.length === 0) {
      throw new Error('Cannot replace the workspace with a backup containing no resumes. Choose Merge instead.');
    }
    await flushEditor();
    const result = await importWorkspaceBackup(pendingBackup, importMode);
    const sorted = await refreshList();
    const nextId = sorted.find(record => record.id === activeResumeId)?.id || sorted[0]?.id;
    if (nextId) {
      const record = await loadResume(nextId);
      if (!record) throw new Error('Could not reopen the restored resume.');
      openEditorRecord(record);
    }
    if (result.settingsImported) {
      const settings = await loadSettings();
      if (settings) dispatch(updateSettings(settings));
    }
    setPendingBackup(null);
    setMessage(`Imported ${result.resumesImported} resume(s), ${result.coverLettersImported} cover letter(s)${result.settingsImported ? ', settings updated' : ''}.`);
  });

  const buttonClass = `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40 ${dm ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`;
  const fieldClass = `mt-1 w-full rounded-lg border px-3 py-2 text-sm ${dm ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`;

  return (
    <Dialog labelledBy="resume-manager-title" onClose={busy ? undefined : close}
      className={`w-full min-w-0 max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col ${dm ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div aria-busy={busy} className="flex min-h-0 flex-col">
        <div className={`flex flex-wrap items-center justify-between gap-3 p-5 border-b shrink-0 ${dm ? 'border-gray-700' : 'border-gray-200'}`}>
          <div>
            <h2 id="resume-manager-title" className="text-lg font-bold">My Resumes</h2>
            <p className="text-sm text-gray-500">Manage documents and tailored versions per job</p>
          </div>
          <button onClick={close} disabled={busy} aria-label="Close resume manager" className={`${buttonClass} ml-auto`}><X className="h-4 w-4" /></button>
        </div>
        <div className="overflow-y-auto min-h-0 p-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            <button disabled={disabled || !!pendingBackup} onClick={() => void run(async () => {
              await createEditorResume(initialResumeData, 'New Resume');
              onClose();
            })} className={buttonClass}><Plus className="h-4 w-4" />New Resume</button>
            <button disabled={disabled || !!pendingBackup} onClick={() => void run(async () => {
              await flushEditor();
              onClose();
              window.dispatchEvent(new CustomEvent('open-resume-import'));
            })} className={buttonClass}><Upload className="h-4 w-4" />Import document</button>
            <button disabled={disabled || !!pendingBackup} onClick={() => void run(async () => {
              await flushEditor();
              await exportWorkspaceBackup({ includeApiKey });
              setMessage(includeApiKey ? 'Backup downloaded (includes API key; keep this file private).' : 'Backup downloaded (API key excluded).');
            })} className={buttonClass}><Download className="h-4 w-4" />Export All</button>
            <button disabled={disabled || !!pendingBackup} onClick={() => fileInputRef.current?.click()} className={buttonClass}><Upload className="h-4 w-4" />Import backup</button>
            <input ref={fileInputRef} type="file" accept="application/json,.json" aria-label="Backup file" className="hidden" disabled={disabled || !!pendingBackup}
              onChange={event => { const file = event.target.files?.[0]; if (file) void handleImportFile(file); }} />
            <label className="flex w-full items-center gap-2 text-xs text-gray-500">
              <input type="checkbox" checked={includeApiKey} disabled={disabled || !!pendingBackup} onChange={event => setIncludeApiKey(event.target.checked)} />
              Include AI API key in export
            </label>
          </div>
          {busy && <p role="status" className="text-sm text-gray-500">Working... Please keep this window open.</p>}
          {error && <p role="alert" className="text-sm text-red-500 break-words">{error}</p>}
          {message && <p role="status" className="text-sm text-gray-500">{message}</p>}
          {pendingBackup && <section aria-label="Restore backup" className={`rounded-xl border p-4 space-y-3 ${dm ? 'border-gray-700' : 'border-gray-200'}`}>
            <h3 className="font-semibold">Restore {pendingBackup.resumes.length} resume(s)</h3>
            <label className="block text-sm">Restore mode
              <select value={importMode} disabled={busy} onChange={event => setImportMode(event.target.value as ImportMode)} className={fieldClass}>
                <option value="merge">Merge with local workspace</option>
                <option value="replace">Replace local workspace</option>
              </select>
            </label>
            <p className="text-sm text-gray-500">{importMode === 'merge'
              ? 'Keeps all local documents. Matching IDs are imported as separate copies, including their cover letters. Backup settings, if present, are applied.'
              : 'Deletes ALL local resumes and cover letters, then restores this backup. Backup settings, if present, are applied. This cannot be undone.'}</p>
            <div className="flex flex-wrap gap-2">
              <button disabled={busy} onClick={() => void handleRestore()} className={buttonClass}>{importMode === 'replace' ? 'Replace all and restore' : 'Merge backup'}</button>
              <button disabled={busy} onClick={() => { setPendingBackup(null); setError(null); }} className={buttonClass}>Cancel import</button>
            </div>
          </section>}
          {loading ? <p className="py-8 text-center text-gray-500">Loading...</p> : resumes.map(record => (
            <div key={record.id} className={`rounded-xl border p-4 ${dm ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'} ${record.id === activeResumeId ? 'ring-1 ring-indigo-500' : ''}`}>
              <div className="flex flex-wrap items-center gap-3">
                <FileText className="h-5 w-5 shrink-0 text-indigo-500" />
                <div className="flex-1 min-w-0 break-words">
                  <div className="font-semibold text-sm">{record.name}{record.id === activeResumeId && <span className="ml-2 text-xs text-indigo-500">Active</span>}</div>
                  {record.targetJob && <div className="text-xs text-gray-500">Target: {record.targetJob}</div>}
                  <div className="flex items-center gap-1 text-xs text-gray-500 mt-1"><Clock className="h-3 w-3" />{new Date(record.updatedAt).toLocaleDateString()}</div>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {record.id !== activeResumeId && <button disabled={disabled || !!pendingBackup || !!editing} onClick={() => void handleSwitch(record.id)} aria-label={`Open ${record.name}`} className={buttonClass}>Open</button>}
                  <button disabled={disabled || !!pendingBackup || !!editing} onClick={() => { setEditing({ id: record.id, name: record.name, targetJob: record.targetJob || '' }); setError(null); }} aria-label={`Edit details for ${record.name}`} className={buttonClass}><Pencil className="h-4 w-4" /></button>
                  <button disabled={disabled || !!pendingBackup || !!editing} onClick={() => void handleDuplicate(record.id)} aria-label={`Duplicate ${record.name}`} className={buttonClass}><Copy className="h-4 w-4" /></button>
                  <button disabled={disabled || !!pendingBackup || !!editing || resumes.length === 1} onClick={() => {
                    if (window.confirm(`Delete "${record.name}"? This cannot be undone.`)) void run(async () => { await deleteEditorResume(record.id); await refreshList(); });
                  }} aria-label={`Delete ${record.name}`} className={buttonClass}><Trash2 className="h-4 w-4 text-red-500" /></button>
                </div>
              </div>
              {editing?.id === record.id && <form className="mt-4 space-y-3" onSubmit={event => { event.preventDefault(); void handleMetadataSave(); }}>
                <label className="block text-sm">Document name<input value={editing.name} disabled={busy} onChange={event => setEditing({ ...editing, name: event.target.value })} className={fieldClass} required /></label>
                <label className="block text-sm">Target job<input value={editing.targetJob} disabled={busy} onChange={event => setEditing({ ...editing, targetJob: event.target.value })} className={fieldClass} placeholder="e.g. Frontend engineer at Acme" /></label>
                <p className="text-xs text-gray-500">These labels do not change your personal name or job description.</p>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={busy || !editing.name.trim()} className={buttonClass}>Save details</button>
                  <button type="button" disabled={busy} onClick={() => { setEditing(null); setError(null); }} className={buttonClass}>Cancel edit</button>
                </div>
              </form>}
            </div>
          ))}
        </div>
      </div>
    </Dialog>
  );
};

export default ResumeManager;
