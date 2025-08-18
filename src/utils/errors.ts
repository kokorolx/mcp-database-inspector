export class DatabaseError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'DatabaseError';
    
    if (cause) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }
}

export class ValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ConnectionError extends DatabaseError {
  constructor(message: string, public readonly host?: string, public readonly port?: number, cause?: Error) {
    super(message, cause);
    this.name = 'ConnectionError';
  }
}

export class QueryError extends DatabaseError {
  constructor(message: string, public readonly query?: string, cause?: Error) {
    super(message, cause);
    this.name = 'QueryError';
  }
}

export class ConfigurationError extends Error {
  constructor(message: string, public readonly configKey?: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export class ToolError extends Error {
  constructor(message: string, public readonly toolName?: string, cause?: Error) {
    super(message);
    this.name = 'ToolError';
    
    if (cause) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }
}

export function isRecoverableError(error: Error): boolean {
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

export function sanitizeErrorMessage(error: Error): string {
  // Remove sensitive information from error messages
  let message = error.message;
  
  // Remove password information from connection strings
  message = message.replace(/password=[^&\s]+/gi, 'password=***');
  message = message.replace(/:([^@\s]+)@/g, ':***@');
  
  return message;
}

export function createErrorResponse(error: Error): { error: string; code?: string } {
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
