import { DatabaseType, ValidationResult } from '../database/types.js';
export declare class QueryValidator {
    private static readonly FORBIDDEN_KEYWORDS;
    private static readonly ALLOWED_KEYWORDS;
    private static readonly FORBIDDEN_FUNCTIONS;
    static validateQuery(query: string, type?: DatabaseType): ValidationResult;
    private static normalizeQuery;
    private static checkForbiddenKeywords;
    private static checkForbiddenFunctions;
    private static checkAllowedStart;
    private static checkSqlInjectionPatterns;
    private static checkSuspiciousPatterns;
    private static getWarnings;
    static validateIdentifier(identifier: string): ValidationResult;
    static sanitizeInput(input: string): string;
    static isSimpleReadQuery(query: string): boolean;
    static getQueryComplexity(query: string): 'low' | 'medium' | 'high';
}
//# sourceMappingURL=query-validator.d.ts.map