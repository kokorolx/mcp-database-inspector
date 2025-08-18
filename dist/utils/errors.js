export class DatabaseError extends Error {
    cause;
    constructor(message, cause) {
        super(message);
        this.cause = cause;
        this.name = 'DatabaseError';
        if (cause) {
            this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
        }
    }
}
export class ValidationError extends Error {
    field;
    constructor(message, field) {
        super(message);
        this.field = field;
        this.name = 'ValidationError';
    }
}
export class ConnectionError extends DatabaseError {
    host;
    port;
    constructor(message, host, port, cause) {
        super(message, cause);
        this.host = host;
        this.port = port;
        this.name = 'ConnectionError';
    }
}
export class QueryError extends DatabaseError {
    query;
    constructor(message, query, cause) {
        super(message, cause);
        this.query = query;
        this.name = 'QueryError';
    }
}
export class ConfigurationError extends Error {
    configKey;
    constructor(message, configKey) {
        super(message);
        this.configKey = configKey;
        this.name = 'ConfigurationError';
    }
}
export class ToolError extends Error {
    toolName;
    constructor(message, toolName, cause) {
        super(message);
        this.toolName = toolName;
        this.name = 'ToolError';
        if (cause) {
            this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
        }
    }
}
export function isRecoverableError(error) {
    // Determine if an error is recoverable (temporary) or fatal
    if (error instanceof ConnectionError) {
        // Network timeouts, temporary connection issues
        return error.message.includes('timeout') ||
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('ENOTFOUND');
    }
    if (error instanceof QueryError) {
        // Syntax errors are not recoverable, but timeouts might be
        return error.message.includes('timeout');
    }
    return false;
}
export function sanitizeErrorMessage(error) {
    // Remove sensitive information from error messages
    let message = error.message;
    // Remove password information from connection strings
    message = message.replace(/password=[^&\s]+/gi, 'password=***');
    message = message.replace(/:([^@\s]+)@/g, ':***@');
    return message;
}
export function createErrorResponse(error) {
    const sanitized = sanitizeErrorMessage(error);
    if (error instanceof ValidationError) {
        return { error: sanitized, code: 'VALIDATION_ERROR' };
    }
    if (error instanceof ConnectionError) {
        return { error: sanitized, code: 'CONNECTION_ERROR' };
    }
    if (error instanceof QueryError) {
        return { error: sanitized, code: 'QUERY_ERROR' };
    }
    if (error instanceof DatabaseError) {
        return { error: sanitized, code: 'DATABASE_ERROR' };
    }
    if (error instanceof ToolError) {
        return { error: sanitized, code: 'TOOL_ERROR' };
    }
    return { error: sanitized, code: 'UNKNOWN_ERROR' };
}
//# sourceMappingURL=errors.js.map