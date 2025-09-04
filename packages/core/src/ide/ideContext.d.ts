/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { z } from 'zod';
/**
 * Zod schema for validating a file context from the IDE.
 */
export declare const FileSchema: z.ZodObject<{
    path: z.ZodString;
    timestamp: z.ZodNumber;
    isActive: z.ZodOptional<z.ZodBoolean>;
    selectedText: z.ZodOptional<z.ZodString>;
    cursor: z.ZodOptional<z.ZodObject<{
        line: z.ZodNumber;
        character: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        line: number;
        character: number;
    }, {
        line: number;
        character: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    timestamp: number;
    path: string;
    cursor?: {
        line: number;
        character: number;
    } | undefined;
    isActive?: boolean | undefined;
    selectedText?: string | undefined;
}, {
    timestamp: number;
    path: string;
    cursor?: {
        line: number;
        character: number;
    } | undefined;
    isActive?: boolean | undefined;
    selectedText?: string | undefined;
}>;
export type File = z.infer<typeof FileSchema>;
export declare const IdeContextSchema: z.ZodObject<{
    workspaceState: z.ZodOptional<z.ZodObject<{
        openFiles: z.ZodOptional<z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            timestamp: z.ZodNumber;
            isActive: z.ZodOptional<z.ZodBoolean>;
            selectedText: z.ZodOptional<z.ZodString>;
            cursor: z.ZodOptional<z.ZodObject<{
                line: z.ZodNumber;
                character: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                line: number;
                character: number;
            }, {
                line: number;
                character: number;
            }>>;
        }, "strip", z.ZodTypeAny, {
            timestamp: number;
            path: string;
            cursor?: {
                line: number;
                character: number;
            } | undefined;
            isActive?: boolean | undefined;
            selectedText?: string | undefined;
        }, {
            timestamp: number;
            path: string;
            cursor?: {
                line: number;
                character: number;
            } | undefined;
            isActive?: boolean | undefined;
            selectedText?: string | undefined;
        }>, "many">>;
        isTrusted: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        isTrusted?: boolean | undefined;
        openFiles?: {
            timestamp: number;
            path: string;
            cursor?: {
                line: number;
                character: number;
            } | undefined;
            isActive?: boolean | undefined;
            selectedText?: string | undefined;
        }[] | undefined;
    }, {
        isTrusted?: boolean | undefined;
        openFiles?: {
            timestamp: number;
            path: string;
            cursor?: {
                line: number;
                character: number;
            } | undefined;
            isActive?: boolean | undefined;
            selectedText?: string | undefined;
        }[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    workspaceState?: {
        isTrusted?: boolean | undefined;
        openFiles?: {
            timestamp: number;
            path: string;
            cursor?: {
                line: number;
                character: number;
            } | undefined;
            isActive?: boolean | undefined;
            selectedText?: string | undefined;
        }[] | undefined;
    } | undefined;
}, {
    workspaceState?: {
        isTrusted?: boolean | undefined;
        openFiles?: {
            timestamp: number;
            path: string;
            cursor?: {
                line: number;
                character: number;
            } | undefined;
            isActive?: boolean | undefined;
            selectedText?: string | undefined;
        }[] | undefined;
    } | undefined;
}>;
export type IdeContext = z.infer<typeof IdeContextSchema>;
/**
 * Zod schema for validating the 'ide/contextUpdate' notification from the IDE.
 */
export declare const IdeContextNotificationSchema: z.ZodObject<{
    jsonrpc: z.ZodLiteral<"2.0">;
    method: z.ZodLiteral<"ide/contextUpdate">;
    params: z.ZodObject<{
        workspaceState: z.ZodOptional<z.ZodObject<{
            openFiles: z.ZodOptional<z.ZodArray<z.ZodObject<{
                path: z.ZodString;
                timestamp: z.ZodNumber;
                isActive: z.ZodOptional<z.ZodBoolean>;
                selectedText: z.ZodOptional<z.ZodString>;
                cursor: z.ZodOptional<z.ZodObject<{
                    line: z.ZodNumber;
                    character: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    line: number;
                    character: number;
                }, {
                    line: number;
                    character: number;
                }>>;
            }, "strip", z.ZodTypeAny, {
                timestamp: number;
                path: string;
                cursor?: {
                    line: number;
                    character: number;
                } | undefined;
                isActive?: boolean | undefined;
                selectedText?: string | undefined;
            }, {
                timestamp: number;
                path: string;
                cursor?: {
                    line: number;
                    character: number;
                } | undefined;
                isActive?: boolean | undefined;
                selectedText?: string | undefined;
            }>, "many">>;
            isTrusted: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            isTrusted?: boolean | undefined;
            openFiles?: {
                timestamp: number;
                path: string;
                cursor?: {
                    line: number;
                    character: number;
                } | undefined;
                isActive?: boolean | undefined;
                selectedText?: string | undefined;
            }[] | undefined;
        }, {
            isTrusted?: boolean | undefined;
            openFiles?: {
                timestamp: number;
                path: string;
                cursor?: {
                    line: number;
                    character: number;
                } | undefined;
                isActive?: boolean | undefined;
                selectedText?: string | undefined;
            }[] | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        workspaceState?: {
            isTrusted?: boolean | undefined;
            openFiles?: {
                timestamp: number;
                path: string;
                cursor?: {
                    line: number;
                    character: number;
                } | undefined;
                isActive?: boolean | undefined;
                selectedText?: string | undefined;
            }[] | undefined;
        } | undefined;
    }, {
        workspaceState?: {
            isTrusted?: boolean | undefined;
            openFiles?: {
                timestamp: number;
                path: string;
                cursor?: {
                    line: number;
                    character: number;
                } | undefined;
                isActive?: boolean | undefined;
                selectedText?: string | undefined;
            }[] | undefined;
        } | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        workspaceState?: {
            isTrusted?: boolean | undefined;
            openFiles?: {
                timestamp: number;
                path: string;
                cursor?: {
                    line: number;
                    character: number;
                } | undefined;
                isActive?: boolean | undefined;
                selectedText?: string | undefined;
            }[] | undefined;
        } | undefined;
    };
    method: "ide/contextUpdate";
    jsonrpc: "2.0";
}, {
    params: {
        workspaceState?: {
            isTrusted?: boolean | undefined;
            openFiles?: {
                timestamp: number;
                path: string;
                cursor?: {
                    line: number;
                    character: number;
                } | undefined;
                isActive?: boolean | undefined;
                selectedText?: string | undefined;
            }[] | undefined;
        } | undefined;
    };
    method: "ide/contextUpdate";
    jsonrpc: "2.0";
}>;
export declare const IdeDiffAcceptedNotificationSchema: z.ZodObject<{
    jsonrpc: z.ZodLiteral<"2.0">;
    method: z.ZodLiteral<"ide/diffAccepted">;
    params: z.ZodObject<{
        filePath: z.ZodString;
        content: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        content: string;
        filePath: string;
    }, {
        content: string;
        filePath: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        content: string;
        filePath: string;
    };
    method: "ide/diffAccepted";
    jsonrpc: "2.0";
}, {
    params: {
        content: string;
        filePath: string;
    };
    method: "ide/diffAccepted";
    jsonrpc: "2.0";
}>;
export declare const IdeDiffClosedNotificationSchema: z.ZodObject<{
    jsonrpc: z.ZodLiteral<"2.0">;
    method: z.ZodLiteral<"ide/diffClosed">;
    params: z.ZodObject<{
        filePath: z.ZodString;
        content: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        filePath: string;
        content?: string | undefined;
    }, {
        filePath: string;
        content?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        filePath: string;
        content?: string | undefined;
    };
    method: "ide/diffClosed";
    jsonrpc: "2.0";
}, {
    params: {
        filePath: string;
        content?: string | undefined;
    };
    method: "ide/diffClosed";
    jsonrpc: "2.0";
}>;
export declare const CloseDiffResponseSchema: z.ZodEffects<z.ZodObject<{
    content: z.ZodArray<z.ZodObject<{
        text: z.ZodString;
        type: z.ZodLiteral<"text">;
    }, "strip", z.ZodTypeAny, {
        text: string;
        type: "text";
    }, {
        text: string;
        type: "text";
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    content: {
        text: string;
        type: "text";
    }[];
}, {
    content: {
        text: string;
        type: "text";
    }[];
}>, {
    content?: string | undefined;
}, {
    content: {
        text: string;
        type: "text";
    }[];
}>;
export type DiffUpdateResult = {
    status: 'accepted';
    content?: string;
} | {
    status: 'rejected';
    content: undefined;
};
type IdeContextSubscriber = (ideContext: IdeContext | undefined) => void;
/**
 * Creates a new store for managing the IDE's context.
 * This factory function encapsulates the state and logic, allowing for the creation
 * of isolated instances, which is particularly useful for testing.
 *
 * @returns An object with methods to interact with the IDE context.
 */
export declare function createIdeContextStore(): {
    setIdeContext: (newIdeContext: IdeContext) => void;
    getIdeContext: () => IdeContext | undefined;
    subscribeToIdeContext: (subscriber: IdeContextSubscriber) => () => void;
    clearIdeContext: () => void;
};
/**
 * The default, shared instance of the IDE context store for the application.
 */
export declare const ideContext: {
    setIdeContext: (newIdeContext: IdeContext) => void;
    getIdeContext: () => IdeContext | undefined;
    subscribeToIdeContext: (subscriber: IdeContextSubscriber) => () => void;
    clearIdeContext: () => void;
};
export {};
