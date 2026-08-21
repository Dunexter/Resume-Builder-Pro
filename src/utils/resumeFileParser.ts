/** Max upload size to keep client-side parsing responsive and avoid tab-freezing on huge files. */
export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const SUPPORTED_EXTENSIONS = ['.txt', '.docx', '.pdf'];

/**
 * Extracts plain text from an uploaded resume file (.txt, .docx, .pdf).
 * Everything runs client-side in the browser — the file is never uploaded to a server.
 */
export async function extractTextFromFile(file: File): Promise<string> {
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error('File is too large (max 10MB). Please upload a smaller file.');
  }

  const name = file.name.toLowerCase();

  if (name.endsWith('.txt') || file.type === 'text/plain') {
    return file.text();
  }

  if (name.endsWith('.docx') || file.type.includes('officedocument.wordprocessingml')) {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const pdfjsLib = await import('pdfjs-dist');
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const pageTexts: string[] = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = content.items
        .map(item => ('str' in item ? item.str : ''))
        .join(' ');
      pageTexts.push(pageText);
    }
    return pageTexts.join('\n');
  }

  throw new Error(`Unsupported file type. Please upload one of: ${SUPPORTED_EXTENSIONS.join(', ')}`);
}
