/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Config } from '@google/gemini-cli-core';
/**
 * This hook listens for trust status updates from the IDE companion extension.
 * It provides the current trust status from the IDE and a flag indicating
 * if a restart is needed because the trust state has changed.
 */
export declare function useIdeTrustListener(config: Config): {
    isIdeTrusted: boolean | undefined;
    needsRestart: boolean;
};
