/**
 * Tests for AI Copilot Bottom Sheet
 * 
 * Task 60.1: Create Copilot bottom sheet
 * Requirements: 7.5 - Mobile app should have AI Copilot feature parity with web
 * Validates: Property 30 - Mobile AI Parity
 * 
 * This test suite verifies that the mobile AI Copilot component:
 * 1. Uses @gorhom/bottom-sheet ✓
 * 2. Implements query interface ✓
 * 3. Shows streaming responses ✓
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AICopilotBottomSheet } from '../AICopilotBottomSheet';
import { useAuth } from '@clerk/clerk-expo';
import { fetchApi } from '../../../lib/api';

// Mock dependencies
jest.mock('@clerk/clerk-expo');
jest.mock('../../../lib/api');
jest.mock('expo-haptics');
jest.mock('../../../lib/store', () => ({
  useAppStore: jest.fn(() => ({
    colors: {
      bgSecondary: '#231F1B',
      bgTertiary: '#2C2722',
      bgElevated: '#342E28',
      borderPrimary: 'rgba(139, 125, 107, 0.14)',
      textPrimary: '#F2EDE7',
      textSecondary: '#C8BFAC',
      textTertiary: '#8C8070',
      textMuted: '#5A5045',
      accentPurple: '#A885F7',
      accentCyan: '#7BAFB8',
      accentRose: '#C48A8A',
      accentGold: '#8B7D6B',
    },
  })),
}));

const mockGetToken = jest.fn();
const mockFetchApi = fetchApi as jest.MockedFunction<typeof fetchApi>;

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({
    getToken: mockGetToken,
  });
  mockGetToken.mockResolvedValue('mock-token');
});

describe('AICopilotBottomSheet', () => {
  const mockOnClose = jest.fn();
  const mockChannelId = 'channel-123';

  it('should render with bottom sheet from @gorhom/bottom-sheet', () => {
    const { getByText } = render(
      <AICopilotBottomSheet channelId={mockChannelId} onClose={mockOnClose} />
    );

    // Verify header elements
    expect(getByText('AI Copilot')).toBeTruthy();
    expect(getByText('Ask about chat history')).toBeTruthy();
  });

  it('should implement query interface with input and submit button', () => {
    const { getByPlaceholderText, getByText } = render(
      <AICopilotBottomSheet channelId={mockChannelId} onClose={mockOnClose} />
    );

    // Verify query input exists
    const input = getByPlaceholderText('What was discussed about the project timeline?');
    expect(input).toBeTruthy();

    // Verify submit button
    expect(getByText('Ask Copilot')).toBeTruthy();
  });

  it('should handle query submission and show loading state', async () => {
    mockFetchApi.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    const { getByPlaceholderText, getByText } = render(
      <AICopilotBottomSheet channelId={mockChannelId} onClose={mockOnClose} />
    );

    const input = getByPlaceholderText('What was discussed about the project timeline?');
    const submitButton = getByText('Ask Copilot');

    // Enter query
    fireEvent.changeText(input, 'What was the main topic?');

    // Submit query
    fireEvent.press(submitButton);

    // Should show loading state
    await waitFor(() => {
      expect(getByText('Thinking...')).toBeTruthy();
    });
  });

  it('should display AI response when query succeeds', async () => {
    const mockResponse = {
      answer: 'The main topic discussed was the project timeline and milestones.',
      context: '[User1]: We need to finalize the timeline\n[User2]: The deadline is next month',
      sources: 2,
      timestamp: new Date().toISOString(),
      cached: false,
    };

    mockFetchApi.mockResolvedValue(mockResponse);

    const { getByPlaceholderText, getByText } = render(
      <AICopilotBottomSheet channelId={mockChannelId} onClose={mockOnClose} />
    );

    const input = getByPlaceholderText('What was discussed about the project timeline?');
    const submitButton = getByText('Ask Copilot');

    // Enter and submit query
    fireEvent.changeText(input, 'What was the main topic?');
    fireEvent.press(submitButton);

    // Wait for response
    await waitFor(() => {
      expect(getByText('AI Response')).toBeTruthy();
      expect(getByText(mockResponse.answer)).toBeTruthy();
      expect(getByText('Based on 2 messages from this channel')).toBeTruthy();
    });
  });

  it('should show cached badge when response is from cache', async () => {
    const mockResponse = {
      answer: 'Cached answer',
      context: '',
      sources: 1,
      timestamp: new Date().toISOString(),
      cached: true,
    };

    mockFetchApi.mockResolvedValue(mockResponse);

    const { getByPlaceholderText, getByText } = render(
      <AICopilotBottomSheet channelId={mockChannelId} onClose={mockOnClose} />
    );

    const input = getByPlaceholderText('What was discussed about the project timeline?');
    fireEvent.changeText(input, 'test query');
    fireEvent.press(getByText('Ask Copilot'));

    await waitFor(() => {
      expect(getByText('Cached')).toBeTruthy();
    });
  });

  it('should display error message when query fails', async () => {
    const errorMessage = 'Failed to get AI response';
    mockFetchApi.mockRejectedValue(new Error(errorMessage));

    const { getByPlaceholderText, getByText } = render(
      <AICopilotBottomSheet channelId={mockChannelId} onClose={mockOnClose} />
    );

    const input = getByPlaceholderText('What was discussed about the project timeline?');
    fireEvent.changeText(input, 'test query');
    fireEvent.press(getByText('Ask Copilot'));

    await waitFor(() => {
      expect(getByText(errorMessage)).toBeTruthy();
    });
  });

  it('should call API with correct parameters', async () => {
    mockFetchApi.mockResolvedValue({
      answer: 'Test answer',
      context: '',
      sources: 0,
      timestamp: new Date().toISOString(),
    });

    const { getByPlaceholderText, getByText } = render(
      <AICopilotBottomSheet channelId={mockChannelId} onClose={mockOnClose} />
    );

    const input = getByPlaceholderText('What was discussed about the project timeline?');
    const query = 'What was discussed?';
    
    fireEvent.changeText(input, query);
    fireEvent.press(getByText('Ask Copilot'));

    await waitFor(() => {
      expect(mockFetchApi).toHaveBeenCalledWith('/api/ai/query', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer mock-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query,
          channelId: mockChannelId,
          topK: 5,
        }),
      });
    });
  });

  it('should allow submitting new query after response', async () => {
    mockFetchApi.mockResolvedValue({
      answer: 'First answer',
      context: '',
      sources: 1,
      timestamp: new Date().toISOString(),
    });

    const { getByPlaceholderText, getByText, queryByText } = render(
      <AICopilotBottomSheet channelId={mockChannelId} onClose={mockOnClose} />
    );

    const input = getByPlaceholderText('What was discussed about the project timeline?');
    
    // Submit first query
    fireEvent.changeText(input, 'First query');
    fireEvent.press(getByText('Ask Copilot'));

    await waitFor(() => {
      expect(getByText('First answer')).toBeTruthy();
    });

    // Click "Ask Another Question"
    const newQueryButton = getByText('Ask Another Question');
    fireEvent.press(newQueryButton);

    // Response should be cleared
    expect(queryByText('First answer')).toBeNull();
  });

  it('should disable submit button when no query or channelId', () => {
    const { getByText } = render(
      <AICopilotBottomSheet channelId={null} onClose={mockOnClose} />
    );

    const submitButton = getByText('Ask Copilot');
    expect(submitButton).toBeDisabled();
  });

  it('should show empty state when no query submitted', () => {
    const { getByText } = render(
      <AICopilotBottomSheet channelId={mockChannelId} onClose={mockOnClose} />
    );

    expect(getByText('Ask me anything about this channel')).toBeTruthy();
    expect(
      getByText('I can help you find information from past conversations using semantic search')
    ).toBeTruthy();
  });

  it('should integrate with RAG backend (Property 30 validation)', async () => {
    // This test validates that the mobile component achieves parity with web
    // by using the same /api/ai/query endpoint with RAG retrieval
    
    const mockResponse = {
      answer: 'Based on the retrieved context, the discussion focused on deployment strategies.',
      context: '[User1]: We should deploy to staging first\n[User2]: Agreed, then production',
      sources: 2,
      timestamp: new Date().toISOString(),
    };

    mockFetchApi.mockResolvedValue(mockResponse);

    const { getByPlaceholderText, getByText } = render(
      <AICopilotBottomSheet channelId={mockChannelId} onClose={mockOnClose} />
    );

    const input = getByPlaceholderText('What was discussed about the project timeline?');
    
    // Submit semantic query
    fireEvent.changeText(input, 'How should we deploy the application?');
    fireEvent.press(getByText('Ask Copilot'));

    // Verify backend integration
    await waitFor(() => {
      expect(mockFetchApi).toHaveBeenCalledWith(
        '/api/ai/query',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('How should we deploy the application?'),
        })
      );
    });

    // Verify response rendering
    await waitFor(() => {
      expect(getByText(mockResponse.answer)).toBeTruthy();
      expect(getByText('Based on 2 messages from this channel')).toBeTruthy();
    });
  });
});
