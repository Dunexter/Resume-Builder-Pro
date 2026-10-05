export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_IMPORT_TEXT_LENGTH = 100_000;
export const MAX_PDF_PAGES = 30;

export interface ExtractedResumeText {
  text: string;
  warnings: string[];
}

export function checkImportText(text: string): string {
  if (text.length > MAX_IMPORT_TEXT_LENGTH) {
    throw new Error(`Text exceeds ${MAX_IMPORT_TEXT_LENGTH.toLocaleString()} characters. Shorten it explicitly and try again; nothing was truncated.`);
  }
  if (!text.trim()) throw new Error('No readable text found. For scanned documents, run OCR locally or paste the text.');
  return text;
}

interface PositionedText {
  str: string;
  transform: number[];
  width: number;
  hasEOL?: boolean;
}

// Check ZIP directory sizes before Mammoth expands the DOCX archive.
function checkDocxArchive(buffer: ArrayBuffer): void {
  const view = new DataView(buffer);
  let end = buffer.byteLength - 22;
  const minimum = Math.max(0, end - 65535);
  while (end >= minimum && view.getUint32(end, true) !== 0x06054b50) end--;
  if (end < minimum) throw new Error('Invalid DOCX archive.');
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  let expanded = 0;
  if (count > 2000) throw new Error('DOCX contains too many archive entries.');
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) throw new Error('Invalid DOCX archive directory.');
    if (view.getUint16(offset + 8, true) & 1) throw new Error('Encrypted DOCX is not supported.');
    expanded += view.getUint32(offset + 24, true);
    if (expanded > 30 * 1024 * 1024) throw new Error('Expanded DOCX exceeds the 30MB safety limit.');
    offset += 46 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
  }
}

/** Preserve PDF stream order, explicit line endings, and coordinate-based line boundaries. */
export function pdfItemsToText(items: PositionedText[]): ExtractedResumeText {
  if (items.length > 50_000) throw new Error('PDF page contains too many text fragments. Export fewer or simpler pages.');
  let text = '';
  let previous: PositionedText | undefined;
  let columns = false;
  for (const item of items) {
    if (previous && !text.endsWith('\n')) {
      const dy = Math.abs(item.transform[5] - previous.transform[5]);
      const gap = item.transform[4] - (previous.transform[4] + previous.width);
      if (dy > 3 || item.transform[4] < previous.transform[4] - 5) text += '\n';
      else if (gap > 20) { text += ' | '; columns = true; }
      else if (gap > 1 && !/\s$/.test(text) && !/^\s/.test(item.str)) text += ' ';
    }
    if (previous && item.transform[5] > previous.transform[5] + 20) columns = true;
    text += item.str;
    if (item.hasEOL) text += '\n';
    if (text.length > MAX_IMPORT_TEXT_LENGTH) checkImportText(text);
    previous = item;
  }
  return { text, warnings: columns ? ['Possible PDF columns or reordered text detected. Correct reading order in the text preview before parsing.'] : [] };
}

/** Parse into an inert template, never attach or render document HTML or its URLs. */
export function docxHtmlToText(html: string): string {
  if (html.length > MAX_IMPORT_TEXT_LENGTH * 20) throw new Error('DOCX content is too large to process safely. Export a smaller TXT file.');
  const template = document.createElement('template');
  template.innerHTML = html;
  const walk = (node: Node): string => {
    if (node.nodeType === 3) return node.textContent || '';
    if (node.nodeType !== 1 && node.nodeType !== 11) return '';
    const tag = node.nodeType === 1 ? (node as Element).tagName.toLowerCase() : '';
    if (['script', 'style', 'img', 'iframe', 'object', 'embed', 'link', 'svg'].includes(tag)) return '';
    if (tag === 'br') return '\n';
    const content = Array.from(node.childNodes).map(walk).join('');
    if (tag === 'li') return `- ${content.trim()}\n`;
    if (tag === 'td' || tag === 'th') return `${content.trim()} | `;
    if (/^(p|h[1-6]|div|tr|ul|ol|table)$/.test(tag)) return `${content.trim()}\n`;
    return content;
  };
  return checkImportText(walk(template.content).replace(/\n{3,}/g, '\n\n').trim());
}

/** Extraction stays local. AI transmission is a separate, explicitly opted-in step. */
export async function extractResumeFile(file: File): Promise<ExtractedResumeText> {
  if (file.size > MAX_UPLOAD_SIZE_BYTES) throw new Error('File is too large (max 10MB). Please upload a smaller file.');
  const extension = file.name.toLowerCase().split('.').pop();
  if (extension === 'doc') throw new Error('Legacy .doc files are not supported. Save as .docx or .txt in Word or LibreOffice first.');
  if (!['txt', 'docx', 'pdf'].includes(extension || '')) throw new Error('Unsupported file type. Use PDF, DOCX, or TXT.');
  if (extension === 'txt') return { text: checkImportText(await file.text()), warnings: [] };
  if (extension === 'docx') {
    try {
      const mammoth = await import('mammoth');
      const arrayBuffer = await file.arrayBuffer();
      checkDocxArchive(arrayBuffer);
      const result = await mammoth.convertToHtml({ arrayBuffer }, {
        // Do not read embedded images or follow external relationships.
        externalFileAccess: false,
        convertImage: mammoth.images.imgElement(async () => ({ src: '' })),
      });
      return {
        text: docxHtmlToText(result.value),
        warnings: ['DOCX images are not imported. Review tables, text boxes, and reading order.', ...result.messages.map(m => m.message)],
      };
    } catch (error) {
      throw new Error(`Could not read DOCX. It may be corrupt, encrypted, or too complex; save as TXT and retry. ${error instanceof Error ? error.message : ''}`);
    }
  }
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  const task = pdfjs.getDocument({ data: await file.arrayBuffer(), useSystemFonts: false, disableFontFace: true, useWorkerFetch: false, useWasm: false });
  const warnings = new Set<string>(['PDF reading order may differ from the page layout. Check the extracted text, especially columns.']);
  try {
    const pdf = await task.promise;
    if (pdf.numPages > MAX_PDF_PAGES) throw new Error(`PDF exceeds ${MAX_PDF_PAGES} pages. Export only the resume pages.`);
    const pages: string[] = [];
    let length = 0;
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      try {
        const content = await page.getTextContent();
        const result = pdfItemsToText(content.items.filter((item): item is typeof item & PositionedText => 'str' in item));
        length += result.text.length + 2;
        if (length > MAX_IMPORT_TEXT_LENGTH) throw new Error('PDF text is too large. Export fewer pages; nothing was truncated.');
        if (!result.text.trim()) warnings.add(`Page ${n} has no readable text. It may be scanned; use local OCR to recover it.`);
        result.warnings.forEach(w => warnings.add(w));
        pages.push(result.text);
      } finally { page.cleanup(); }
    }
    return { text: checkImportText(pages.join('\n\n')), warnings: [...warnings] };
  } catch (error) {
    throw new Error(`Could not read PDF. If encrypted, unlock it locally; if scanned, run OCR or paste text. ${error instanceof Error ? error.message : ''}`);
  } finally { await task.destroy(); }
}

// Kept for existing text-extraction consumers.
export async function extractTextFromFile(file: File): Promise<string> {
  return (await extractResumeFile(file)).text;
}
