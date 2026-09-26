import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import Page from '../src/app/page';

jest.mock('../src/actions/document', () => ({
  processUploadedDocument: jest.fn(),
  askQuestion: jest.fn(),
  scanDocument: jest.fn(),
  compareDocs: jest.fn(),
}));

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn()
}));

describe('Legal AI App', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the header and main sections', () => {
    render(<Page />);
    act(() => {
      jest.advanceTimersByTime(4000); // skip splash screen
    });
    const headers = screen.getAllByText('Legal AI');
    expect(headers.length).toBeGreaterThan(0);
    expect(screen.getByText('Upload Primary Document')).toBeInTheDocument();
  });

  it('can switch tabs in the right sidebar', () => {
    render(<Page />);
    act(() => {
      jest.advanceTimersByTime(4000); // skip splash screen
    });
    
    // Switch to Compare Right Tab
    const compareTab = screen.getByText('Compare');
    fireEvent.click(compareTab);
    
    // Should now show Comparison instructions
    expect(screen.getByText(/Generate a clause-level diff table/i)).toBeInTheDocument();
  });

  it('opens modals for navigation items', async () => {
    render(<Page />);
    act(() => {
      jest.advanceTimersByTime(4000); // skip splash screen
    });
    
    // Open Pricing modal
    const pricingNav = screen.getByText('Pricing', { selector: 'button' });
    fireEvent.click(pricingNav);
    
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Great Pricing Plans')).toBeInTheDocument();
    
    // Close modal
    const closeBtn = screen.getByLabelText('Close modal');
    fireEvent.click(closeBtn);
    
    act(() => {
      jest.advanceTimersByTime(600); // Wait for the close animation timeout
    });
    
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('handles document upload successfully', async () => {
    const { processUploadedDocument } = require('../src/actions/document');
    processUploadedDocument.mockResolvedValueOnce({
      chunks: [{ id: "1", text: "Legal Contract Data", page: 1 }]
    });

    render(<Page />);
    act(() => { jest.advanceTimersByTime(4000); });

    const fileInput = screen.getAllByLabelText(/Upload Primary Document/i)[0];
    
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [new File(["pdf"], "test.pdf", { type: "application/pdf" })] } });
    });

    await waitFor(() => {
      expect(processUploadedDocument).toHaveBeenCalled();
      expect(screen.getByText("Legal Contract Data")).toBeInTheDocument();
    });
  });

  it('shows alert if upload fails', async () => {
    const { processUploadedDocument } = require('../src/actions/document');
    processUploadedDocument.mockResolvedValueOnce({
      error: "Upload failed"
    });
    
    // Mock window.alert
    const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});

    render(<Page />);
    act(() => { jest.advanceTimersByTime(4000); });

    const fileInput = screen.getAllByLabelText(/Upload Primary Document/i)[0];
    
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [new File(["pdf"], "test.pdf", { type: "application/pdf" })] } });
    });

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith("Upload failed");
    });
    alertMock.mockRestore();
  });

  it('can ask a question after document upload', async () => {
    const { processUploadedDocument, askQuestion } = require('../src/actions/document');
    processUploadedDocument.mockResolvedValueOnce({
      chunks: [{ id: "1", text: "Legal Contract Data", page: 1 }]
    });
    askQuestion.mockResolvedValueOnce({
      answer: { answer: "AI Answer", sources: ["1"] }
    });

    render(<Page />);
    act(() => { jest.advanceTimersByTime(4000); });

    const fileInput = screen.getAllByLabelText(/Upload Primary Document/i)[0];
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [new File(["pdf"], "test.pdf", { type: "application/pdf" })] } });
    });

    await waitFor(() => expect(screen.getByText("Legal Contract Data")).toBeInTheDocument());

    const input = screen.getByPlaceholderText(/Ask a question about Document A.../i);
    fireEvent.change(input, { target: { value: "What is the date?" } });
    
    const form = input.closest('form')!;
    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(askQuestion).toHaveBeenCalled();
      expect(screen.getByText("AI Answer")).toBeInTheDocument();
    });
  });

  it('can scan a document', async () => {
    const { processUploadedDocument, scanDocument } = require('../src/actions/document');
    processUploadedDocument.mockResolvedValueOnce({
      chunks: [{ id: "1", text: "Legal Contract Data", page: 1 }]
    });
    scanDocument.mockResolvedValueOnce({
      result: { summary: "Total 1 risk", flags: [{ type: 'RISK', description: 'High risk clause', chunkId: "1" }] }
    });

    render(<Page />);
    act(() => { jest.advanceTimersByTime(4000); });

    const fileInput = screen.getAllByLabelText(/Upload Primary Document/i)[0];
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [new File(["pdf"], "test.pdf", { type: "application/pdf" })] } });
    });

    await waitFor(() => expect(screen.getByText("Legal Contract Data")).toBeInTheDocument());

    const scanTab = screen.getByText('Scan');
    fireEvent.click(scanTab);

    const scanBtn = screen.getByRole('button', { name: /Run Risk & Obligation Audit/i });
    await act(async () => {
      fireEvent.click(scanBtn);
    });

    await waitFor(() => {
      expect(scanDocument).toHaveBeenCalled();
      expect(screen.getByText("High risk clause")).toBeInTheDocument();
    });
  });

  it('can compare two documents', async () => {
    const { processUploadedDocument, compareDocs } = require('../src/actions/document');
    processUploadedDocument.mockResolvedValueOnce({
      chunks: [{ id: "1", text: "Doc A", page: 1 }]
    }).mockResolvedValueOnce({
      chunks: [{ id: "1", text: "Doc B", page: 1 }]
    });
    compareDocs.mockResolvedValueOnce({
      result: { summary: "Diff", diffs: [{ status: 'ADDED', description: 'New clause', clauseBId: "1" }] }
    });

    render(<Page />);
    act(() => { jest.advanceTimersByTime(4000); });

    // Upload Doc A
    const fileInputA = screen.getAllByLabelText(/Upload Primary Document/i)[0];
    await act(async () => {
      fireEvent.change(fileInputA, { target: { files: [new File(["pdf"], "testA.pdf", { type: "application/pdf" })] } });
    });

    await waitFor(() => expect(screen.getByText("Doc A")).toBeInTheDocument());

    // Switch to Compare tab
    const compareTab = screen.getByText('Compare');
    fireEvent.click(compareTab);

    // Upload Doc B
    const fileInputB = screen.getAllByLabelText(/Upload Document B for comparison/i)[0];
    await act(async () => {
      fireEvent.change(fileInputB, { target: { files: [new File(["pdf"], "testB.pdf", { type: "application/pdf" })] } });
    });

    await waitFor(() => expect(screen.getByText("Doc B")).toBeInTheDocument());

    // Click Generate Clause Diff Table
    const compareBtn = screen.getByRole('button', { name: /Generate Clause Diff Table/i });
    await act(async () => {
      fireEvent.click(compareBtn);
    });

    await waitFor(() => {
      expect(compareDocs).toHaveBeenCalled();
      expect(screen.getByText("New clause")).toBeInTheDocument();
    });
  });
});
