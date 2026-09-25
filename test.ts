import { askGroundedQuestion, scanDocumentForRisks, compareDocuments } from "./src/lib/gemini";

async function run() {
  console.log("Testing Mock Mode execution...");
  // Set MOCK_MODE strictly
  process.env.MOCK_MODE = "true";

  const chunks = [{ id: "¶1", text: "Test document chunk" }];
  const chunksB = [{ id: "¶1", text: "Test document chunk B" }];

  try {
    const q1 = await askGroundedQuestion("What are the terms?", chunks);
    console.log("Q1 Output:", q1);

    const q2 = await askGroundedQuestion("abstain please", chunks);
    console.log("Q2 Output:", q2);

    const scan = await scanDocumentForRisks(chunks);
    console.log("Scan Output:", scan);

    const comp = await compareDocuments(chunks, chunksB);
    console.log("Compare Output:", comp);

    console.log("✅ All mock responses work perfectly!");
  } catch (e) {
    console.error("❌ Bug found:", e);
  }
}

run();
