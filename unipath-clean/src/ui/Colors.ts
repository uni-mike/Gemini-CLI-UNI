/**
 * Color theme for UNIPATH CLI
 * Based on the original color scheme
 */

export interface ColorsTheme {
  type: 'dark' | 'light';
  Foreground: string;
  Background: string;
  LightBlue: string;
  AccentBlue: string;
  AccentPurple: string;
  AccentCyan: string;
  AccentGreen: string;
  AccentYellow: string;
  AccentRed: string;
  DiffAdded: string;
  DiffRemoved: string;
  Comment: string;
  Gray: string;
  GradientColors: string[] | null;
}

// Default dark theme
const darkTheme: ColorsTheme = {
  type: 'dark',
  Foreground: '#FFFFFF',
  Background: '#000000',
  LightBlue: '#87CEEB',
  AccentBlue: '#3B82F6',
  AccentPurple: '#8B5CF6',
  AccentCyan: '#06B6D4',
  AccentGreen: '#10B981',
  AccentYellow: '#F59E0B',
  AccentRed: '#EF4444',
  DiffAdded: '#10B981',
  DiffRemoved: '#EF4444',
  Comment: '#6B7280',
  Gray: '#9CA3AF',
  GradientColors: ['#3B82F6', '#8B5CF6', '#06B6D4'] // Blue to purple to cyan
};

export const Colors: ColorsTheme = darkTheme;