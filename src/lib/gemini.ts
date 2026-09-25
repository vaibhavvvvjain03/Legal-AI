import { GoogleGenerativeAI, Schema, SchemaType } from "@google/generative-ai";
import { DocumentChunk } from "./pdf-parser";
import { z } from "zod";

function getIsMockMode() {
  // Only use mock mode if explicitly set to "true". 
  // Otherwise, default to Live Mode for anyone putting in their real API key.
  return process.env.MOCK_MODE === "true";
}

// ==========================================
// 1. Grounded Q&A
// ==========================================
const MAX_RETRIES = 5;

async function executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
  let attempt = 0;
  while (attempt < MAX_RETRIES) {
    try {
      return await operation();
    } catch (error) {
      attempt++;
      console.warn(`Gemini API call failed (attempt ${attempt}/${MAX_RETRIES}). Retrying...`, error);
      if (attempt >= MAX_RETRIES) {
        throw error;
      }
      // Exponential backoff
      await new Promise(res => setTimeout(res, 1000 * Math.pow(2, attempt)));
    }
  }
  throw new Error("Failed after max retries");
}

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("GEMINI_API_KEY is missing. Please add it to your .env.local file.");
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
}

export const AnswerSchema = z.object({
  answer: z.string().optional(),
  citedChunkId: z.string().optional(),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  notFound: z.boolean().optional(),
});
export type GroundedAnswer = z.infer<typeof AnswerSchema>;

const responseSchemaQA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    answer: {
      type: SchemaType.STRING,
      description: "The answer to the user's question, sourced strictly from the text.",
    },
    citedChunkId: {
      type: SchemaType.STRING,
      description: "The exact id of the chunk that contains the answer (e.g. '¶14'). Required unless notFound is true.",
    },
    confidence: {
      type: SchemaType.STRING,
      description: "Confidence level of the answer: HIGH, MEDIUM, or LOW",
    },
    notFound: {
      type: SchemaType.BOOLEAN,
      description: "Set to true ONLY if the provided text chunks do not contain the answer. If true, omit answer, citedChunkId, and confidence.",
    }
  },
};

export async function askGroundedQuestion(
  question: string,
  chunks: DocumentChunk[]
): Promise<GroundedAnswer> {
  if (getIsMockMode()) {
    const q = question.toLowerCase();
    
    // Explicit Mock Q&A for Resume Demo Video
    if (q.includes("skills")) {
      return {
        answer: "According to the resume, Vaibhav's technical skills include Python, Java, JavaScript, TypeScript, SQL, Next.js, React, and AWS (CDK, Lambda, DynamoDB). He also has experience with Generative AI technologies including Amazon Bedrock and Gemini APIs.",
        citedChunkId: chunks.find(c => c.text.includes("TECHNICAL SKILLS"))?.id || "¶3",
        confidence: "HIGH"
      };
    }
    if (q.includes("projects")) {
      return {
        answer: "The document highlights several projects, including 'Setu-Disaster', an offline-tolerant crisis logistics platform built with AWS and Next.js, and 'StoreGPT', an AI-powered instant digital store toolkit.",
        citedChunkId: chunks.find(c => c.text.includes("SELECTED PROJECTS"))?.id || "¶2",
        confidence: "HIGH"
      };
    }
    if (q.includes("education") || q.includes("degree")) {
      return {
        answer: "Vaibhav is pursuing a B.Tech in Computer Science & Engineering (AI & Data Engineering) at JAIN (Deemed-to-be University), expected to graduate in 2029.",
        citedChunkId: chunks.find(c => c.text.includes("EDUCATION"))?.id || "¶3",
        confidence: "HIGH"
      };
    }

    if (q.includes("not found") || q.includes("abstain") || q.includes("missing")) {
      return { notFound: true };
    }
    if (q.includes("unverified") || q.includes("fail") || q.includes("low")) {
      return {
        answer: "This is a mock response demonstrating a low-confidence/unverified answer.",
        citedChunkId: chunks[0]?.id || "¶1",
        confidence: "LOW"
      };
    }
    
    return {
      answer: "According to the provided document, the party is obligated to provide a 30-day written notice before termination of the contract.",
      citedChunkId: chunks[0]?.id || "¶1",
      confidence: "HIGH"
    };
  }

  const model = getModel();

  const context = chunks.map((c) => `[ID: ${c.id}]\n${c.text}`).join("\n\n");
  const prompt = `You are a strict legal assistant. You must answer the user's question based ONLY on the provided document chunks.
You are FORBIDDEN from using outside knowledge. 

If the answer is found in the chunks:
1. Provide the exact answer.
2. Provide the 'citedChunkId' (the ID of the chunk, e.g. ¶5) that supports your answer.
3. Provide your confidence (HIGH, MEDIUM, or LOW).

If the answer is NOT found in the chunks or cannot be confidently answered using ONLY the provided text:
1. Set 'notFound' to true.
2. Do not provide an answer or citedChunkId.

Here are the document chunks:
${context}

User Question: ${question}`;

  const result = await executeWithRetry(() => model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: responseSchemaQA,
      temperature: 0.0,
    },
  }));

  const parsed = JSON.parse(result.response.text());
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

const responseSchemaScan: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    flags: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          type: { 
            type: SchemaType.STRING, 
            description: "Must be RISK, OBLIGATION, or INCONSISTENCY" 
          },
          chunkId: { 
            type: SchemaType.STRING, 
            description: "The exact ID of the chunk (e.g. '¶5')" 
          },
          description: { 
            type: SchemaType.STRING,
            description: "Brief description of the risk, obligation, or inconsistency."
          }
        }
      }
    }
  }
};

export async function scanDocumentForRisks(chunks: DocumentChunk[]): Promise<ScanResult> {
  if (getIsMockMode()) {
    return {
      flags: [
        { type: "RISK", chunkId: chunks[0]?.id || "¶1", description: "Unlimited Liability: This clause fails to cap damages, exposing the party to unlimited financial liability in the event of a breach." },
        { type: "OBLIGATION", chunkId: chunks.length > 1 ? chunks[1].id : "¶2", description: "Strict Reporting: Requires written notice of any security or data breaches within 24 hours of discovery." },
        { type: "INCONSISTENCY", chunkId: chunks.length > 2 ? chunks[2].id : "¶3", description: "Governing Law Conflict: This section specifies California law, but a later section references New York jurisdiction." }
      ]
    };
  }

  const model = getModel();

  const context = chunks.map((c) => `[ID: ${c.id}]\n${c.text}`).join("\n\n");
  const prompt = `You are a strict legal auditor. Review the provided document chunks.
Identify key OBLIGATIONS (duties a party must perform), RISKS (liabilities, severe penalties, automatic renewals, one-sided terms), and INCONSISTENCIES (contradictory clauses).
Return an array of flags. Every flag MUST cite the exact chunkId where it is found.

Here are the document chunks:
${context}`;

  const result = await executeWithRetry(() => model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: responseSchemaScan,
      temperature: 0.0,
    },
  }));

  const parsed = JSON.parse(result.response.text());
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

const responseSchemaCompare: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    diffs: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          clauseAId: { 
            type: SchemaType.STRING, 
            description: "The ID from Document A (e.g. '¶5'), if applicable." 
          },
          clauseBId: { 
            type: SchemaType.STRING, 
            description: "The ID from Document B (e.g. '¶5'), if applicable." 
          },
          status: { 
            type: SchemaType.STRING, 
            description: "Must be ADDED, REMOVED, or CHANGED" 
          },
          description: { 
            type: SchemaType.STRING,
            description: "Brief summary of what was added, removed, or how it changed."
          }
        }
      }
    }
  }
};

export async function compareDocuments(
  chunksA: DocumentChunk[],
  chunksB: DocumentChunk[]
): Promise<CompareResult> {
  if (getIsMockMode()) {
    return {
      diffs: [
        { status: "ADDED", clauseBId: chunksB[0]?.id || "¶1", description: "New force majeure clause added, specifically citing pandemics and cyberattacks as valid exemptions." },
        { status: "REMOVED", clauseAId: chunksA[0]?.id || "¶1", description: "Removed the 'Automatic Renewal' provision, effectively converting this to a strict fixed-term agreement." },
        { status: "CHANGED", clauseAId: chunksA.length > 1 ? chunksA[1].id : "¶2", clauseBId: chunksB.length > 1 ? chunksB[1].id : "¶2", description: "Payment terms modified: The invoice grace period was shortened from Net-60 to Net-30 days." }
      ]
    };
  }

  const model = getModel();

  const contextA = chunksA.map((c) => `[ID: ${c.id}]\n${c.text}`).join("\n\n");
  const contextB = chunksB.map((c) => `[ID: ${c.id}]\n${c.text}`).join("\n\n");
  
  const prompt = `You are a strict legal auditor comparing two versions of a document or two related documents.
Document A is the baseline. Document B is the new version.
Identify clauses that were ADDED in B, REMOVED from A, or CHANGED between A and B.
For each difference, cite the relevant chunk IDs from A and/or B.

Document A:
${contextA}

Document B:
${contextB}`;

  const result = await executeWithRetry(() => model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: responseSchemaCompare,
      temperature: 0.0,
    },
  }));

  const parsed = JSON.parse(result.response.text());
  return CompareResultSchema.parse(parsed);
}
