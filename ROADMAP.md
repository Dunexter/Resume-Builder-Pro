# Roadmap

This file describes the current working-tree implementation, not a claim that every change has been released or manually verified across browsers. See [README.md](./README.md) for setup, privacy, backup instructions and format limits.

For the step-by-step status tracker, acceptance checks, and hosting/AdSense blockers, use [CHECKLIST.md](./CHECKLIST.md). Update that checklist as each item is completed and verified.

Upstream PR target: **Dunexter/Resume-Builder-Pro**.
Work branch host: **dextel2/Resume-Builder-Pro**.

## Implemented Scope

| Area | Current implementation |
|------|------------------------|
| Local workspace | IndexedDB resumes, settings and cover letters; blank/sample start; document names and target-job labels; duplicate/open/delete |
| Persistence | Serialized editor saves, explicit Save/retry status, flush before document actions, synchronous transactional record updates |
| Backup | Validated workspace JSON; API key omitted by default; atomic merge/replace; merge remaps colliding IDs rather than overwriting local documents |
| Versions | Up to 20 local snapshots; compare, rename, delete, restore; safety snapshot and restore in one transaction; stale editor checks |
| Import | TXT, DOCX and text PDF extraction; editable review before applying; local parsing and optional explicit AI parsing |
| Resume output | Five templates, section visibility/order, shared entry details, A4 preview and print CSS; ATS/Visual PDF, DOCX, TXT, Markdown and LaTeX source |
| Writing tools | Heuristic ATS checks and JD matching, bullet coaching, optional OpenAI/Gemini assistance with error reporting and review |
| Cover letters | Resume-linked saved drafts, local templates, optional AI, TXT/DOCX/PDF export |
| Usability | Undo/redo, dark mode, responsive navigation, labelled controls and shared dialog focus handling |
| Engineering | TypeScript check in build; required CI lint/test/build; utility, component and IndexedDB regression tests |

## Limits And Follow-ups

| Area | Remaining work or explicit limit |
|------|---------------------------------|
| Data durability | No cloud sync or server recovery. Save indicators and snapshots are not external backups; download Export All regularly. Multi-tab live conflict resolution is not implemented. |
| Import fidelity | Parsing is best-effort. Review multi-column PDFs, DOCX tables/text boxes and field assignments. No OCR or legacy `.doc` support. Limits: 10 MiB documents, 100,000 characters, 30 PDF pages; AI parsing 24,000 characters. |
| Unicode PDF | ATS PDF uses Helvetica/WinAnsi and rejects unsupported characters. Full Unicode font embedding/shaping remains future work. DOCX preserves selectable Unicode text; Visual PDF is an image. |
| Pagination | Multi-page export exists; broader real-browser testing of long entries, page breaks, fonts and printer settings remains necessary. |
| Validation and forms | Schema validation and field checks exist, but a single consistent form framework and comprehensive UX/accessibility audit remain follow-ups. |
| Accessibility | Shared dialog and keyboard tests exist; full screen-reader, zoom, mobile and cross-browser validation is not claimed. |
| AI and privacy | OpenAI/Gemini only; no local model provider. Requests disclose task data to providers. Keys and backups are not encrypted. Vercel Analytics and job-search services may make network requests. |
| ATS claims | Scores are local heuristics, not validation against every employer's ATS and not hiring predictions. |
| Job workflows | Job-search links, remote listings and document target labels exist; no application tracker or automatic application submission. |
| Onboarding | Blank/sample selection exists; a guided onboarding tour remains future work. |
| Runtime and tooling | Node.js >=22.13 is required. Continue dependency/security review and browser integration testing; passing unit tests is not a security or production certification. |

New work should have explicit acceptance criteria and regression tests. Avoid treating a partial implementation as a completed broader milestone.
