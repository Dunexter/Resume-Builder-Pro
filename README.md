# ResumeBuilder Pro

**Free · Local-first · No account · No paywall**

A browser-based resume builder with local IndexedDB storage, multiple documents, import review, exports, and optional AI using your own API key. Local writing checks need no API key. ATS and job-match scores are heuristics, not guarantees of acceptance or hiring outcomes. Some optional tools and deployment analytics make network requests; see Privacy below.

> Upstream: [Dunexter/Resume-Builder-Pro](https://github.com/Dunexter/Resume-Builder-Pro)  
> Fork (contributions): [dextel2/Resume-Builder-Pro](https://github.com/dextel2/Resume-Builder-Pro)

---

## Features

| Area | What you get |
|------|----------------|
| **Editor** | Personal info, experience (multi-bullet), education, skills, projects, awards, certifications, custom sections |
| **Layout** | Drag-to-reorder sections, show/hide sections, live A4 preview |
| **Templates** | Professional, Modern, Classic, Compact, Executive + fonts, spacing, colors |
| **Multi-resume** | Create, open, duplicate, rename and delete documents; target-job labels and per-resume job descriptions |
| **Import** | Local TXT, DOCX and text-based PDF extraction; review/edit extracted text and parsed data before applying; optional AI parsing |
| **ATS tools** | Compatibility and content checks, inline bullet coach, heuristic JD keyword/synonym matching |
| **AI (optional)** | OpenAI or Gemini with your key for writing assistance, review and import; review suggestions before applying |
| **Cover letter** | Resume-linked saved drafts, local templates, optional AI, TXT/DOCX/PDF downloads |
| **Export** | Multi-page text-based ATS PDF, image-based Visual PDF, Word (`.docx`), TXT, Markdown and LaTeX source; browser print |
| **History** | Undo/redo plus up to 20 named local snapshots per resume; compare, rename, delete and restore |
| **Backup** | Full workspace JSON export/import including resumes, snapshots, cover letters and settings; API key excluded by default |
| **Job search** | External job-search links and remote-job search; optional AI chat, not automatic applications |
| **UX** | Blank/sample/import start, completion checklist, dark mode, mobile navigation, save/unsaved/error indicators and explicit Save |

### Save and protect your work

- Autosave is enabled by default. Use **Save** and wait for the saved indicator, especially before leaving the page. If saving fails, retry before closing; an in-memory edit is not a durable save.
- Document downloads remain available even when saving fails, so you can recover in-memory content. Use DOCX or TXT as an emergency copy; neither preserves the complete workspace like a JSON backup.
- Use **My Resumes > Export All** regularly and keep the downloaded JSON somewhere safe. PDF/DOCX exports are not full workspace backups. Backups are limited to 25 MiB.
- **Import backup > Merge** keeps local records and gives colliding incoming records new IDs. **Replace** removes local resumes and cover letters in one transaction. Backup settings, if present, are applied. Export a backup before replacing anything.
- Snapshots save resume content/layout, not a separate copy of settings, cover letters or the job description. Saving a snapshot does not replace active resume content. Restoring saves a **Before restore** snapshot and restores content in the same transaction, including when selecting the oldest snapshot at capacity. Adding a snapshot beyond 20 removes the oldest one.
- IndexedDB and snapshots live in the same browser profile and origin. Clearing site data, private browsing cleanup, browser eviction or device loss can remove them. There is no cloud sync or server-side recovery. Use one editor tab at a time: atomic DB writes are not live multi-tab collaboration or conflict resolution.

### Import and export limits

- Document import accepts TXT, DOCX and PDFs with readable text, up to 10 MiB, 100,000 extracted characters and 30 PDF pages. AI import is limited to 24,000 characters; oversized input is rejected rather than silently truncated.
- **No OCR and no legacy `.doc` support.** Convert `.doc` to DOCX/TXT locally. For scanned PDFs, run OCR elsewhere and review the recovered text. Encrypted/corrupt documents may need to be unlocked or converted locally first.
- Extraction and parsing are best-effort, not layout-preserving conversion. Images are not imported. Review columns, tables, text boxes, dates, links and section assignments before applying; verify every AI suggestion against your real experience.
- ATS PDF uses a built-in Helvetica/WinAnsi font, not a full Unicode font. Unsupported characters (including many non-Latin scripts and emoji) cause an explicit export error. Use DOCX for selectable Unicode text, or Visual PDF for appearance. Visual PDF is rasterized, not selectable/searchable text, and is generally less suitable for ATS ingestion.
- Preview, browser print and exported pagination can differ. Inspect the downloaded file, especially long entries and page breaks. LaTeX export downloads source, not a compiled PDF.

---

## Quick start

**Requirements:** Node.js **>=22.13** and npm. Use the committed npm lockfile for reproducible installs. A modern browser with IndexedDB and Web Workers is required.

```bash
git clone https://github.com/dextel2/Resume-Builder-Pro.git
cd Resume-Builder-Pro
npm ci
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

```bash
npm run typecheck # TypeScript application checks (no emitted files)
npm test         # Vitest regression tests
npm run build    # typecheck, then production build to dist/
npm run preview  # preview production build
npm run lint     # ESLint
```

---

CI requires lint, tests and build to succeed; build includes typechecking. Local development does not need AI credentials.

## Privacy & AI keys

- **No account.** Resumes, settings, and cover letters are stored in the browser via **IndexedDB** (`resume-builder-pro`).
- **AI is optional.** Set provider to None for local rule-based suggestions. The app has no resume-storage backend. It is not an installable offline/PWA guarantee; initial loading and network features require connectivity.
- AI requests send the selected task's content (which may include resume text, job descriptions, import text or chat) and credentials directly from your browser to OpenAI or Gemini. The provider's data policies and charges apply. Testing a key also contacts that provider. AI failure is reported; local suggestions are not a claim that an AI request succeeded.
- API keys are stored in local browser settings, not an encrypted vault. Anyone or any script with access to this browser origin may be able to read them. Do not use a shared browser profile for sensitive data.
- Workspace backups exclude the API key unless **Include AI API key in export** is selected. They still contain personal resume and cover-letter data and are not encrypted. Keep them private. Importing a redacted backup can retain the existing key for the same provider.
- The app mounts **Vercel Analytics**, which may send deployment usage/page-view telemetry. Remote-job search and external job links contact third-party services and send search terms. This is local-first storage, not a promise of zero network traffic or tracking.

**Get a key (optional):**

- [OpenAI API keys](https://platform.openai.com/api-keys)
- [Google AI Studio (Gemini)](https://aistudio.google.com/app/apikey)

---

## Tech stack

- **React 18** + **TypeScript** + **Vite**
- **Redux Toolkit** + React Redux
- **Tailwind CSS**
- **idb** (IndexedDB)
- **html2canvas** + **jsPDF** (PDF export)
- **docx** (Word export)
- **mammoth** + **pdfjs-dist** (local document text extraction)
- **Vitest** + **fake-indexeddb** + **jsdom** (tests)
- **lucide-react** (icons)

---

## Project structure (high level)

```
src/
  components/
    Forms/          # Section editors, ATS, JD matcher, AI settings
    Layout/         # Header, Sidebar
    Modals/         # Import review, versions, resume manager, cover letter
    Preview/        # Live resume templates
  db/               # IndexedDB helpers
  store/            # Redux slice + store
  types/            # Resume domain types
  utils/            # Persistence, schemas, import/export, backup, ATS/JD helpers
  hooks/            # Auto-save, typed Redux hooks
```

---

## Contributing

1. Fork the upstream repo (or use this fork).
2. Create a branch: `git checkout -b feat/your-change`
3. Commit with a clear message.
4. Open a **pull request against [Dunexter/Resume-Builder-Pro](https://github.com/Dunexter/Resume-Builder-Pro)**.

Run `npm run lint`, `npm test`, and `npm run build` before submitting. See [ROADMAP.md](./ROADMAP.md) for implemented scope and [CHECKLIST.md](./CHECKLIST.md) for the step-by-step tracker covering fixes, new features, secure administration, and AdSense readiness. Automated tests do not replace browser checks of downloads, printing, keyboard access and mobile layouts.

---

## License

[MIT](./LICENSE)
