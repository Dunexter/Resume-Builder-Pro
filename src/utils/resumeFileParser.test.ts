import { describe, it, expect } from 'vitest';
import { extractTextFromFile, MAX_UPLOAD_SIZE_BYTES, MAX_IMPORT_TEXT_LENGTH, pdfItemsToText } from './resumeFileParser';

function makeFile(content: string, name: string, type: string): File {
  return new File([content], name, { type });
}

describe('extractTextFromFile', () => {
  it('reads plain text files directly', async () => {
    const file = makeFile('Hello resume text', 'resume.txt', 'text/plain');
    const text = await extractTextFromFile(file);
    expect(text).toBe('Hello resume text');
  });

  it('rejects unsupported file types', async () => {
    const file = makeFile('binary data', 'resume.xyz', 'application/octet-stream');
    await expect(extractTextFromFile(file)).rejects.toThrow(/unsupported/i);
  });

  it('rejects files larger than the max upload size', async () => {
    const bigContent = 'a'.repeat(MAX_UPLOAD_SIZE_BYTES + 1);
    const file = makeFile(bigContent, 'resume.txt', 'text/plain');
    await expect(extractTextFromFile(file)).rejects.toThrow(/too large/i);
  });

  it('rejects legacy DOC even when its MIME type says text', async () => {
    await expect(extractTextFromFile(makeFile('old document', 'resume.doc', 'text/plain'))).rejects.toThrow(/save as .docx or .txt/i);
  });

  it('rejects excessive and empty text without truncation', async () => {
    await expect(extractTextFromFile(makeFile('x'.repeat(MAX_IMPORT_TEXT_LENGTH + 1), 'resume.txt', 'text/plain'))).rejects.toThrow(/nothing was truncated/i);
    await expect(extractTextFromFile(makeFile('   ', 'resume.txt', 'text/plain'))).rejects.toThrow(/no readable text/i);
  });

  it('preserves PDF explicit and coordinate line breaks and warns about columns', () => {
    const item = (str: string, x: number, y: number, hasEOL = false) => ({ str, transform: [1, 0, 0, 1, x, y], width: 40, hasEOL });
    const output = pdfItemsToText([item('Jane Doe', 20, 700, true), item('Experience', 20, 680), item('Engineer', 20, 660), item('Acme', 200, 660), item('Skills', 200, 720)]);
    expect(output.text).toBe('Jane Doe\nExperience\nEngineer | Acme\nSkills');
    expect(output.warnings).toHaveLength(1);
  });
});
