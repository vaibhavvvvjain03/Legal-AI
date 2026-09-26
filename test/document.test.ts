import { processUploadedDocument, askQuestion, scanDocument, compareDocs } from "../src/actions/document";
import { parsePdfToChunks } from "../src/lib/pdf-parser";
import { askGroundedQuestion, scanDocumentForRisks, compareDocuments } from "../src/lib/gemini";

// Mock dependencies
jest.mock("../src/lib/pdf-parser", () => ({
  parsePdfToChunks: jest.fn(),
}));

jest.mock("../src/lib/gemini", () => ({
  askGroundedQuestion: jest.fn(),
  scanDocumentForRisks: jest.fn(),
  compareDocuments: jest.fn(),
}));

describe("document actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("processUploadedDocument", () => {
    it("returns error if no file is provided", async () => {
      const formData = new FormData();
      const result = await processUploadedDocument(formData);
      expect(result.error).toBe("No file uploaded.");
    });

    it("returns error if file is not a PDF", async () => {
      const formData = new FormData();
      formData.append("file", new File(["test"], "test.txt", { type: "text/plain" }));
      const result = await processUploadedDocument(formData);
      expect(result.error).toBe("Only PDF files are supported.");
    });

    it("returns error if file is too large", async () => {
      const formData = new FormData();
      const largeFile = new File([new ArrayBuffer(21 * 1024 * 1024)], "large.pdf", { type: "application/pdf" });
      Object.defineProperty(largeFile, "size", { value: 21 * 1024 * 1024 });
      formData.append("file", largeFile);
      
      const result = await processUploadedDocument(formData);
      expect(result.error).toBe("File too large. Maximum allowed size is 20MB.");
    });

    it("processes valid PDF and returns chunks", async () => {
      const formData = new FormData();
      const mockFile = new File(["pdf content"], "test.pdf", { type: "application/pdf" });
      mockFile.arrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(8));
      formData.append("file", mockFile);
      
      const mockChunks = [{ id: "1", text: "test", page: 1 }];
      (parsePdfToChunks as jest.Mock).mockResolvedValue(mockChunks);

      const result = await processUploadedDocument(formData);
      expect(result.error).toBeUndefined();
      expect(result.chunks).toEqual(mockChunks);
    });

    it("returns error if no file uploaded", async () => {
      const formData = new FormData();
      const result = await processUploadedDocument(formData);
      expect(result.error).toBe("No file uploaded.");
      expect(result.chunks).toEqual([]);
    });

    it("returns error for invalid file type", async () => {
      const formData = new FormData();
      formData.append("file", new File(["content"], "test.txt", { type: "text/plain" }));
      const result = await processUploadedDocument(formData);
      expect(result.error).toBe("Only PDF files are supported.");
    });

    it("returns error for oversized file", async () => {
      const formData = new FormData();
      const mockFile = new File(["pdf"], "test.pdf", { type: "application/pdf" });
      Object.defineProperty(mockFile, 'size', { value: 25 * 1024 * 1024 }); // 25 MB
      formData.append("file", mockFile);
      const result = await processUploadedDocument(formData);
      expect(result.error).toMatch(/File too large/);
    });

    it("returns error if PDF parsing yields empty chunks", async () => {
      const formData = new FormData();
      const mockFile = new File(["pdf"], "empty.pdf", { type: "application/pdf" });
      mockFile.arrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(8));
      formData.append("file", mockFile);
      (parsePdfToChunks as jest.Mock).mockResolvedValue([]);
      
      const result = await processUploadedDocument(formData);
      expect(result.error).toMatch(/Could not extract text/);
    });

    it("handles parsing exceptions safely", async () => {
      const formData = new FormData();
      const mockFile = new File(["pdf"], "error.pdf", { type: "application/pdf" });
      mockFile.arrayBuffer = jest.fn().mockRejectedValue(new Error("Parse fail"));
      formData.append("file", mockFile);
      
      const result = await processUploadedDocument(formData);
      expect(result.error).toBe("Failed to parse document. Please try again.");
    });
  });

  describe("askQuestion", () => {
    const validChunks = [{ id: "1", text: "test", page: 1 }];

    it("returns error for invalid question", async () => {
      const result = await askQuestion(null as any, validChunks);
      expect(result.error).toBe("Invalid question.");
    });

    it("returns error if question is empty", async () => {
      const result = await askQuestion("   ", validChunks);
      expect(result.error).toBe("Question cannot be empty.");
    });

    it("returns error if no chunks provided", async () => {
      const result = await askQuestion("Valid question", []);
      expect(result.error).toBe("Please upload a document first.");
    });

    it("catches exceptions during AI Q&A", async () => {
      (askGroundedQuestion as jest.Mock).mockRejectedValue(new Error("AI Down"));
      const result = await askQuestion("Valid question", validChunks);
      expect(result.error).toBe("Failed to query AI. Please try again.");
    });

    it("calls askGroundedQuestion with valid inputs", async () => {
      (askGroundedQuestion as jest.Mock).mockResolvedValue({ answer: "Test answer" });
      const result = await askQuestion("Valid question", validChunks);
      expect(result.error).toBeUndefined();
      expect(result.answer).toEqual({ answer: "Test answer" });
      expect(askGroundedQuestion).toHaveBeenCalledWith("Valid question", validChunks);
    });
  });

  describe("scanDocument", () => {
    it("returns error if no chunks provided", async () => {
      const result = await scanDocument([]);
      expect(result.error).toBe("No document uploaded. Please upload a PDF first.");
    });

    it("catches exceptions during AI scanning", async () => {
      (scanDocumentForRisks as jest.Mock).mockRejectedValue(new Error("AI Down"));
      const result = await scanDocument([{ id: "1", text: "test", page: 1 }]);
      expect(result.error).toBe("Failed to scan document. Please try again.");
    });

    it("calls scanDocumentForRisks with chunks", async () => {
      const validChunks = [{ id: "1", text: "test", page: 1 }];
      (scanDocumentForRisks as jest.Mock).mockResolvedValue({ summary: "Risk found" });
      const result = await scanDocument(validChunks);
      expect(result.error).toBeUndefined();
      expect(result.result).toEqual({ summary: "Risk found" });
      expect(scanDocumentForRisks).toHaveBeenCalledWith(validChunks);
    });
  });

  describe("compareDocs", () => {
    const chunksA = [{ id: "1", text: "test", page: 1 }];
    const chunksB = [{ id: "2", text: "test", page: 1 }];

    it("returns error if a document is missing", async () => {
      const result1 = await compareDocs(chunksA, []);
      expect(result1.error).toBe("Two documents are required for comparison. Please upload Document B.");
      
      const result2 = await compareDocs([], chunksB);
      expect(result2.error).toBe("Two documents are required for comparison. Please upload Document B.");
    });

    it("catches exceptions during AI comparison", async () => {
      (compareDocuments as jest.Mock).mockRejectedValue(new Error("AI Down"));
      const result = await compareDocs(chunksA, chunksB);
      expect(result.error).toBe("Failed to compare documents. Please try again.");
    });

    it("calls compareDocuments with both chunks", async () => {
      (compareDocuments as jest.Mock).mockResolvedValue({ summary: "Differences found" });
      const result = await compareDocs(chunksA, chunksB);
      expect(result.error).toBeUndefined();
      expect(result.result).toEqual({ summary: "Differences found" });
      expect(compareDocuments).toHaveBeenCalledWith(chunksA, chunksB);
    });
  });
});
