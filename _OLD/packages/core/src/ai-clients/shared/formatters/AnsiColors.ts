/**
 * ANSI color codes for terminal output
 * Shared across all AI clients for consistent formatting
 */

export const AnsiColors = {
  // Reset
  reset: '\x1b[0m',
  
  // Styles
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  
  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  
  // Bright colors
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
  
  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
} as const;

export type AnsiColor = typeof AnsiColors[keyof typeof AnsiColors];

/**
 * Helper function to colorize text
 */
export function colorize(text: string, ...colors: AnsiColor[]): string {
  return `${colors.join('')}${text}${AnsiColors.reset}`;
}

/**
 * Common color combinations
 */
export const ColorThemes = {
  success: (text: string) => colorize(text, AnsiColors.green),
  error: (text: string) => colorize(text, AnsiColors.red),
  warning: (text: string) => colorize(text, AnsiColors.yellow),
  info: (text: string) => colorize(text, AnsiColors.cyan),
  muted: (text: string) => colorize(text, AnsiColors.gray),
  highlight: (text: string) => colorize(text, AnsiColors.bold, AnsiColors.brightWhite),
  addition: (text: string) => colorize(text, AnsiColors.green),
  deletion: (text: string) => colorize(text, AnsiColors.red),
} as const;