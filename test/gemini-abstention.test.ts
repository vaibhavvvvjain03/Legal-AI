import { askGroundedQuestion, scanDocumentForRisks, compareDocuments } from '../src/lib/gemini';
import { GoogleGenAI } from '@google/genai';

// Mock the Gemini SDK
jest.mock('@google/genai', () => {
  return {
    GoogleGenAI: jest.fn().mockImplementation(() => {
      return {
        interactions: {
          create: jest.fn().mockResolvedValue({
            output_text: JSON.stringify({
              notFound: true
            })
          })
        }
      };
    })
  };
});

describe('Gemini SDK Abstraction Tests', () => {
  const originalEnv = process.env;
  
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, GEMINI_API_KEY: "dummy_key" };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('askGroundedQuestion returns NOT_FOUND when the document does not contain the answer', async () => {
    const chunks = [
      { id: '¶1', page: 1, text: 'This Agreement shall be governed by the laws of California.' }
    ];
    
    // Ask about something completely unrelated to test abstention
    const answer = await askGroundedQuestion('What is the capital of France?', chunks);
    
    expect(answer).toBeDefined();
    expect(answer.notFound).toBe(true);
    expect(answer.answer).toBeUndefined();
    expect(answer.citedChunkId).toBeUndefined();
  });

  it('scanDocumentForRisks parses json successfully', async () => {
    // Override the mock for this specific test
    const mockCreate = jest.fn().mockResolvedValue({
      output_text: JSON.stringify({
        flags: [{ type: "RISK", title: "Test", snippet: "Test", description: "Test", chunkId: "1" }],
        summary: "Risk found"
      })
    });
    
    (GoogleGenAI as jest.Mock).mockImplementation(() => ({
      interactions: {
        create: mockCreate
      }
    }));

    const result = await scanDocumentForRisks([{ id: '1', page: 1, text: 'Test' }]);
    expect(result).toBeDefined();
    expect(result.flags).toHaveLength(1);
    expect(result.flags[0].type).toBe("RISK");
  });
});
