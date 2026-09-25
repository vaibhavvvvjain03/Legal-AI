import { askGroundedQuestion } from '../src/lib/gemini';

// Mock the Gemini SDK to simulate the model abstaining (notFound: true)
jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => {
      return {
        getGenerativeModel: jest.fn().mockReturnValue({
          generateContent: jest.fn().mockResolvedValue({
            response: {
              text: () => JSON.stringify({
                notFound: true
              })
            }
          })
        })
      };
    }),
    Schema: {},
    SchemaType: { OBJECT: "OBJECT", STRING: "STRING", BOOLEAN: "BOOLEAN" }
  };
});

describe('Grounded Legal Assistant Abstention Path', () => {
  it('returns NOT_FOUND when the document does not contain the answer', async () => {
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
});
