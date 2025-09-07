/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export enum DetectedIde {
  Devin = 'devin',
  Replit = 'replit',
  Cursor = 'cursor',
  CloudShell = 'cloudshell',
  Codespaces = 'codespaces',
  FirebaseStudio = 'firebasestudio',
  Trae = 'trae',
  VSCode = 'vscode',
  VSCodeFork = 'vscodefork',
  PyCharm = 'pycharm',
  WebStorm = 'webstorm',
  IntelliJIDEA = 'intellijidea',
  JetBrainsIDE = 'jetbrainsgeneric',
}

export interface IdeInfo {
  displayName: string;
}

export function getIdeInfo(ide: DetectedIde): IdeInfo {
  switch (ide) {
    case DetectedIde.Devin:
      return {
        displayName: 'Devin',
      };
    case DetectedIde.Replit:
      return {
        displayName: 'Replit',
      };
    case DetectedIde.Cursor:
      return {
        displayName: 'Cursor',
      };
    case DetectedIde.CloudShell:
      return {
        displayName: 'Cloud Shell',
      };
    case DetectedIde.Codespaces:
      return {
        displayName: 'GitHub Codespaces',
      };
    case DetectedIde.FirebaseStudio:
      return {
        displayName: 'Firebase Studio',
      };
    case DetectedIde.Trae:
      return {
        displayName: 'Trae',
      };
    case DetectedIde.VSCode:
      return {
        displayName: 'VS Code',
      };
    case DetectedIde.VSCodeFork:
      return {
        displayName: 'IDE',
      };
    case DetectedIde.PyCharm:
      return {
        displayName: 'PyCharm',
      };
    case DetectedIde.WebStorm:
      return {
        displayName: 'WebStorm',
      };
    case DetectedIde.IntelliJIDEA:
      return {
        displayName: 'IntelliJ IDEA',
      };
    case DetectedIde.JetBrainsIDE:
      return {
        displayName: 'JetBrains IDE',
      };
    default: {
      // This ensures that if a new IDE is added to the enum, we get a compile-time error.
      const exhaustiveCheck: never = ide;
      return exhaustiveCheck;
    }
  }
}

export function detectIdeFromEnv(): DetectedIde {
  if (process.env['__COG_BASHRC_SOURCED']) {
    return DetectedIde.Devin;
  }
  if (process.env['REPLIT_USER']) {
    return DetectedIde.Replit;
  }
  if (process.env['CURSOR_TRACE_ID']) {
    return DetectedIde.Cursor;
  }
  if (process.env['CODESPACES']) {
    return DetectedIde.Codespaces;
  }
  if (process.env['EDITOR_IN_CLOUD_SHELL'] || process.env['CLOUD_SHELL']) {
    return DetectedIde.CloudShell;
  }
  if (process.env['TERM_PRODUCT'] === 'Trae') {
    return DetectedIde.Trae;
  }
  if (process.env['MONOSPACE_ENV']) {
    return DetectedIde.FirebaseStudio;
  }
  
  // JetBrains IDEs detection
  if (process.env['PYCHARM_HOSTED'] || process.env['PYCHARM_DISPLAY_NAME']) {
    return DetectedIde.PyCharm;
  }
  if (process.env['WEBSTORM_HOSTED'] || process.env['WEBIDE_PRODUCT']) {
    return DetectedIde.WebStorm;
  }
  if (process.env['IDEA_INITIAL_DIRECTORY'] || process.env['INTELLIJ_ENVIRONMENT_READER']) {
    return DetectedIde.IntelliJIDEA;
  }
  // Generic JetBrains IDE detection
  if (process.env['JETBRAINS_IDE'] || 
      process.env['TERMINAL_INTEGRATION_COMMAND'] || 
      process.env['__INTELLIJ_COMMAND_HISTFILE__'] ||
      process.env['IDE_PROJECT_ROOTS']) {
    return DetectedIde.JetBrainsIDE;
  }
  
  return DetectedIde.VSCode;
}

function verifyVSCode(
  ide: DetectedIde,
  ideProcessInfo: {
    pid: number;
    command: string;
  },
): DetectedIde {
  if (ide !== DetectedIde.VSCode) {
    return ide;
  }
  if (ideProcessInfo.command.toLowerCase().includes('code')) {
    return DetectedIde.VSCode;
  }
  return DetectedIde.VSCodeFork;
}

function verifyJetBrainsIDE(
  ide: DetectedIde,
  ideProcessInfo: {
    pid: number;
    command: string;
  },
): DetectedIde {
  // If it's not a JetBrains IDE, return as-is
  if (![DetectedIde.PyCharm, DetectedIde.WebStorm, DetectedIde.IntelliJIDEA, DetectedIde.JetBrainsIDE].includes(ide)) {
    return ide;
  }
  
  const command = ideProcessInfo.command.toLowerCase();
  
  // Try to detect specific JetBrains IDE from command
  if (command.includes('pycharm')) {
    return DetectedIde.PyCharm;
  }
  if (command.includes('webstorm')) {
    return DetectedIde.WebStorm;
  }
  if (command.includes('idea') || command.includes('intellij')) {
    return DetectedIde.IntelliJIDEA;
  }
  
  // If we can't determine the specific IDE, return the generic one or the detected one
  return ide === DetectedIde.JetBrainsIDE ? DetectedIde.JetBrainsIDE : ide;
}

export function detectIde(ideProcessInfo: {
  pid: number;
  command: string;
}): DetectedIde | undefined {
  const ide = detectIdeFromEnv();
  
  // For VS Code-based IDEs, verify with TERM_PROGRAM
  if (ide === DetectedIde.VSCode || ide === DetectedIde.VSCodeFork) {
    if (process.env['TERM_PROGRAM'] !== 'vscode') {
      return undefined;
    }
    return verifyVSCode(ide, ideProcessInfo);
  }
  
  // For JetBrains IDEs, verify with process info
  if ([DetectedIde.PyCharm, DetectedIde.WebStorm, DetectedIde.IntelliJIDEA, DetectedIde.JetBrainsIDE].includes(ide)) {
    return verifyJetBrainsIDE(ide, ideProcessInfo);
  }
  
  // For other IDEs that don't need VS Code terminal, return as detected
  return ide;
}
