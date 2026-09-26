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
});
