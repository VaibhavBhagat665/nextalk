/**
 * Design Tokens for NexTalk
 * 
 * This file contains all design tokens including colors, spacing, typography,
 * and other foundational design elements that ensure visual consistency
 * across the application.
 * 
 * Based on a 4px grid system and following modern design system principles.
 */

// ============================================================================
// COLOR TOKENS
// ============================================================================

/**
 * Neutral color palette for backgrounds, borders, and text
 * Provides granular scale from white to black
 */
export const neutralColors = {
  neutral50: "#FAFAFA",
  neutral100: "#F5F5F5",
  neutral200: "#E5E5E5",
  neutral300: "#D4D4D4",
  neutral400: "#A3A3A3",
  neutral500: "#737373",
  neutral600: "#525252",
  neutral700: "#404040",
  neutral800: "#262626",
  neutral900: "#171717",
} as const;

/**
 * Gold/accent color palette for primary actions and highlights
 * Provides warm, premium feel consistent with NexTalk branding
 */
export const goldColors = {
  gold50: "#FFFEF7",
  gold100: "#FFF9E0",
  gold200: "#FFF0B3",
  gold500: "#D4AF37",
  gold600: "#B8961A",
  gold700: "#9C7E0D",
} as const;

/**
 * Semantic colors for status messages and alerts
 * These convey meaning through color (success, warning, error, info)
 */
export const semanticColors = {
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",
} as const;

/**
 * Light theme color assignments
 * Maps semantic roles to specific color values
 */
export const lightTheme = {
  // Backgrounds
  background: {
    primary: neutralColors.neutral50,
    secondary: neutralColors.neutral100,
    tertiary: neutralColors.neutral200,
    elevated: "#FFFFFF",
    overlay: "rgba(0, 0, 0, 0.5)",
  },
  
  // Text colors
  text: {
    primary: neutralColors.neutral900,
    secondary: neutralColors.neutral600,
    tertiary: neutralColors.neutral500,
    disabled: neutralColors.neutral400,
    inverse: "#FFFFFF",
  },
  
  // Border colors
  border: {
    default: neutralColors.neutral200,
    subtle: neutralColors.neutral100,
    strong: neutralColors.neutral300,
    focus: goldColors.gold500,
  },
  
  // Accent/primary colors
  accent: {
    primary: goldColors.gold500,
    primaryHover: goldColors.gold600,
    primaryActive: goldColors.gold700,
    primarySubtle: goldColors.gold100,
  },
  
  // Status colors
  status: {
    success: semanticColors.success,
    warning: semanticColors.warning,
    error: semanticColors.error,
    info: semanticColors.info,
  },
} as const;

/**
 * Dark theme color assignments
 * Optimized for reduced eye strain in low-light environments
 */
export const darkTheme = {
  // Backgrounds
  background: {
    primary: neutralColors.neutral900,
    secondary: neutralColors.neutral800,
    tertiary: neutralColors.neutral700,
    elevated: neutralColors.neutral800,
    overlay: "rgba(0, 0, 0, 0.7)",
  },
  
  // Text colors
  text: {
    primary: neutralColors.neutral50,
    secondary: neutralColors.neutral300,
    tertiary: neutralColors.neutral400,
    disabled: neutralColors.neutral600,
    inverse: neutralColors.neutral900,
  },
  
  // Border colors
  border: {
    default: neutralColors.neutral700,
    subtle: neutralColors.neutral800,
    strong: neutralColors.neutral600,
    focus: goldColors.gold500,
  },
  
  // Accent/primary colors
  accent: {
    primary: goldColors.gold500,
    primaryHover: goldColors.gold600,
    primaryActive: goldColors.gold700,
    primarySubtle: "rgba(212, 175, 55, 0.1)",
  },
  
  // Status colors
  status: {
    success: semanticColors.success,
    warning: semanticColors.warning,
    error: semanticColors.error,
    info: semanticColors.info,
  },
} as const;

/**
 * Combined color tokens with theme support
 */
export const colors = {
  ...neutralColors,
  ...goldColors,
  ...semanticColors,
  light: lightTheme,
  dark: darkTheme,
} as const;

// ============================================================================
// SPACING TOKENS (4px Grid System)
// ============================================================================

/**
 * Spacing scale based on 4px grid
 * Use these values for margins, padding, gaps, and positioning
 * 
 * xs: 4px   - Tight spacing within components
 * sm: 8px   - Small spacing between related elements
 * md: 16px  - Standard spacing between components
 * lg: 24px  - Large spacing for section breaks
 * xl: 32px  - Extra large spacing for major sections
 * 2xl: 48px - Very large spacing for page-level divisions
 * 3xl: 64px - Maximum spacing for hero sections
 */
export const spacing = {
  xs: "0.25rem",   // 4px
  sm: "0.5rem",    // 8px
  md: "1rem",      // 16px
  lg: "1.5rem",    // 24px
  xl: "2rem",      // 32px
  "2xl": "3rem",   // 48px
  "3xl": "4rem",   // 64px
} as const;

/**
 * Numeric spacing values for calculations
 * Use when you need to perform arithmetic with spacing values
 */
export const spacingPx = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
  "3xl": 64,
} as const;

// ============================================================================
// TYPOGRAPHY TOKENS
// ============================================================================

/**
 * Font family definitions
 */
export const fontFamily = {
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Courier New', monospace",
} as const;

/**
 * Font size scale
 * Provides harmonious typographic hierarchy
 */
export const fontSize = {
  xs: "0.75rem",    // 12px - Small labels, captions
  sm: "0.875rem",   // 14px - Secondary text, input fields
  base: "1rem",     // 16px - Body text (default)
  lg: "1.125rem",   // 18px - Emphasized body text
  xl: "1.25rem",    // 20px - Small headings
  "2xl": "1.5rem",  // 24px - Medium headings
  "3xl": "1.875rem",// 30px - Large headings
  "4xl": "2.25rem", // 36px - Extra large headings, hero text
} as const;

/**
 * Font weight scale
 * Provides different text emphases
 */
export const fontWeight = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

/**
 * Line height tokens
 * Optimized for readability at different text sizes
 */
export const lineHeight = {
  tight: 1.25,      // For large headings
  snug: 1.375,      // For small headings
  normal: 1.5,      // For body text (default)
  relaxed: 1.625,   // For emphasized body text
  loose: 2,         // For large body text
} as const;

/**
 * Letter spacing tokens
 * Subtle adjustments for different text styles
 */
export const letterSpacing = {
  tighter: "-0.05em",
  tight: "-0.025em",
  normal: "0",
  wide: "0.025em",
  wider: "0.05em",
  widest: "0.1em",
} as const;

// ============================================================================
// BORDER RADIUS TOKENS
// ============================================================================

/**
 * Border radius scale
 * Provides consistent rounded corners throughout the app
 */
export const borderRadius = {
  none: "0",
  sm: "0.25rem",    // 4px - Subtle rounding
  md: "0.5rem",     // 8px - Standard buttons, inputs
  lg: "0.75rem",    // 12px - Cards, modals
  xl: "1rem",       // 16px - Large cards
  "2xl": "1.5rem",  // 24px - Very large containers
  full: "9999px",   // Fully rounded (pills, avatars)
} as const;

// ============================================================================
// SHADOW TOKENS
// ============================================================================

/**
 * Box shadow scale
 * Provides elevation hierarchy
 */
export const boxShadow = {
  none: "none",
  sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
  lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
  xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
  "2xl": "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
  inner: "inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)",
} as const;

// ============================================================================
// Z-INDEX TOKENS
// ============================================================================

/**
 * Z-index scale
 * Provides consistent layering for overlapping elements
 */
export const zIndex = {
  hide: -1,
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  fixed: 1200,
  modalBackdrop: 1300,
  modal: 1400,
  popover: 1500,
  tooltip: 1600,
} as const;

// ============================================================================
// TRANSITION TOKENS
// ============================================================================

/**
 * Transition duration scale
 * Provides consistent animation timing
 */
export const transitionDuration = {
  fast: "150ms",
  base: "250ms",
  slow: "350ms",
  slower: "500ms",
} as const;

/**
 * Transition timing functions
 * Easing curves for natural motion
 */
export const transitionTimingFunction = {
  easeIn: "cubic-bezier(0.4, 0, 1, 1)",
  easeOut: "cubic-bezier(0, 0, 0.2, 1)",
  easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
  sharp: "cubic-bezier(0.4, 0, 0.6, 1)",
} as const;

/**
 * Common transition presets
 * Ready-to-use transition strings
 */
export const transition = {
  fast: `all ${transitionDuration.fast} ${transitionTimingFunction.easeInOut}`,
  base: `all ${transitionDuration.base} ${transitionTimingFunction.easeInOut}`,
  slow: `all ${transitionDuration.slow} ${transitionTimingFunction.easeInOut}`,
} as const;

// ============================================================================
// BREAKPOINT TOKENS
// ============================================================================

/**
 * Responsive breakpoints
 * Mobile-first approach
 */
export const breakpoints = {
  sm: "640px",    // Small devices (landscape phones)
  md: "768px",    // Medium devices (tablets)
  lg: "1024px",   // Large devices (desktops)
  xl: "1280px",   // Extra large devices (large desktops)
  "2xl": "1536px",// 2X large devices (ultra-wide monitors)
} as const;

/**
 * Media query helpers
 * Use these for responsive styles
 */
export const mediaQuery = {
  sm: `@media (min-width: ${breakpoints.sm})`,
  md: `@media (min-width: ${breakpoints.md})`,
  lg: `@media (min-width: ${breakpoints.lg})`,
  xl: `@media (min-width: ${breakpoints.xl})`,
  "2xl": `@media (min-width: ${breakpoints["2xl"]})`,
} as const;

// ============================================================================
// EXPORT TYPES
// ============================================================================

/**
 * Type definitions for design tokens
 * Provides autocomplete and type safety
 */
export type ColorKey = keyof typeof colors;
export type SpacingKey = keyof typeof spacing;
export type FontSizeKey = keyof typeof fontSize;
export type FontWeightKey = keyof typeof fontWeight;
export type BorderRadiusKey = keyof typeof borderRadius;
export type BoxShadowKey = keyof typeof boxShadow;
export type ZIndexKey = keyof typeof zIndex;
export type BreakpointKey = keyof typeof breakpoints;
export type Theme = typeof lightTheme;

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

/**
 * Complete design token system
 * Import this for access to all design tokens
 */
const designTokens = {
  colors,
  spacing,
  spacingPx,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing,
  borderRadius,
  boxShadow,
  zIndex,
  transitionDuration,
  transitionTimingFunction,
  transition,
  breakpoints,
  mediaQuery,
} as const;

export default designTokens;
