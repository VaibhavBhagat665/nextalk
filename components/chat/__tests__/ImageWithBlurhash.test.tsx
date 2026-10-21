/**
 * ImageWithBlurhash Component Tests
 * 
 * Tests for task 49.2: Implement image rendering in messages
 * 
 * Requirements verified:
 * 1. Fixed aspect ratio containers
 * 2. Blurhash placeholder during load
 * 3. Click to open lightbox
 * 
 * Validates: Requirements 6.8 (Property 22: Image Aspect Ratio Preservation)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImageWithBlurhash, ImageLightbox } from '../ImageWithBlurhash';

describe('ImageWithBlurhash', () => {
  const mockProps = {
    src: 'https://example.com/image.jpg',
    alt: 'Test image',
    width: 800,
    height: 600,
  };

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  describe('Fixed Aspect Ratio Containers', () => {
    it('should render with fixed aspect ratio based on width and height props', () => {
      const { container } = render(<ImageWithBlurhash {...mockProps} />);
      
      const imageContainer = container.querySelector('.image-with-blurhash') as HTMLElement;
      expect(imageContainer).toBeInTheDocument();
      
      // Verify aspect ratio is preserved (width <= maxWidth)
      const maxWidth = 400;
      const aspectRatio = mockProps.height / mockProps.width; // 600/800 = 0.75
      const expectedHeight = maxWidth * aspectRatio; // 400 * 0.75 = 300
      
      expect(imageContainer.style.width).toBe('400px');
      expect(imageContainer.style.height).toBe('300px');
    });

    it('should maintain aspect ratio for portrait images', () => {
      const portraitProps = {
        src: 'https://example.com/portrait.jpg',
        alt: 'Portrait',
        width: 400,
        height: 800,
      };
      
      const { container } = render(<ImageWithBlurhash {...portraitProps} />);
      
      const imageContainer = container.querySelector('.image-with-blurhash') as HTMLElement;
      const aspectRatio = portraitProps.height / portraitProps.width; // 800/400 = 2
      const expectedHeight = 400 * aspectRatio; // 400 * 2 = 800
      
      expect(imageContainer.style.width).toBe('400px');
      expect(imageContainer.style.height).toBe('800px');
    });

    it('should not exceed maxWidth even for very large images', () => {
      const largeProps = {
        src: 'https://example.com/large.jpg',
        alt: 'Large image',
        width: 2000,
        height: 1500,
      };
      
      const { container } = render(<ImageWithBlurhash {...largeProps} />);
      
      const imageContainer = container.querySelector('.image-with-blurhash') as HTMLElement;
      
      // Should be clamped to maxWidth (400px)
      expect(imageContainer.style.width).toBe('400px');
      
      // Height should maintain aspect ratio
      const aspectRatio = largeProps.height / largeProps.width; // 1500/2000 = 0.75
      const expectedHeight = 400 * aspectRatio; // 400 * 0.75 = 300
      expect(imageContainer.style.height).toBe('300px');
    });

    it('should use actual width for images smaller than maxWidth', () => {
      const smallProps = {
        src: 'https://example.com/small.jpg',
        alt: 'Small image',
        width: 200,
        height: 150,
      };
      
      const { container } = render(<ImageWithBlurhash {...smallProps} />);
      
      const imageContainer = container.querySelector('.image-with-blurhash') as HTMLElement;
      
      // Should use actual width since it's less than maxWidth
      expect(imageContainer.style.width).toBe('200px');
      expect(imageContainer.style.height).toBe('150px');
    });
  });

  describe('Blurhash Placeholder During Load', () => {
    it('should render blurhash placeholder when blurhash is provided', () => {
      const propsWithBlurhash = {
        ...mockProps,
        blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
      };
      
      const { container } = render(<ImageWithBlurhash {...propsWithBlurhash} />);
      
      // Blurhash placeholder should be present initially
      const placeholder = container.querySelector('.blurhash-placeholder');
      expect(placeholder).toBeInTheDocument();
    });

    it('should hide blurhash placeholder after image loads', async () => {
      const propsWithBlurhash = {
        ...mockProps,
        blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
      };
      
      const { container } = render(<ImageWithBlurhash {...propsWithBlurhash} />);
      
      const image = container.querySelector('img');
      expect(image).toBeInTheDocument();
      
      // Simulate image load
      fireEvent.load(image!);
      
      // Wait for state update
      await waitFor(() => {
        const loadedImage = container.querySelector('.image--loaded');
        expect(loadedImage).toBeInTheDocument();
      });
    });

    it('should not render placeholder when blurhash is not provided', () => {
      const { container } = render(<ImageWithBlurhash {...mockProps} />);
      
      const placeholder = container.querySelector('.blurhash-placeholder');
      expect(placeholder).not.toBeInTheDocument();
    });

    it('should handle invalid blurhash gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const propsWithInvalidBlurhash = {
        ...mockProps,
        blurhash: 'invalid-blurhash',
      };
      
      render(<ImageWithBlurhash {...propsWithInvalidBlurhash} />);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to decode blurhash:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Click to Open Lightbox', () => {
    it('should call onClick handler when image is clicked', () => {
      const onClickMock = vi.fn();
      
      const { container } = render(
        <ImageWithBlurhash {...mockProps} onClick={onClickMock} />
      );
      
      const imageContainer = container.querySelector('.image-with-blurhash');
      fireEvent.click(imageContainer!);
      
      expect(onClickMock).toHaveBeenCalledTimes(1);
    });

    it('should display zoom overlay when onClick is provided', () => {
      const onClickMock = vi.fn();
      
      const { container } = render(
        <ImageWithBlurhash {...mockProps} onClick={onClickMock} />
      );
      
      const zoomOverlay = container.querySelector('.zoom-overlay');
      expect(zoomOverlay).toBeInTheDocument();
    });

    it('should not display zoom overlay when onClick is not provided', () => {
      const { container } = render(<ImageWithBlurhash {...mockProps} />);
      
      const zoomOverlay = container.querySelector('.zoom-overlay');
      expect(zoomOverlay).not.toBeInTheDocument();
    });

    it('should have pointer cursor when onClick is provided', () => {
      const onClickMock = vi.fn();
      
      const { container } = render(
        <ImageWithBlurhash {...mockProps} onClick={onClickMock} />
      );
      
      const imageContainer = container.querySelector('.image-with-blurhash') as HTMLElement;
      expect(imageContainer.style.cursor).toBe('pointer');
    });

    it('should have default cursor when onClick is not provided', () => {
      const { container } = render(<ImageWithBlurhash {...mockProps} />);
      
      const imageContainer = container.querySelector('.image-with-blurhash') as HTMLElement;
      expect(imageContainer.style.cursor).toBe('default');
    });
  });

  describe('Additional Features', () => {
    it('should apply custom className when provided', () => {
      const { container } = render(
        <ImageWithBlurhash {...mockProps} className="custom-class" />
      );
      
      const imageContainer = container.querySelector('.custom-class');
      expect(imageContainer).toBeInTheDocument();
    });

    it('should render image with correct attributes', () => {
      const { container } = render(<ImageWithBlurhash {...mockProps} />);
      
      const image = container.querySelector('img');
      expect(image).toHaveAttribute('src', mockProps.src);
      expect(image).toHaveAttribute('alt', mockProps.alt);
    });
  });
});

describe('ImageLightbox', () => {
  const mockProps = {
    src: 'https://example.com/image.jpg',
    alt: 'Test image',
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render lightbox with image', () => {
    render(<ImageLightbox {...mockProps} />);
    
    expect(screen.getByAltText('Test image')).toBeInTheDocument();
    expect(screen.getByText('Test image')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    const { container } = render(<ImageLightbox {...mockProps} />);
    
    const closeButton = container.querySelector('button[title="Close (Esc)"]');
    fireEvent.click(closeButton!);
    
    expect(mockProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when overlay is clicked', () => {
    const { container } = render(<ImageLightbox {...mockProps} />);
    
    const overlay = container.querySelector('.lightbox-overlay');
    fireEvent.click(overlay!);
    
    expect(mockProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('should not call onClose when content is clicked', () => {
    const { container } = render(<ImageLightbox {...mockProps} />);
    
    const content = container.querySelector('.lightbox-content');
    fireEvent.click(content!);
    
    expect(mockProps.onClose).not.toHaveBeenCalled();
  });

  it('should call onClose when Escape key is pressed', () => {
    render(<ImageLightbox {...mockProps} />);
    
    fireEvent.keyDown(document, { key: 'Escape' });
    
    expect(mockProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('should render download button', () => {
    const { container } = render(<ImageLightbox {...mockProps} />);
    
    const downloadButton = container.querySelector('button[title="Download"]');
    expect(downloadButton).toBeInTheDocument();
  });

  it('should prevent body scroll when lightbox is open', () => {
    const { unmount } = render(<ImageLightbox {...mockProps} />);
    
    expect(document.body.style.overflow).toBe('hidden');
    
    unmount();
    
    expect(document.body.style.overflow).toBe('');
  });
});
