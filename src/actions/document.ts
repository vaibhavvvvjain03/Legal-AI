"use server";

import { DocumentChunk, parsePdfToChunks } from "@/lib/pdf-parser";
import { 
  askGroundedQuestion, 
  scanDocumentForRisks, 
  compareDocuments,
  GroundedAnswer, 
  ScanResult, 
  CompareResult 
} from "@/lib/gemini";

export async function processUploadedDocument(formData: FormData): Promise<{ chunks: DocumentChunk[], error?: string }> {
  try {
    const file = formData.get("file") as File;
    if (!file) {
      return { chunks: [], error: "No file uploaded." };
    }
    
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return { chunks: [], error: "Only PDF files are supported." };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const chunks = await parsePdfToChunks(buffer);
    return { chunks };
  } catch (err) {
    console.error("Error parsing document:", err);
    return { chunks: [], error: "Failed to parse document." };
  }
}

export async function askQuestion(question: string, chunks: DocumentChunk[]): Promise<{ answer: GroundedAnswer | null, error?: string }> {
  try {
    if (!question || chunks.length === 0) {
      return { answer: null, error: "Invalid input." };
    }
    const answer = await askGroundedQuestion(question, chunks);
    return { answer };
  } catch (err) {
    console.error("Error answering question:", err);
    return { answer: null, error: "Failed to query AI." };
  }
}

export async function scanDocument(chunks: DocumentChunk[]): Promise<{ result: ScanResult | null, error?: string }> {
  try {
    if (chunks.length === 0) {
      return { result: null, error: "No document chunks to scan." };
    }
    const result = await scanDocumentForRisks(chunks);
    return { result };
  } catch (err) {
    console.error("Error scanning document:", err);
    return { result: null, error: "Failed to scan document." };
  }
}

export async function compareDocs(chunksA: DocumentChunk[], chunksB: DocumentChunk[]): Promise<{ result: CompareResult | null, error?: string }> {
  try {
    if (chunksA.length === 0 || chunksB.length === 0) {
      return { result: null, error: "Two documents are required for comparison." };
    }
    const result = await compareDocuments(chunksA, chunksB);
    return { result };
  } catch (err) {
    console.error("Error comparing documents:", err);
    return { result: null, error: "Failed to compare documents." };
  }
}
