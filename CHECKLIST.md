# Implementation Checklist

This is the working checklist for fixes, product improvements, the public website, secure administration, and advertising. Update it as each item is implemented and verified. [ROADMAP.md](./ROADMAP.md) summarizes the product; this file tracks execution.

## Status Rules

- `[x] DONE`: implemented and verified to the stated scope; not necessarily deployed.
- `[ ] PENDING`: not started or not yet verified.
- `[ ] IN PROGRESS`: actively being implemented. Keep one primary item active.
- `[ ] BLOCKED`: requires an external decision, account, credentials, or approval; record the dependency.
- Complete an item only after its acceptance checks pass. Record verification in the completion log.
- Automated tests do not replace real-browser checks, a security review, or AdSense approval.

## Current Position

- Current work: checklist prepared; no new feature implementation started in this step.
- Next item: **F01 - Safe color editing and compatible loading**.
- Confirmed decision: public advertising site separate from the ad-free editor.
- Current hosting: Vercel Hobby; no backend configured.
- Proposed backend: Supabase Auth and Postgres for administration only. Not provisioned or finally approved.
- Advertising: disabled/not integrated. No approval or production readiness claimed.
- Hosting blocker: Vercel explicitly classifies AdSense as commercial use, which is not permitted on Hobby. Confirm an appropriate hosting plan before commercial deployment.
- Preserve the existing editor origin where possible. Changing origins does not migrate browser-stored resumes.

## Phase 0 - Existing Baseline

These checkmarks cover the implemented baseline only. Remaining defects are tracked separately below.

- [x] B01 - Local multi-resume workspace, document labels, duplication, and deletion.
- [x] B02 - Initialization-gated autosave, save/error indicators, and undo isolation when opening documents.
- [x] B03 - Workspace backup validation, atomic restore, and collision-preserving merge.
- [x] B04 - Snapshot history with atomic restore and oldest-at-capacity protection.
- [x] B05 - PDF/DOCX/TXT import and pasted text with editable review before creating a new resume.
- [x] B06 - Explicit per-import AI opt-in and basic import size/page limits.
- [x] B07 - Optional field coverage across five templates and the existing export formats.
- [x] B08 - AI summary/bullet preview and acceptance, provider-error handling, and source-change checks.
- [x] B09 - Saved cover-letter drafts and TXT/DOCX/PDF downloads.
- [x] B10 - Mobile tool access, shared dialog accessibility, completion checklist, and fit-to-width preview.
- [x] B11 - Restore achievement bullet markers across all templates and visual PDF rendering; recognize additional uploaded bullet symbols.
- [x] B12 - Type checking in the build and required CI lint/test/build checks.

Baseline verification from the preceding implementation session: **443 tests passed across 37 files; lint and typechecked production build passed.** Build still reports large chunks. This is historical evidence, not a claim that tests were rerun when creating this checklist.

## Phase 1 - Protect Work and Secure Input

- [ ] F01 - Safe color editing and compatible loading. Keep incomplete text out of durable resume state, normalize supported older colors, show inline errors/reset, and test that typing `#fff` cannot block saving or startup.
- [ ] F02 - Damaged-record recovery. One invalid resume or snapshot must not block healthy records; provide non-destructive raw backup/recovery and visible legacy-migration failures.
- [ ] F03 - Cover-letter replacement protection. Generate into a separate suggestion, require explicit acceptance, and preserve the previous draft for recovery.
- [ ] F04 - Cover-letter unload protection. Warn when reloading/leaving with pending or failed letter saves; verify delayed writes and storage failures.
- [ ] F05 - Post-restore reconciliation. Once a restore commits, prevent stale editor/settings writes until the restored workspace reloads successfully; test failures after commit.
- [ ] F06 - Write-independent recovery tools. Open management/history and export persisted backups without requiring a successful save; allow safe cleanup under quota failures.
- [ ] F07 - DOCX resource enforcement. Reject mismatched archive metadata and enforce actual entry/expanded-size limits; test a small compressed file with oversized content.
- [ ] F08 - Safe styling serialization. Restrict font-family values and prevent CSS declarations or external URLs from entering visual exports through backup settings.
- [ ] F09 - Complete data validation. Validate resume-field dates, required section registrations, and XML-invalid control characters; reject or safely normalize invalid data with useful errors.
- [ ] F10 - Clean-save and active-document semantics. Avoid timestamp changes for clean flushes, distinguish settings hydration from edits, and restore the last-opened document reliably.
- [ ] F11 - Consistent workspace limits. Do not permit creates/merges that produce a workspace the backup format cannot export; enforce aggregate limits or provide complete chunked backups.
- [ ] F12 - AI timeouts and cancellation. Abort stalled requests, let users cancel extraction/AI work where supported, and prevent late results from applying after cancellation.

## Phase 2 - Import, Export, and Tool Correctness

- [ ] Q01 - Real-document import fixtures. Round-trip app-generated DOCX/TXT and representative PDFs without swapping company/title or creating false projects/certifications.
- [ ] Q02 - Date and role parsing. Cover numeric dates, graduation-only dates, undated entries, and locations beside date ranges; do not silently invent months.
- [ ] Q03 - Source preservation. Track source-line assignments rather than JSON substring matches; retain complete extracted text for later correction.
- [ ] Q04 - Import repair controls. Add/remove entries and move misclassified content between sections before creating the resume.
- [ ] Q05 - DOCX links and international contacts. Preserve safe hyperlink destinations as text; improve combined international phone/location parsing and bullet-skill cleanup.
- [ ] Q06 - AI import field completeness. Include coursework, certification metadata, and custom sections in the validated extraction schema.
- [ ] Q07 - JD tokenization. Do not form phrases across commas/line breaks; recognize JS, TS, .NET, and C; show an unevaluated state for no usable keywords.
- [ ] Q08 - Skill boundaries and analysis context. Stop substring matches such as Accounts -> TypeScript; include visible custom-section names in analysis.
- [ ] Q09 - Uploaded ATS accuracy. Avoid treating employment dates as phone numbers and deduplicate repeated skills.
- [ ] Q10 - Cover-letter visibility. Use only visible resume content unless users explicitly opt into hidden content, including in AI requests.
- [ ] Q11 - Rewrite request ordering. Older responses must not replace a newer suggestion or a user's local-preview selection.
- [ ] Q12 - Actionable AI errors. Distinguish exhausted quota/billing from temporary rate limiting; verify model selection and availability handling.
- [ ] Q13 - Blank/partial output entries. Filter entirely blank rows and conditionally join optional values; warn about incomplete substantive entries.
- [ ] Q14 - Multiline export fidelity. Preserve intended line breaks in DOCX, Markdown, and LaTeX; test real document structures rather than text presence alone.
- [ ] Q15 - Long-heading and pagination fixes. Wrap ATS PDF headings, protect Classic headings with the next entry, and explain Compact's column-order constraints.
- [ ] Q16 - LaTeX list safety. Preserve bracket-prefixed achievement text and test generated source with a TeX compiler when available.
- [ ] Q17 - Native print isolation. Print only the resume, independently of Edit/Preview selection, zoom, and fixed-height containers.
- [ ] Q18 - Unicode PDF support. Embed appropriately licensed fonts and handle supported scripts/shaping; keep explicit DOCX/visual alternatives until verified.

## Phase 3 - Editor Usability

- [ ] U01 - Entry and bullet ordering. Keyboard/touch-accessible movement for jobs, education, projects, skills, awards, certifications, custom entries, and bullets; retain focus and undo support.
- [ ] U02 - Universal hidden-section notices. Explain hidden state and offer Show without silently undoing intentional exclusions.
- [ ] U03 - Navigation repair. Handle deleted/missing custom sections and Job Finder -> AI Settings from mobile Preview; select newly created sections sensibly.
- [ ] U04 - Drawer and dialog consistency. Focus/isolate the open mobile drawer, restore focus, expose expanded state, and use the shared dialog behavior in Job Finder.
- [ ] U05 - Stable focus and scroll. Remove nested-component remounts in sidebar buttons; reveal/focus destinations and newly added entries.
- [ ] U06 - Actionable validation. Link errors to section/entry/field, add inline accessible messages, clear stale errors, and validate the actual exported subset.
- [ ] U07 - Checklist routing. Offer meaningful experience/project choices and guide users to unfinished existing content.
- [ ] U08 - Responsive layout audit. Verify 320/360/390px phones, narrow desktop split, landscape, virtual keyboard, large text, and 200-400% zoom.
- [ ] U09 - Overflow fixes. Check header errors, export menu bounds, template gallery scrolling, and preview toolbar/help at short heights.
- [ ] U10 - Performance and dependencies. Reduce initial bundle cost where useful; review dependencies, supported Node/browser versions, and security advisories.

## Phase 4 - Hosting and Backend Decisions

- [ ] H01 - BLOCKED: choose Vercel Pro or a verified commercial-use-compatible hosting alternative. Requires owner budget/hosting decision; do not purchase or upgrade automatically.
- [ ] H02 - BLOCKED: confirm domain and current editor URL. Map public/editor/admin origins and preserve existing data access or design a backup/import migration.
- [ ] H03 - BLOCKED: approve and create the Supabase project. Owner provisions the account/project; do not put private credentials in chat, source, or `VITE_*` variables.
- [ ] H04 - Define configuration and access schema. Store ad settings/admin permissions/audit records, not user resumes or AI keys; enable database-enforced authorization.
- [ ] H05 - Configure administrator identity. Invite-only access, MFA, no public admin signup or self-assigned roles; verify rejection of non-admin requests.
- [ ] H06 - Deployment configuration. Document public versus secret variables, preview/production separation, redirects, allowed origins, security headers, and secret rotation.
- [ ] H07 - Operations and cost controls. Account for free-tier pausing, backups, monitoring, rate limits, and spending alerts. Configuration failures must leave ads off.

## Phase 5 - Public Website and Trust

- [ ] W01 - Separate public-site deployment. Keep ad scripts off the editor and admin origins; separate paths alone are not storage isolation.
- [ ] W02 - Public homepage and navigation. Clearly explain the tool and link working guides, examples, templates, editor, and trust pages; verify mobile access.
- [ ] W03 - Original resume guides. Publish useful, reviewed guidance with real editorial value; avoid copied articles and mass-produced filler.
- [ ] W04 - Annotated examples and template pages. Explain choices for students, experienced applicants, and career changers using fictional/consented data, not private uploaded resumes.
- [ ] W05 - BLOCKED: About and Contact details. Owner supplies truthful operator identity and a monitored contact method; no invented company/address claims.
- [ ] W06 - Privacy policy. Describe actual local storage, optional AI transfers, analytics, ad vendors/cookies, user choices, and data handling; obtain appropriate review.
- [ ] W07 - Terms and limitations. Explain ownership, acceptable use, local-data loss risks, AI limitations, and that ATS scores do not guarantee jobs.
- [ ] W08 - Crawlability and metadata. Public content accessible without login, useful titles/canonicals, sitemap/robots, proper errors, HTTPS, and no broken links. Keep private/admin areas protected.
- [ ] W09 - Content ownership and moderation. Verify licenses for templates/images and establish moderation before publishing user submissions/comments.

## Phase 6 - Secure Admin and Ad Controls

- [ ] A01 - Protected admin application. Authenticate and authorize all changes using backend/database enforcement, not a hidden link or client-side password.
- [ ] A02 - Site-wide enable/disable. Ads off by default, bounded configuration caching, emergency disable, and defined behavior for already-loaded ads.
- [ ] A03 - Validated publisher/unit configuration. Accept supported identifiers and placement options, never arbitrary JavaScript, HTML, or script URLs.
- [ ] A04 - Placement controls and exclusions. Only approved public content pages; no ads in editor/admin/resume exports or near controls likely to cause accidental clicks.
- [ ] A05 - Safe layout preview. Use placeholders, not live ads, in development/admin previews; reserve space to avoid layout shifts.
- [ ] A06 - Audit trail and recovery. Record who changed settings and when; protect history and support reverting configuration.
- [ ] A07 - Consent integration. Select an appropriate CMP, enforce required consent behavior, and offer privacy-choice access; admin enablement must not override consent.
- [ ] A08 - Ad loader safeguards. Approved production origins only, load once, no scripts when disabled, sensible no-fill/ad-block behavior, and cancellation of future requests after disablement.
- [ ] A09 - Privacy boundary tests. No resume text, names, emails, AI keys, or private documents in ad requests, URLs, analytics, logs, or public configuration.
- [ ] A10 - Administrator tests. Unauthenticated/non-admin write rejection, invalid configuration rejection, MFA/session behavior, network failure, and unauthorized role changes.

## Phase 7 - AdSense Application and Launch

These are readiness tasks, not a promise of Google approval. An admin switch cannot bypass review or policy enforcement.

- [ ] G01 - BLOCKED: owner eligibility and account setup. Confirm eligible account holder, site control, and actual AdSense account requirements.
- [ ] G02 - Content/UX readiness review. Useful original public content, clear navigation, functioning tool, and no misleading claims or empty ad-focused pages.
- [ ] G03 - Privacy/consent readiness. Required advertising disclosures; Google-certified TCF CMP for personalized ads in the EEA, UK, and Switzerland; assess other applicable laws and regions.
- [ ] G04 - BLOCKED: obtain publisher ID and verify site ownership using the method offered by AdSense. Do not fabricate IDs or approval status.
- [ ] G05 - Publish and verify `ads.txt` with the actual authorized seller entry. Google highly recommends it; it is not a universal mandatory approval condition.
- [ ] G06 - Placement and traffic review. Clearly identified ads, no self-clicks, incentivized clicks, artificial impressions, misleading download buttons, or unsuitable placements.
- [ ] G07 - BLOCKED: submit for review and resolve Google feedback. Only the owner/Google can complete account verification and approval.
- [ ] G08 - Production checks. Approved hosting, isolated origins, admin authorization, consent, disabled state, mobile layout, crawl access, and rollback verified before enabling live serving.
- [ ] G09 - Post-launch monitoring. Review Policy Center, invalid-traffic alerts, consent errors, performance, and costs without logging private resume content.

There is no universal article-count or traffic-number guarantee in the cited eligibility guidance. About/Contact/Terms, a sitemap, and a custom domain are useful trust/operational choices, not automatic approval.

## Phase 8 - Additional Product Features

These are optional product expansion, not prerequisites for AdSense. Prioritize after reliability and launch foundations.

- [ ] P01 - Application tracker: company, role, status, deadlines, notes, and resume version used.
- [ ] P02 - Job-specific workspace: connect JD, resume variant, cover letter, and interview preparation without mixing applications.
- [ ] P03 - Achievement library: save verified accomplishments and reuse them across resumes without inventing claims.
- [ ] P04 - Export preflight: a clear final review of contact details, blank entries, page overflow, unsupported characters, and visibility.
- [ ] P05 - Privacy center: clear local data, remove AI keys, export backups, and explain exactly where each feature sends data.
- [ ] P06 - OCR for scanned resumes: explicit opt-in, resource limits, progress/cancellation, and correction before import.
- [ ] P07 - Evaluate legacy DOC conversion: prefer conversion guidance unless a justified, isolated conversion service is approved.
- [ ] P08 - Evaluate optional cloud sync: separate consent, authentication, retention/deletion, encryption design, and conflict handling; retain local-only mode.

## Completion Log

| Item | Status | Evidence / next dependency |
| --- | --- | --- |
| B01-B12 | DONE to baseline scope | Prior session: 443 tests / 37 files; lint and typechecked build passed. Real-browser and live-provider coverage remains incomplete. |
| Checklist | DONE | Established stable IDs, acceptance checks, phases, blockers, and completion log. |
| F01 | PENDING - next | Safe color editing and compatible loading; no hosting account is required to start. |
| H01-H03 | BLOCKED | Owner hosting/domain/backend decisions and provisioning. |
| A01-A10 | PENDING | Implement after infrastructure decisions; keep live ads disabled. |
| G07 | BLOCKED | External AdSense review; never mark complete based only on code changes. |

## Reference Sources

- [Vercel commercial-use rules](https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage)
- [Supabase pricing and free-tier limits](https://supabase.com/pricing)
- [AdSense eligibility](https://support.google.com/adsense/answer/9724)
- [AdSense site readiness](https://support.google.com/adsense/answer/7299563)
- [AdSense program policies](https://support.google.com/adsense/answer/48182)
- [Required privacy disclosures](https://support.google.com/adsense/answer/1348695)
- [Google CMP requirements](https://support.google.com/adsense/answer/13554116)
- [Ads.txt guidance](https://support.google.com/adsense/answer/12171612)

Recheck current provider terms, pricing, and policies before deployment; these can change.
