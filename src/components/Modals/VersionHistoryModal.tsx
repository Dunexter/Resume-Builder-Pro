import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Camera, RotateCcw, Trash2, Pencil, GitCompare } from 'lucide-react';
import { useAppSelector } from '../../hooks';
import { store } from '../../store/store';
import { ResumeState, ResumeVersion } from '../../types/resume';
import { flushEditor, openEditorRecord } from '../../utils/editorPersistence';
import {
  createSnapshot,
  listVersions,
  deleteVersion,
  renameVersion,
  restoreVersion,
  diffResumeData,
  MAX_VERSIONS,
} from '../../utils/versionUtils';
import Dialog from './Dialog';

interface Props {
  onClose: () => void;
}

const VersionHistoryModal: React.FC<Props> = ({ onClose }) => {
  const activeResumeId = useAppSelector(s => s.resume.activeResumeId);
  const hydrated = useAppSelector(s => s.resume.hydrated);
  const darkMode = useAppSelector(s => s.resume.settings.darkMode);
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const dm = darkMode;
  const disabled = busy || loading || !hydrated;
  const close = () => { if (!busyRef.current) onClose(); };

  const toggleCompare = (id: string) => {
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const diffEntries = useMemo(() => {
    if (compareIds.length !== 2) return null;
    const [firstId, secondId] = compareIds;
    const first = versions.find(v => v.id === firstId);
    const second = versions.find(v => v.id === secondId);
    if (!first || !second) return null;
    return diffResumeData(first.data, second.data);
  }, [compareIds, versions]);

  const formatDiffValue = (val: unknown): string => {
    if (val === undefined) return '(empty)';
    if (typeof val === 'string') return val.trim() === '' ? '(empty)' : val;
    return JSON.stringify(val);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setVersions([]);
    setCompareIds([]);
    setEditingId(null);
    setMsg(null);
    listVersions(activeResumeId).then(list => { if (!cancelled) setVersions(list); })
      .catch(() => { if (!cancelled) setMsg('Could not load version history.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeResumeId]);

  const run = async (operation: (editor: ResumeState, checkEditor: () => void) => Promise<void>) => {
    if (busyRef.current || loading || !hydrated) return;
    busyRef.current = true;
    setBusy(true);
    setMsg(null);
    try {
      await flushEditor();
      const editor = store.getState().resume;
      if (!editor.hydrated || editor.activeResumeId !== activeResumeId) {
        throw new Error('The active resume changed. Please try again.');
      }
      const checkEditor = () => {
        const current = store.getState().resume;
        if (current.activeResumeId !== editor.activeResumeId || current.revision !== editor.revision) {
          throw new Error('The editor changed during this action. Your newer edits were kept; please try again.');
        }
      };
      await operation(editor, checkEditor);
    } catch (e) {
      if (store.getState().resume.activeResumeId === activeResumeId) {
        setMsg(e instanceof Error ? e.message : 'Version action failed. Please try again.');
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const handleSnapshot = () => run(async (editor) => {
    const list = await createSnapshot(editor.activeResumeId, editor.data, label || undefined);
    if (store.getState().resume.activeResumeId !== editor.activeResumeId) return;
    setVersions(list);
    setLabel('');
    setMsg(`Snapshot saved (${list.length}/${MAX_VERSIONS}).`);
  });

  const handleRestore = async (versionId: string) => {
    if (busyRef.current || disabled) return;
    if (!window.confirm('Restore this version? A safety snapshot of the current editor will be saved first. At capacity, the oldest snapshot is removed.')) {
      return;
    }
    await run(async (editor, checkEditor) => {
      const restored = await restoreVersion(editor.activeResumeId, versionId, editor.data, checkEditor);
      try {
        checkEditor();
      } catch (error) {
        // A commit can finish after a new edit. Persist that edit, not the late restore.
        if (store.getState().resume.activeResumeId === editor.activeResumeId) {
          setVersions(restored.versions);
          await flushEditor();
        }
        throw error;
      }
      openEditorRecord(restored);
      setVersions(restored.versions);
      setMsg('Version restored.');
    });
  };

  const handleDelete = async (versionId: string) => {
    if (busyRef.current || disabled) return;
    if (!window.confirm('Delete this snapshot permanently?')) return;
    await run(async (editor) => {
      const list = await deleteVersion(editor.activeResumeId, versionId);
      if (store.getState().resume.activeResumeId !== editor.activeResumeId) return;
      setVersions(list);
      setCompareIds(ids => ids.filter(id => id !== versionId));
      setMsg('Snapshot deleted.');
    });
  };

  const handleRename = (versionId: string) => run(async (editor) => {
    const list = await renameVersion(editor.activeResumeId, versionId, editLabel);
    if (store.getState().resume.activeResumeId !== editor.activeResumeId) return;
    setVersions(list);
    setEditingId(null);
    setMsg('Snapshot renamed.');
  });

  return (
    <Dialog labelledBy="version-history-title" onClose={busy ? undefined : close} className={`w-full max-w-lg max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col ${
        dm ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-200'
      }`}>
        <div className={`flex items-center justify-between p-5 border-b ${dm ? 'border-gray-700' : 'border-gray-200'}`}>
          <div>
            <h2 id="version-history-title" className={`text-lg font-bold ${dm ? 'text-white' : 'text-gray-900'}`}>Version history</h2>
            <p className={`text-sm ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
              Up to {MAX_VERSIONS} snapshots per resume (local only)
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setCompareMode(prev => !prev);
                setCompareIds([]);
              }}
              title="Compare versions"
              aria-pressed={compareMode}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${
                compareMode
                  ? 'bg-indigo-600 text-white'
                  : dm ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              }`}
            >
              <GitCompare className="h-3.5 w-3.5" /> Compare
            </button>
            <button type="button" disabled={busy} aria-label="Close version history" onClick={close} className={`p-2 rounded-xl ${dm ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className={`p-4 border-b space-y-2 ${dm ? 'border-gray-700' : 'border-gray-200'}`}>
          <input
            aria-label="Snapshot label (optional)"
            disabled={disabled}
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Snapshot label (optional)"
            className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${
              dm ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300'
            }`}
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => void handleSnapshot()}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            <Camera className="h-3.5 w-3.5" /> Save snapshot
          </button>
          {msg && <p role="status" className={`text-xs ${dm ? 'text-gray-300' : 'text-gray-600'}`}>{msg}</p>}
        </div>

        {compareMode && (
          <div className={`px-4 py-2 border-b text-xs ${dm ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
            Select two snapshots to compare ({compareIds.length}/2 selected).
          </div>
        )}

        {compareMode && diffEntries && (
          <div className={`p-4 border-b overflow-y-auto max-h-64 space-y-2 ${dm ? 'border-gray-700' : 'border-gray-200'}`}>
            <h3 className={`text-xs font-bold uppercase tracking-wide ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
              {diffEntries.length === 0 ? 'No differences found' : `${diffEntries.length} field${diffEntries.length === 1 ? '' : 's'} changed`}
            </h3>
            {diffEntries.map((d, i) => (
              <div key={i} className={`rounded-lg p-2 text-xs ${dm ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <div className={`font-mono mb-1 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{d.path}</div>
                <div className="text-red-500 line-through break-words">{formatDiffValue(d.before)}</div>
                <div className="text-green-500 break-words">{formatDiffValue(d.after)}</div>
              </div>
            ))}
          </div>
        )}

        <div className="p-4 overflow-y-auto flex-1 space-y-2">
          {loading ? (
            <p className="text-center text-gray-400 text-sm py-8">Loading…</p>
          ) : versions.length === 0 ? (
            <p className={`text-center text-sm py-8 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
              No snapshots yet. Save one before big edits or AI rewrites.
            </p>
          ) : (
            versions.map(v => (
              <div
                key={v.id}
                className={`rounded-xl border p-3 ${dm ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}
              >
                {compareMode && (
                  <label className="flex items-center gap-2 mb-2 text-xs cursor-pointer">
                    <input
                      aria-label={`Compare ${v.label}`}
                      type="checkbox"
                      checked={compareIds.includes(v.id)}
                      onChange={() => toggleCompare(v.id)}
                    />
                    <span className={dm ? 'text-gray-400' : 'text-gray-500'}>Select for comparison</span>
                  </label>
                )}
                {editingId === v.id ? (
                  <div className="flex gap-2 mb-2">
                    <input
                      aria-label="Rename snapshot"
                      disabled={disabled}
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      className={`flex-1 px-2 py-1 rounded border text-sm ${
                        dm ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-300'
                      }`}
                    />
                    <button type="button" disabled={disabled} onClick={() => void handleRename(v.id)} className="text-xs text-indigo-500 font-medium">
                      Save
                    </button>
                    <button type="button" disabled={busy} onClick={() => setEditingId(null)} className="text-xs text-gray-500">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className={`font-medium text-sm ${dm ? 'text-white' : 'text-gray-900'}`}>{v.label}</div>
                )}
                <div className={`text-xs mt-0.5 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                  {new Date(v.createdAt).toLocaleString()}
                </div>
                <div className="flex gap-1 mt-2">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void handleRestore(v.id)}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    <RotateCcw className="h-3 w-3" /> Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(v.id);
                      setEditLabel(v.label);
                    }}
                    className={`p-1.5 rounded-lg ${dm ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-500'}`}
                    title="Rename"
                    aria-label={`Rename ${v.label}`}
                    disabled={disabled}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(v.id)}
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-50"
                    title="Delete"
                    aria-label={`Delete ${v.label}`}
                    disabled={disabled}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
    </Dialog>
  );
};

export default VersionHistoryModal;
