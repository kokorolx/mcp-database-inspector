import { z } from 'zod';
import { ValidationResult } from '../database/types.js';
export declare class InputValidator {
    static readonly connectionUrlSchema: z.ZodString;
    static readonly databaseNameSchema: z.ZodString;
    static readonly tableNameSchema: z.ZodString;
    static readonly columnNameSchema: z.ZodString;
    static readonly textInputSchema: z.ZodString;
    /**
     * Validate a connection URL
     */
    static validateConnectionUrl(url: string): ValidationResult;
    /**
     * Validate a database name
     */
    static validateDatabaseName(name: string): ValidationResult;
    /**
     * Validate a table name
     */
    static validateTableName(name: string): ValidationResult;
    /**
     * Validate a column name
     */
    static validateColumnName(name: string): ValidationResult;
    /**
     * Validate text input
     */
    static validateTextInput(text: string): ValidationResult;
    /**
     * Sanitize string input by removing dangerous characters
     */
    static sanitizeString(input: string): string;
    /**
     * Escape MySQL identifiers (table names, column names)
     */
    static escapeIdentifier(identifier: string): string;
    /**
     * Validate tool arguments based on schema
     */
    static validateToolArgs<T>(args: unknown, schema: z.ZodSchema<T>): ValidationResult & {
        data?: T;
    };
    /**
     * Validate that a string represents a valid number
     */
    static validateNumeric(value: string, options?: {
        min?: number;
        max?: number;
        integer?: boolean;
    }): ValidationResult;
    /**
     * Validate an array of values
     */
    static validateArray<T>(values: unknown[], itemValidator: (item: unknown) => ValidationResult & {
        data?: T;
    }): ValidationResult & {
        data?: T[];
    };
    /**
     * Validate email format (for potential user management features)
     */
    static validateEmail(email: string): ValidationResult;
    /**
     * Validate URL format
     */
    static validateUrl(url: string): ValidationResult;
    /**
     * Check if a string contains only safe characters for logging
     */
    static isSafeForLogging(text: string): boolean;
    /**
     * Sanitize text for safe logging by masking sensitive information
     */
    static sanitizeForLogging(text: string): string;
}
//# sourceMappingURL=input-validator.d.ts.map