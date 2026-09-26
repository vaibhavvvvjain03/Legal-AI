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
  });

  describe("askQuestion", () => {
    const validChunks = [{ id: "1", text: "test", page: 1 }];

    it("returns error for invalid question", async () => {
      const result = await askQuestion("", validChunks);
      expect(result.error).toBe("Invalid question.");
    });

    it("returns error if no chunks provided", async () => {
      const result = await askQuestion("Valid question", []);
      expect(result.error).toBe("Please upload a document first.");
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
      const result = await compareDocs(chunksA, []);
      expect(result.error).toBe("Two documents are required for comparison. Please upload Document B.");
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
