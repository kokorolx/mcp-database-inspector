import { z } from 'zod';
import { ValidationResult } from '../database/types.js';

export class InputValidator {
  // Schema for database connection URLs
  static readonly connectionUrlSchema = z.string()
    .url()
    .refine(url => url.startsWith('mysql://'), {
      message: 'URL must start with mysql://'
    })
    .refine(url => {
      try {
        const parsed = new URL(url);
        return parsed.hostname && parsed.username && parsed.password;
      } catch {
        return false;
      }
    }, {
      message: 'URL must contain hostname, username, and password'
    });

  // Schema for database names
  static readonly databaseNameSchema = z.string()
    .min(1, 'Database name cannot be empty')
    .max(64, 'Database name cannot exceed 64 characters')
    .regex(/^[a-zA-Z_][a-zA-Z0-9_$]*$/, 'Invalid database name format');

  // Schema for table names
  static readonly tableNameSchema = z.string()
    .min(1, 'Table name cannot be empty')
    .max(64, 'Table name cannot exceed 64 characters')
    .regex(/^[a-zA-Z_][a-zA-Z0-9_$]*$|^`[^`]+`$/, 'Invalid table name format');

  // Schema for column names
  static readonly columnNameSchema = z.string()
    .min(1, 'Column name cannot be empty')
    .max(64, 'Column name cannot exceed 64 characters')
    .regex(/^[a-zA-Z_][a-zA-Z0-9_$]*$|^`[^`]+`$/, 'Invalid column name format');

  // Schema for general text input
  static readonly textInputSchema = z.string()
    .max(10000, 'Input too long')
    .refine(text => !text.includes('\0'), {
      message: 'Input cannot contain null bytes'
    });

  /**
   * Validate a connection URL
   */
  static validateConnectionUrl(url: string): ValidationResult {
    try {
      this.connectionUrlSchema.parse(url);
      return { isValid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          error: error.errors.map(e => e.message).join(', ')
        };
      }
      return {
        isValid: false,
        error: 'Invalid connection URL format'
      };
    }
  }

  /**
   * Validate a database name
   */
  static validateDatabaseName(name: string): ValidationResult {
    try {
      this.databaseNameSchema.parse(name);
      return { isValid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          error: error.errors.map(e => e.message).join(', ')
        };
      }
      return {
        isValid: false,
        error: 'Invalid database name'
      };
    }
  }

  /**
   * Validate a table name
   */
  static validateTableName(name: string): ValidationResult {
    try {
      this.tableNameSchema.parse(name);
      return { isValid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          error: error.errors.map(e => e.message).join(', ')
        };
      }
      return {
        isValid: false,
        error: 'Invalid table name'
      };
    }
  }

  /**
   * Validate a column name
   */
  static validateColumnName(name: string): ValidationResult {
    try {
      this.columnNameSchema.parse(name);
      return { isValid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          error: error.errors.map(e => e.message).join(', ')
        };
      }
      return {
        isValid: false,
        error: 'Invalid column name'
      };
    }
  }

  /**
   * Validate text input
   */
  static validateTextInput(text: string): ValidationResult {
    try {
      this.textInputSchema.parse(text);
      return { isValid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          error: error.errors.map(e => e.message).join(', ')
        };
      }
      return {
        isValid: false,
        error: 'Invalid text input'
      };
    }
  }

  /**
   * Sanitize string input by removing dangerous characters
   */
  static sanitizeString(input: string): string {
    if (!input) return '';

    return input
      // Remove null bytes
      .replace(/\0/g, '')
      // Remove control characters except tab, newline, carriage return
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Trim whitespace
      .trim();
  }

  /**
   * Escape MySQL identifiers (table names, column names)
   */
  static escapeIdentifier(identifier: string): string {
    if (!identifier) return '';

    // If already quoted, return as is
    if (identifier.startsWith('`') && identifier.endsWith('`')) {
      return identifier;
    }

    // Remove any existing backticks and escape them
    const cleaned = identifier.replace(/`/g, '``');
    return `\`${cleaned}\``;
  }

  /**
   * Validate tool arguments based on schema
   */
  static validateToolArgs<T>(args: unknown, schema: z.ZodSchema<T>): ValidationResult & { data?: T } {
    try {
      const data = schema.parse(args);
      return { isValid: true, data };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          error: `Invalid arguments: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
        };
      }
      return {
        isValid: false,
        error: 'Invalid arguments format'
      };
    }
  }

  /**
   * Validate that a string represents a valid number
   */
  static validateNumeric(value: string, options?: { min?: number; max?: number; integer?: boolean }): ValidationResult {
    const num = Number(value);
    
    if (isNaN(num)) {
      return { isValid: false, error: 'Value must be a valid number' };
    }

    if (options?.integer && !Number.isInteger(num)) {
      return { isValid: false, error: 'Value must be an integer' };
    }

    if (options?.min !== undefined && num < options.min) {
      return { isValid: false, error: `Value must be at least ${options.min}` };
    }

    if (options?.max !== undefined && num > options.max) {
      return { isValid: false, error: `Value must be at most ${options.max}` };
    }

    return { isValid: true };
  }

  /**
   * Validate an array of values
   */
  static validateArray<T>(
    values: unknown[], 
    itemValidator: (item: unknown) => ValidationResult & { data?: T }
  ): ValidationResult & { data?: T[] } {
    if (!Array.isArray(values)) {
      return { isValid: false, error: 'Value must be an array' };
    }

    const validatedItems: T[] = [];
    const errors: string[] = [];

    for (let i = 0; i < values.length; i++) {
      const result = itemValidator(values[i]);
      if (result.isValid && result.data !== undefined) {
        validatedItems.push(result.data);
      } else {
        errors.push(`Item ${i}: ${result.error || 'Validation failed'}`);
      }
    }

    if (errors.length > 0) {
      return { isValid: false, error: errors.join(', ') };
    }

    return { isValid: true, data: validatedItems };
  }

  /**
   * Validate email format (for potential user management features)
   */
  static validateEmail(email: string): ValidationResult {
    const emailSchema = z.string().email();
    try {
      emailSchema.parse(email);
      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: 'Invalid email format' };
    }
  }

  /**
   * Validate URL format
   */
  static validateUrl(url: string): ValidationResult {
    const urlSchema = z.string().url();
    try {
      urlSchema.parse(url);
      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: 'Invalid URL format' };
    }
  }

  /**
   * Check if a string contains only safe characters for logging
   */
  static isSafeForLogging(text: string): boolean {
    // Check for sensitive patterns that shouldn't be logged
    const sensitivePatterns = [
      /password\s*[=:]\s*[^\s&]+/gi,
      /pwd\s*[=:]\s*[^\s&]+/gi,
      /secret\s*[=:]\s*[^\s&]+/gi,
      /token\s*[=:]\s*[^\s&]+/gi,
      /key\s*[=:]\s*[^\s&]+/gi,
      /mysql:\/\/[^@]+:[^@]+@/gi, // Connection strings with credentials
    ];

    return !sensitivePatterns.some(pattern => pattern.test(text));
  }

  /**
   * Sanitize text for safe logging by masking sensitive information
   */
  static sanitizeForLogging(text: string): string {
    if (!text) return '';

    return text
      // Mask passwords in URLs
      .replace(/(mysql:\/\/[^:]+:)[^@]+(@)/gi, '$1***$2')
      // Mask password parameters
      .replace(/(password\s*[=:]\s*)[^\s&]+/gi, '$1***')
      .replace(/(pwd\s*[=:]\s*)[^\s&]+/gi, '$1***')
      .replace(/(secret\s*[=:]\s*)[^\s&]+/gi, '$1***')
      .replace(/(token\s*[=:]\s*)[^\s&]+/gi, '$1***')
      .replace(/(key\s*[=:]\s*)[^\s&]+/gi, '$1***');
  }
}
