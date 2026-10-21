/**
 * TypingIndicator Component Tests
 * 
 * Tests for the typing indicator UI component that displays:
 * - User avatars (up to 3)
 * - Animated typing dots
 * - Auto-hide after 5 seconds
 * - Contextual text based on number of users
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import TypingIndicator from '../TypingIndicator';

describe('TypingIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not render when no users are typing', () => {
    const { container } = render(<TypingIndicator typingUsers={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render with single user typing', () => {
    const typingUsers = [
      { userId: '1', username: 'Alice' }
    ];
    
    render(<TypingIndicator typingUsers={typingUsers} />);
    expect(screen.getByText('Alice is typing...')).toBeInTheDocument();
  });

  it('should render with two users typing', () => {
    const typingUsers = [
      { userId: '1', username: 'Alice' },
      { userId: '2', username: 'Bob' }
    ];
    
    render(<TypingIndicator typingUsers={typingUsers} />);
    expect(screen.getByText('Alice and Bob are typing...')).toBeInTheDocument();
  });

  it('should render with multiple users typing', () => {
    const typingUsers = [
      { userId: '1', username: 'Alice' },
      { userId: '2', username: 'Bob' },
      { userId: '3', username: 'Charlie' }
    ];
    
    render(<TypingIndicator typingUsers={typingUsers} />);
    expect(screen.getByText('Alice and 2 others are typing...')).toBeInTheDocument();
  });

  it('should auto-hide after 5 seconds', async () => {
    const typingUsers = [
      { userId: '1', username: 'Alice' }
    ];
    
    const { rerender } = render(<TypingIndicator typingUsers={typingUsers} />);
    expect(screen.getByText('Alice is typing...')).toBeInTheDocument();
    
    // Fast-forward time by 5 seconds
    vi.advanceTimersByTime(5000);
    
    // Wait for state update
    await waitFor(() => {
      const element = screen.queryByText('Alice is typing...');
      expect(element).not.toBeInTheDocument();
    });
  });

  it('should display up to 3 avatars', () => {
    const typingUsers = [
      { userId: '1', username: 'Alice', imageUrl: 'https://example.com/alice.jpg' },
      { userId: '2', username: 'Bob', imageUrl: 'https://example.com/bob.jpg' },
      { userId: '3', username: 'Charlie', imageUrl: 'https://example.com/charlie.jpg' },
      { userId: '4', username: 'Dave', imageUrl: 'https://example.com/dave.jpg' }
    ];
    
    const { container } = render(<TypingIndicator typingUsers={typingUsers} />);
    
    // Check for typing avatars container
    const avatarsContainer = container.querySelector('.typing-avatars');
    expect(avatarsContainer).toBeInTheDocument();
    
    // Check that we have 3 avatar elements plus 1 count element (+1)
    const avatars = container.querySelectorAll('.typing-avatar');
    expect(avatars.length).toBe(4); // 3 avatars + 1 count indicator
  });

  it('should show fallback initials when no imageUrl provided', () => {
    const typingUsers = [
      { userId: '1', username: 'Alice Anderson' }
    ];
    
    const { container } = render(<TypingIndicator typingUsers={typingUsers} />);
    
    // Check for fallback avatar
    const fallback = container.querySelector('.avatar-fallback');
    expect(fallback).toBeInTheDocument();
  });

  it('should reset timer when typing users list changes', async () => {
    const { rerender } = render(
      <TypingIndicator typingUsers={[{ userId: '1', username: 'Alice' }]} />
    );
    
    // Fast-forward 3 seconds
    vi.advanceTimersByTime(3000);
    
    // User list changes (someone else starts typing)
    rerender(
      <TypingIndicator typingUsers={[
        { userId: '1', username: 'Alice' },
        { userId: '2', username: 'Bob' }
      ]} />
    );
    
    // Fast-forward another 3 seconds (total 6 seconds, but timer should have reset)
    vi.advanceTimersByTime(3000);
    
    // Indicator should still be visible since timer was reset
    expect(screen.getByText('Alice and Bob are typing...')).toBeInTheDocument();
  });
});
