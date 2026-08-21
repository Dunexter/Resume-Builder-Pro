import { describe, it, expect } from 'vitest';
import { extractTextFromFile, MAX_UPLOAD_SIZE_BYTES } from './resumeFileParser';

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
});
