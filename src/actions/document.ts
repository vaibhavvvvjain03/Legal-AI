"use server";

import { DocumentChunk, parsePdfToChunks } from "@/lib/pdf-parser";
import {
  askGroundedQuestion,
  scanDocumentForRisks,
  compareDocuments,
  GroundedAnswer,
  ScanResult,
  CompareResult,
} from "@/lib/gemini";

// Security: 20 MB max file size
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
// Security: Max question length to prevent prompt injection
const MAX_QUESTION_LENGTH = 2000;

export async function processUploadedDocument(
  formData: FormData
): Promise<{ chunks: DocumentChunk[]; error?: string }> {
  try {
    const file = formData.get("file") as File;
    if (!file) {
      return { chunks: [], error: "No file uploaded." };
    }

    // Security: Strict MIME + extension check
    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      return { chunks: [], error: "Only PDF files are supported." };
    }

    // Security: File size guard
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        chunks: [],
        error: `File too large. Maximum allowed size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB.`,
      };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const chunks = await parsePdfToChunks(buffer);

    if (chunks.length === 0) {
      return {
        chunks: [],
        error:
          "Could not extract text from this PDF. Ensure it is not scanned/image-only.",
      };
    }

    return { chunks };
  } catch (err) {
    console.error("Error parsing document:", err);
    return { chunks: [], error: "Failed to parse document. Please try again." };
  }
}

export async function askQuestion(
  question: string,
  chunks: DocumentChunk[]
): Promise<{ answer: GroundedAnswer | null; error?: string }> {
  try {
    // Security: Input validation
    if (!question || typeof question !== "string") {
      return { answer: null, error: "Invalid question." };
    }

    const sanitized = question.trim().slice(0, MAX_QUESTION_LENGTH);

    if (sanitized.length === 0) {
      return { answer: null, error: "Question cannot be empty." };
    }

    if (chunks.length === 0) {
      return { answer: null, error: "Please upload a document first." };
    }

    const answer = await askGroundedQuestion(sanitized, chunks);
    return { answer };
  } catch (err) {
    console.error("Error answering question:", err);
    return { answer: null, error: "Failed to query AI. Please try again." };
  }
}

export async function scanDocument(
  chunks: DocumentChunk[]
): Promise<{ result: ScanResult | null; error?: string }> {
  try {
    if (chunks.length === 0) {
      return { result: null, error: "No document uploaded. Please upload a PDF first." };
    }
    const result = await scanDocumentForRisks(chunks);
    return { result };
  } catch (err) {
    console.error("Error scanning document:", err);
    return { result: null, error: "Failed to scan document. Please try again." };
  }
}

export async function compareDocs(
  chunksA: DocumentChunk[],
  chunksB: DocumentChunk[]
): Promise<{ result: CompareResult | null; error?: string }> {
  try {
    if (chunksA.length === 0 || chunksB.length === 0) {
      return {
        result: null,
        error: "Two documents are required for comparison. Please upload Document B.",
      };
    }
    const result = await compareDocuments(chunksA, chunksB);
    return { result };
  } catch (err) {
    console.error("Error comparing documents:", err);
    return { result: null, error: "Failed to compare documents. Please try again." };
  }
}
