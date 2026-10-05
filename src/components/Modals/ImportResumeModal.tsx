import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useAppSelector } from '../../hooks';
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility';
import { ResumeData } from '../../types/resume';
import { extractResumeFile, MAX_IMPORT_TEXT_LENGTH } from '../../utils/resumeFileParser';
import { buildResumeDataFromParsed, importResumeFromText, ImportResumeResult, MAX_AI_IMPORT_TEXT_LENGTH } from '../../utils/resumeImport';

export interface ImportResumeModalProps {
  onClose: () => void;
  /** Caller must create a new resume safely; never replace the active resume in place. */
  onImport: (data: ResumeData, name: string) => Promise<void>;
}

const contactFields = ['name', 'email', 'phone', 'location', 'linkedin', 'github', 'website', 'summary'];
const sectionFields = {
  experience: ['company', 'position', 'location', 'startDate', 'endDate', 'current', 'achievements', 'technologies'],
  education: ['institution', 'degree', 'field', 'startDate', 'endDate', 'gpa', 'coursework', 'honors'],
  skills: ['category', 'skills'],
  projects: ['title', 'year', 'description', 'technologies', 'url'],
  certifications: ['name', 'issuer', 'date', 'expiryDate', 'credentialId'],
  awards: ['title', 'issuer', 'date', 'description'],
};
const fieldLabels: Record<string, string> = {
  name: 'Name', email: 'Email', phone: 'Phone', location: 'Location', linkedin: 'LinkedIn', github: 'GitHub', website: 'Website', summary: 'Summary',
  company: 'Company', position: 'Job title', startDate: 'Start date', endDate: 'End date', current: 'Currently work here', achievements: 'Achievements (one per line)', technologies: 'Technologies',
  institution: 'Institution', degree: 'Degree', field: 'Field of study', gpa: 'GPA', coursework: 'Coursework', honors: 'Honors', category: 'Category', skills: 'Skills',
  title: 'Title', year: 'Year', description: 'Description', url: 'Project URL', issuer: 'Issuer', date: 'Date', expiryDate: 'Expiry date', credentialId: 'Credential ID', content: 'Notes',
  experience: 'Experience', education: 'Education', projects: 'Projects', certifications: 'Certifications', awards: 'Awards',
};

export default function ImportResumeModal({ onClose, onImport }: ImportResumeModalProps) {
  const aiSettings = useAppSelector(state => state.resume.settings.ai);
  const [name, setName] = useState('Imported resume');
  const [source, setSource] = useState('Pasted text');
  const [extracted, setExtracted] = useState('');
  const [text, setText] = useState('');
  const [useAI, setUseAI] = useState(false);
  const [extractionWarnings, setExtractionWarnings] = useState<string[]>([]);
  const [result, setResult] = useState<ImportResumeResult | null>(null);
  const [candidate, setCandidate] = useState<Pick<ResumeData, 'personalInfo' | 'sections'> | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const dialog = useDialogAccessibility(() => { if (!inFlight.current) onClose(); });
  const canUseAI = ['openai', 'gemini'].includes(aiSettings.provider) && !!aiSettings.apiKey;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const invalidate = () => { setResult(null); setCandidate(null); setReviewed(false); setError(''); };
  const editCandidate = (data: Pick<ResumeData, 'personalInfo' | 'sections'>) => { setCandidate(data); setReviewed(false); setError(''); };
  const run = async (label: string, action: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(label);
    setError('');
    try { await action(); }
    catch (err) { if (mounted.current) setError(err instanceof Error ? err.message : 'Import failed. Your current resume has not been changed.'); }
    finally { inFlight.current = false; if (mounted.current) setBusy(''); }
  };

  const readFile = (file: File) => {
    invalidate();
    setText(''); setExtracted(''); setExtractionWarnings([]); setUseAI(false);
    setSource(file.name);
    setName(file.name.replace(/\.[^.]+$/, '').slice(0, 100) || 'Imported resume');
    void run('Extracting text...', async () => {
      const output = await extractResumeFile(file);
      if (!mounted.current) return;
      setText(output.text); setExtracted(output.text); setExtractionWarnings(output.warnings);
    });
  };

  const parse = () => {
    invalidate();
    void run('Parsing text...', async () => {
      const output = await importResumeFromText(text, aiSettings, { useAI: useAI && canUseAI });
      if (!mounted.current) return;
      setResult(output);
      setCandidate({ personalInfo: output.data.personalInfo, sections: output.data.sections });
    });
  };

  const submit = () => void run('Creating new resume...', async () => {
    if (!result || !candidate || !reviewed || !name.trim()) throw new Error('Review the parsed candidate and enter a resume name first.');
    if (JSON.stringify(candidate).length > MAX_IMPORT_TEXT_LENGTH * 3) throw new Error('Structured candidate is too large.');
    const data = buildResumeDataFromParsed(candidate);
    await onImport(data, name.trim());
    if (mounted.current) onClose();
  });

  const inputCls = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2 text-sm disabled:opacity-60 focus:ring-2 focus:ring-indigo-500';
  const buttonCls = 'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50';
  const renderFields = (entry: object, fields: string[], update: (field: string, value: string | boolean | string[]) => void) => (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      {fields.map(field => {
        const value = (entry as Record<string, unknown>)[field];
        const multiline = ['summary', 'achievements', 'description', 'content', 'coursework'].includes(field);
        return <label key={field} className={`block min-w-0 text-sm font-medium ${multiline ? 'sm:col-span-2' : ''}`}>
          {field === 'current' ? <span className="flex items-center gap-2"><input type="checkbox" checked={!!value} disabled={!!busy} onChange={e => update(field, e.target.checked)} />{fieldLabels[field]}</span> : <>
            {fieldLabels[field]}
            {multiline ? <textarea className={`${inputCls} mt-1`} rows={3} value={Array.isArray(value) ? value.join('\n') : String(value ?? '')} disabled={!!busy}
              onChange={e => update(field, field === 'achievements' ? e.target.value.split('\n') : e.target.value)} /> :
              <input className={`${inputCls} mt-1`} value={String(value ?? '')} disabled={!!busy} onChange={e => update(field, e.target.value)} />}
          </>}
        </label>;
      })}
    </div>
  );
  const warnings = [...extractionWarnings, ...(result?.warnings || [])];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4">
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="resume-import-title" aria-busy={!!busy}
        className="max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-4 text-gray-900 shadow-2xl dark:bg-gray-900 dark:text-gray-100 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id="resume-import-title" className="text-xl font-bold">Import a new resume</h2>
          <button type="button" onClick={onClose} disabled={!!busy} aria-label="Close import" className="rounded p-1 disabled:opacity-50"><X /></button>
        </div>
        <p className="my-3 text-sm">Your current resume will not be overwritten. Extraction and local parsing stay in this browser. Parsing can miss or misplace content; review the source and every field before creating a resume.</p>
        <div className="space-y-4">
          <label className="block text-sm font-medium">New resume name
            <input className={inputCls} value={name} maxLength={100} disabled={!!busy} onChange={e => setName(e.target.value)} />
          </label>
          <label className="block text-sm font-medium">Choose PDF, DOCX, or TXT (up to 10MB, PDF up to 30 pages)
            <input className={`${inputCls} mt-1`} type="file" accept=".pdf,.docx,.txt" disabled={!!busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) readFile(file); }} />
          </label>
          <p className="text-xs">Legacy DOC: save as DOCX or TXT first. Scanned PDFs need local OCR; encrypted files must be unlocked locally. Images are not imported.</p>
          <p className="break-all text-sm"><strong>Source:</strong> {source}</p>
          {extracted && <details><summary className="cursor-pointer text-sm font-medium">Original extracted text (read-only)</summary><pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded border p-3 text-xs">{extracted}</pre></details>}
          <label className="block text-sm font-medium">Paste or correct extracted text before parsing
            <textarea className={`${inputCls} mt-1 font-mono`} rows={9} value={text} disabled={!!busy} onChange={e => { setText(e.target.value); invalidate(); }} />
          </label>
          <p className="text-xs">{text.length.toLocaleString()} / {MAX_IMPORT_TEXT_LENGTH.toLocaleString()} characters for local parsing. Text is never silently truncated.</p>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={useAI} disabled={!!busy || !canUseAI} onChange={e => { setUseAI(e.target.checked); invalidate(); }} />
            <span>Use AI for this import only. Send the complete corrected text, including personal information, directly to {canUseAI ? aiSettings.provider : 'my configured provider'}. Provider privacy policies apply. AI may omit or invent details; verify its output. Limit: {MAX_AI_IMPORT_TEXT_LENGTH.toLocaleString()} characters.{!canUseAI && ' Configure an AI provider and key in Settings to enable this option.'}</span>
          </label>
          <button type="button" className={buttonCls} disabled={!!busy || !text.trim() || text.length > MAX_IMPORT_TEXT_LENGTH || (useAI && text.length > MAX_AI_IMPORT_TEXT_LENGTH)} onClick={parse}>{result ? 'Reparse corrected text' : 'Parse and review'}</button>
          {useAI && text.length > MAX_AI_IMPORT_TEXT_LENGTH && <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">Text exceeds the AI limit. Shorten it yourself or turn off AI to parse locally.</p>}
          {warnings.length > 0 && <section aria-label="Import warnings" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <h3 className="font-semibold">Import warnings</h3>
            <ul className="mt-2 list-disc space-y-1 pl-4">{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
          </section>}
          {result && candidate && <>
            <p className="text-sm font-medium">Candidate parsed {result.usedAI ? 'with AI assistance' : 'locally'}. Review and edit below.</p>
            <section aria-label="Detected sections" className="rounded-lg border p-3 text-sm">
              <h3 className="font-semibold">Detected sections</h3>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {(Object.keys(sectionFields) as (keyof typeof sectionFields)[]).map(section => <li key={section}>{fieldLabels[section]}: {candidate.sections[section].length} {candidate.sections[section].length === 1 ? 'entry' : 'entries'}</li>)}
                {candidate.sections.custom.map(section => <li key={section.id}>{section.name}: {section.entries.length} {section.entries.length === 1 ? 'entry' : 'entries'} (hidden from resume)</li>)}
              </ul>
            </section>
            {result.unmappedText && <details open><summary className="text-sm font-medium">Unmapped or uncertain source lines</summary><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words p-2 text-xs">{result.unmappedText}</pre></details>}
            <p className="text-xs">Edit fields below, or correct the source text and reparse to add missing entries. Reparsing replaces these edits. Dates use YYYY-MM (for example, 2024-06), or leave them blank if unknown. Import notes are retained but hidden from the resume by default.</p>
            <fieldset className="min-w-0 rounded-lg border p-3">
              <legend className="px-1 font-semibold">Contact and summary</legend>
              {renderFields(candidate.personalInfo, contactFields, (field, value) => editCandidate({ ...candidate, personalInfo: { ...candidate.personalInfo, [field]: value } }))}
            </fieldset>
            {(Object.keys(sectionFields) as (keyof typeof sectionFields)[]).map(section => candidate.sections[section].map((entry, index) => (
              <fieldset key={entry.id} className="min-w-0 rounded-lg border p-3">
                <legend className="px-1 font-semibold">{fieldLabels[section]} {index + 1}</legend>
                {renderFields(entry, sectionFields[section], (field, value) => editCandidate({ ...candidate, sections: { ...candidate.sections,
                  [section]: candidate.sections[section].map((item, i) => i === index ? { ...item, [field]: value } : item),
                } }))}
              </fieldset>
            )))}
            {candidate.sections.custom.map((section, index) => (
              <fieldset key={section.id} className="min-w-0 space-y-3 rounded-lg border p-3">
                <legend className="px-1 font-semibold">{section.name} (hidden from resume)</legend>
                {section.entries.map((entry, entryIndex) => <fieldset key={entry.id} className="min-w-0">
                  <legend className="mb-2 text-sm font-medium">Note {entryIndex + 1}</legend>
                  {renderFields(entry, ['title', 'content'], (field, value) => editCandidate({ ...candidate, sections: { ...candidate.sections,
                    custom: candidate.sections.custom.map((item, i) => i === index ? { ...item, entries: item.entries.map((note, j) => j === entryIndex ? { ...note, [field]: value } : note) } : item),
                  } }))}
                </fieldset>)}
              </fieldset>
            ))}
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={reviewed} disabled={!!busy} onChange={e => setReviewed(e.target.checked)} /><span>I reviewed the candidate against the source, including dates and unmapped text.</span></label>
          </>}
          {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{error}</p>}
          <p role="status" className="text-sm">{busy}</p>
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={onClose} disabled={!!busy}>Cancel</button>
            <button type="button" className={buttonCls} onClick={submit} disabled={!!busy || !result || !reviewed || !name.trim()}>Create new resume</button>
          </div>
        </div>
      </div>
    </div>
  );
}
