import { GoogleGenAI } from "@google/genai";
import { DocumentChunk } from "./pdf-parser";
import { z } from "zod";

function getIsMockMode() {
  return process.env.MOCK_MODE === "true";
}

const MAX_RETRIES = 5;

async function executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
  let attempt = 0;
  while (attempt < MAX_RETRIES) {
    try {
      return await operation();
    } catch (error) {
      attempt++;
      console.warn(`Gemini API call failed (attempt ${attempt}/${MAX_RETRIES}). Retrying...`, error);
      if (attempt >= MAX_RETRIES) throw error;
      await new Promise(res => setTimeout(res, 1000 * Math.pow(2, attempt)));
    }
  }
  throw new Error("Failed after max retries");
}

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("GEMINI_API_KEY is missing. Please add it to your .env.local file.");
  }
  return new GoogleGenAI({ apiKey });
}

// ==========================================
// 1. Grounded Q&A
// ==========================================
export const AnswerSchema = z.object({
  answer: z.string().optional(),
  citedChunkId: z.string().optional(),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  notFound: z.boolean().optional(),
});
export type GroundedAnswer = z.infer<typeof AnswerSchema>;

export async function askGroundedQuestion(
  question: string,
  chunks: DocumentChunk[]
): Promise<GroundedAnswer> {
  if (getIsMockMode()) {
    const q = question.toLowerCase();
    if (q.includes("skills")) {
      return {
        answer: "Technical skills include Python, Java, JavaScript, TypeScript, SQL, Next.js, React, and AWS.",
        citedChunkId: chunks.find(c => c.text.includes("TECHNICAL SKILLS"))?.id || "¶3",
        confidence: "HIGH"
      };
    }
    if (q.includes("projects")) {
      return {
        answer: "Projects include 'Setu-Disaster' and 'StoreGPT'.",
        citedChunkId: chunks.find(c => c.text.includes("SELECTED PROJECTS"))?.id || "¶2",
        confidence: "HIGH"
      };
    }
    if (q.includes("education") || q.includes("degree")) {
      return {
        answer: "B.Tech in CSE (AI & Data Engineering) at JAIN University, expected 2029.",
        citedChunkId: chunks.find(c => c.text.includes("EDUCATION"))?.id || "¶3",
        confidence: "HIGH"
      };
    }
    if (q.includes("not found") || q.includes("abstain") || q.includes("missing")) {
      return { notFound: true };
    }
    return {
      answer: "The party is obligated to provide a 30-day written notice before termination.",
      citedChunkId: chunks[0]?.id || "¶1",
      confidence: "HIGH"
    };
  }

  const ai = getClient();
  const context = chunks.map((c) => `[ID: ${c.id}]\n${c.text}`).join("\n\n");

  const prompt = `You are a strict legal assistant. Answer ONLY from the provided document chunks.
FORBIDDEN from using outside knowledge.

If found: give answer, citedChunkId (e.g. ¶5), and confidence (HIGH/MEDIUM/LOW).
If NOT found: set notFound to true, omit other fields.

Document chunks:
${context}

User Question: ${question}

Respond ONLY with valid JSON:
{"answer": "string", "citedChunkId": "string", "confidence": "HIGH|MEDIUM|LOW", "notFound": boolean}`;

  const result = await executeWithRetry(() =>
    ai.interactions.create({
      model: "gemini-3.8-flash",
      input: prompt,
    })
  );

  const raw = result.output_text ?? "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in response");
  const parsed = JSON.parse(jsonMatch[0]);
  return AnswerSchema.parse(parsed);
}

// ==========================================
// 2. Risk & Obligation Scanning
// ==========================================
export const ScanResultSchema = z.object({
  flags: z.array(z.object({
    type: z.enum(["RISK", "OBLIGATION", "INCONSISTENCY"]),
    chunkId: z.string(),
    description: z.string(),
  }))
});
export type ScanResult = z.infer<typeof ScanResultSchema>;

export async function scanDocumentForRisks(chunks: DocumentChunk[]): Promise<ScanResult> {
  if (getIsMockMode()) {
    return {
      flags: [
        { type: "RISK", chunkId: chunks[0]?.id || "¶1", description: "Unlimited Liability: This clause fails to cap damages, exposing the party to unlimited financial liability." },
        { type: "OBLIGATION", chunkId: chunks.length > 1 ? chunks[1].id : "¶2", description: "Strict Reporting: Requires written notice of any breaches within 24 hours." },
        { type: "INCONSISTENCY", chunkId: chunks.length > 2 ? chunks[2].id : "¶3", description: "Governing Law Conflict: One section references California law, another references New York." }
      ]
    };
  }

  const ai = getClient();
  const context = chunks.map((c) => `[ID: ${c.id}]\n${c.text}`).join("\n\n");

  const prompt = `You are a strict legal auditor. Review the document chunks below.
Identify OBLIGATIONS (duties a party must perform), RISKS (liabilities, penalties, one-sided terms), and INCONSISTENCIES (contradictory clauses).
Every flag MUST cite the exact chunkId where it was found.

Document chunks:
${context}

Respond ONLY with valid JSON:
{"flags": [{"type": "RISK|OBLIGATION|INCONSISTENCY", "chunkId": "string", "description": "string"}]}`;

  const result = await executeWithRetry(() =>
    ai.interactions.create({
      model: "gemini-3.8-flash",
      input: prompt,
    })
  );

  const raw = result.output_text ?? "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in response");
  const parsed = JSON.parse(jsonMatch[0]);
  return ScanResultSchema.parse(parsed);
}

// ==========================================
// 3. Document Comparison (Diff)
// ==========================================
export const CompareResultSchema = z.object({
  diffs: z.array(z.object({
    clauseAId: z.string().optional(),
    clauseBId: z.string().optional(),
    status: z.enum(["ADDED", "REMOVED", "CHANGED"]),
    description: z.string(),
  }))
});
export type CompareResult = z.infer<typeof CompareResultSchema>;

export async function compareDocuments(
  chunksA: DocumentChunk[],
  chunksB: DocumentChunk[]
): Promise<CompareResult> {
  if (getIsMockMode()) {
    return {
      diffs: [
        { status: "ADDED", clauseBId: chunksB[0]?.id || "¶1", description: "New force majeure clause added." },
        { status: "REMOVED", clauseAId: chunksA[0]?.id || "¶1", description: "Removed the Automatic Renewal provision." },
        { status: "CHANGED", clauseAId: chunksA.length > 1 ? chunksA[1].id : "¶2", clauseBId: chunksB.length > 1 ? chunksB[1].id : "¶2", description: "Payment terms changed from Net-60 to Net-30 days." }
      ]
    };
  }

  const ai = getClient();
  const contextA = chunksA.map((c) => `[ID: ${c.id}]\n${c.text}`).join("\n\n");
  const contextB = chunksB.map((c) => `[ID: ${c.id}]\n${c.text}`).join("\n\n");

  const prompt = `You are a strict legal auditor comparing two document versions.
Document A is the baseline. Document B is the new version.
Identify ADDED (in B only), REMOVED (from A), or CHANGED clauses. Cite chunk IDs from A and/or B.

Document A:
${contextA}

Document B:
${contextB}

Respond ONLY with valid JSON:
{"diffs": [{"clauseAId": "string", "clauseBId": "string", "status": "ADDED|REMOVED|CHANGED", "description": "string"}]}`;

  const result = await executeWithRetry(() =>
    ai.interactions.create({
      model: "gemini-3.8-flash",
      input: prompt,
    })
  );

  const raw = result.output_text ?? "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in response");
  const parsed = JSON.parse(jsonMatch[0]);
  return CompareResultSchema.parse(parsed);
}
