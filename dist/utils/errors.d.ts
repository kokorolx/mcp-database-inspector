export declare class DatabaseError extends Error {
    readonly cause?: Error | undefined;
    constructor(message: string, cause?: Error | undefined);
}
export declare class ValidationError extends Error {
    readonly field?: string | undefined;
    constructor(message: string, field?: string | undefined);
}
export declare class ConnectionError extends DatabaseError {
    readonly host?: string | undefined;
    readonly port?: number | undefined;
    constructor(message: string, host?: string | undefined, port?: number | undefined, cause?: Error);
}
export declare class QueryError extends DatabaseError {
    readonly query?: string | undefined;
    constructor(message: string, query?: string | undefined, cause?: Error);
}
export declare class ConfigurationError extends Error {
    readonly configKey?: string | undefined;
    constructor(message: string, configKey?: string | undefined);
}
export declare class ToolError extends Error {
    readonly toolName?: string | undefined;
    constructor(message: string, toolName?: string | undefined, cause?: Error);
}
export declare function isRecoverableError(error: Error): boolean;
export declare function sanitizeErrorMessage(error: Error): string;
export declare function createErrorResponse(error: Error): {
    error: string;
    code?: string;
};
//# sourceMappingURL=errors.d.ts.map