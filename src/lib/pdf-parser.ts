import pdfParse from 'pdf-parse';

export interface DocumentChunk {
  id: string;
  page: number;
  text: string;
}

export async function parsePdfToChunks(pdfBuffer: Buffer): Promise<DocumentChunk[]> {
  const data = await pdfParse(pdfBuffer);
  const rawText = data.text;
  
  if (!rawText || rawText.trim().length === 0) {
    return [{
      id: "¶1",
      page: 1,
      text: "[Note: This document appears to be empty or consists entirely of scanned images without embedded text. AI parsing requires machine-readable text.]"
    }];
  }

  // 1. Initial split by double newlines or large whitespace gaps
  const initialChunks = rawText.split(/\n\s*\n|\t{2,}/);
  const refinedChunks: string[] = [];

  for (const chunk of initialChunks) {
    // Normalize newlines inside a paragraph into single spaces
    const cleanChunk = chunk.replace(/\s+/g, ' ').trim();
    if (cleanChunk.length < 20) continue; // Skip random noise or page numbers

    // 2. If a chunk is extremely large (> 400 chars), it's likely a massive block of text
    // that didn't have double newlines. We break it down into smaller, digestible clauses.
    if (cleanChunk.length > 400) {
      // Split on punctuation (periods, semicolons, etc.) followed by a space
      const subClauses = cleanChunk.split(/(?<=[.?!;])\s+/);
      
      let currentBuffer = "";
      for (const sub of subClauses) {
        // Group sentences together until we hit ~400 characters
        if (currentBuffer.length + sub.length > 400 && currentBuffer.length > 0) {
          refinedChunks.push(currentBuffer.trim());
          currentBuffer = sub;
        } else {
          currentBuffer += (currentBuffer.length > 0 ? " " : "") + sub;
        }
      }
      if (currentBuffer.trim().length > 0) {
        refinedChunks.push(currentBuffer.trim());
      }
    } else {
      refinedChunks.push(cleanChunk);
    }
  }

  return refinedChunks.map((text, index) => ({
    id: `¶${index + 1}`,
    page: 1, // Simplified for this slice
    text,
  }));
}
