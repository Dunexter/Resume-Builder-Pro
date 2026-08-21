import React, { useEffect, useMemo, useState } from 'react';
import { X, Camera, RotateCcw, Trash2, Pencil, GitCompare } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../hooks';
import { loadResumeData, setLastSaved } from '../../store/resumeSlice';
import { ResumeVersion } from '../../types/resume';
import {
  createSnapshot,
  listVersions,
  deleteVersion,
  renameVersion,
  getVersionData,
  diffResumeData,
  MAX_VERSIONS,
} from '../../utils/versionUtils';
import { loadResume, saveResume } from '../../db/resumeDB';

interface Props {
  onClose: () => void;
}

const VersionHistoryModal: React.FC<Props> = ({ onClose }) => {
  const dispatch = useAppDispatch();
  const activeResumeId = useAppSelector(s => s.resume.activeResumeId);
  const data = useAppSelector(s => s.resume.data);
  const darkMode = useAppSelector(s => s.resume.settings.darkMode);
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const dm = darkMode;

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

  const refresh = async () => {
    const list = await listVersions(activeResumeId);
    setVersions(list);
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [activeResumeId]);

  const handleSnapshot = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const list = await createSnapshot(activeResumeId, data, label || undefined);
      setVersions(list);
      setLabel('');
      setMsg(`Snapshot saved (${list.length}/${MAX_VERSIONS}).`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not save snapshot.');
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async (versionId: string) => {
    if (!window.confirm('Restore this version? Current editor content will be replaced (save a snapshot first if needed).')) {
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      // Auto-snapshot current before restore
      await createSnapshot(activeResumeId, data, 'Before restore');
      const restored = await getVersionData(activeResumeId, versionId);
      if (!restored) throw new Error('Version not found');
      dispatch(loadResumeData(restored));
      const record = await loadResume(activeResumeId);
      if (record) {
        const now = new Date().toISOString();
        await saveResume({
          ...record,
          data: restored,
          updatedAt: now,
        });
        dispatch(setLastSaved(now));
      }
      await refresh();
      setMsg('Version restored.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Restore failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (versionId: string) => {
    if (!window.confirm('Delete this snapshot permanently?')) return;
    setBusy(true);
    try {
      setVersions(await deleteVersion(activeResumeId, versionId));
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (versionId: string) => {
    setBusy(true);
    try {
      setVersions(await renameVersion(activeResumeId, versionId, editLabel));
      setEditingId(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 w-full max-w-lg max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col ${
        dm ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-200'
      }`}>
        <div className={`flex items-center justify-between p-5 border-b ${dm ? 'border-gray-700' : 'border-gray-200'}`}>
          <div>
            <h2 className={`text-lg font-bold ${dm ? 'text-white' : 'text-gray-900'}`}>Version history</h2>
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
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${
                compareMode
                  ? 'bg-indigo-600 text-white'
                  : dm ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              }`}
            >
              <GitCompare className="h-3.5 w-3.5" /> Compare
            </button>
            <button type="button" onClick={onClose} className={`p-2 rounded-xl ${dm ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className={`p-4 border-b space-y-2 ${dm ? 'border-gray-700' : 'border-gray-200'}`}>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Snapshot label (optional)"
            className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${
              dm ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300'
            }`}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSnapshot()}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            <Camera className="h-3.5 w-3.5" /> Save snapshot
          </button>
          {msg && <p className={`text-xs ${dm ? 'text-gray-300' : 'text-gray-600'}`}>{msg}</p>}
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
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      className={`flex-1 px-2 py-1 rounded border text-sm ${
                        dm ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-300'
                      }`}
                    />
                    <button type="button" onClick={() => void handleRename(v.id)} className="text-xs text-indigo-500 font-medium">
                      Save
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="text-xs text-gray-500">
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
                    disabled={busy}
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
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(v.id)}
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-50"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default VersionHistoryModal;
