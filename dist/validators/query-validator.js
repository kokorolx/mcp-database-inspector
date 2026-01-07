import { DatabaseType } from '../database/types.js';
export class QueryValidator {
    // Keywords that are forbidden in queries
    static FORBIDDEN_KEYWORDS = [
        'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE',
        'ALTER', 'TRUNCATE', 'REPLACE', 'MERGE', 'CALL',
        'EXEC', 'EXECUTE', 'LOAD', 'IMPORT', 'BULK',
        'GRANT', 'REVOKE', 'SET', 'USE', 'START',
        'BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT',
        'LOCK', 'UNLOCK', 'FLUSH', 'RESET', 'PURGE',
        'KILL', 'SHUTDOWN', 'RESTART', 'COPY'
    ];
    // Allowed keywords for read-only operations
    static ALLOWED_KEYWORDS = [
        'SELECT', 'SHOW', 'DESCRIBE', 'DESC', 'EXPLAIN',
        'ANALYZE', 'CHECK', 'CHECKSUM', 'OPTIMIZE', 'WITH', 'VALUES'
    ];
    // Dangerous functions that should be blocked
    static FORBIDDEN_FUNCTIONS = [
        'LOAD_FILE', 'INTO OUTFILE', 'INTO DUMPFILE',
        'SYSTEM', 'USER_DEFINED_FUNCTION', 'BENCHMARK',
        'PG_READ_FILE', 'PG_LS_DIR', 'PG_EXECUTE'
    ];
    static validateQuery(query, type = DatabaseType.MySQL) {
        if (!query || query.trim().length === 0) {
            return {
                isValid: false,
                error: 'Query cannot be empty'
            };
        }
        const normalizedQuery = this.normalizeQuery(query);
        // Check for forbidden keywords
        const forbiddenCheck = this.checkForbiddenKeywords(normalizedQuery);
        if (!forbiddenCheck.isValid) {
            return forbiddenCheck;
        }
        // Check for forbidden functions
        const functionCheck = this.checkForbiddenFunctions(normalizedQuery);
        if (!functionCheck.isValid) {
            return functionCheck;
        }
        // Check if query starts with an allowed keyword
        const allowedCheck = this.checkAllowedStart(normalizedQuery);
        if (!allowedCheck.isValid) {
            return allowedCheck;
        }
        // Check for SQL injection patterns
        const injectionCheck = this.checkSqlInjectionPatterns(normalizedQuery, type);
        if (!injectionCheck.isValid) {
            return injectionCheck;
        }
        // Check for suspicious patterns
        const suspiciousCheck = this.checkSuspiciousPatterns(normalizedQuery);
        if (!suspiciousCheck.isValid) {
            return suspiciousCheck;
        }
        return {
            isValid: true,
            warnings: this.getWarnings(normalizedQuery)
        };
    }
    static normalizeQuery(query) {
        // Remove comments and normalize whitespace
        return query
            .replace(/--[^\r\n]*/g, '') // Remove -- comments
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* */ comments
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim()
            .toUpperCase();
    }
    static checkForbiddenKeywords(query) {
        for (const keyword of this.FORBIDDEN_KEYWORDS) {
            // Use word boundaries to avoid false positives
            const regex = new RegExp(`\\b${keyword}\\b`, 'i');
            if (regex.test(query)) {
                return {
                    isValid: false,
                    error: `Forbidden keyword detected: ${keyword}. Only read-only operations are allowed.`
                };
            }
        }
        return { isValid: true };
    }
    static checkForbiddenFunctions(query) {
        for (const func of this.FORBIDDEN_FUNCTIONS) {
            if (query.includes(func)) {
                return {
                    isValid: false,
                    error: `Forbidden function detected: ${func}. This function is not allowed for security reasons.`
                };
            }
        }
        return { isValid: true };
    }
    static checkAllowedStart(query) {
        const firstWord = query.split(' ')[0];
        if (!this.ALLOWED_KEYWORDS.includes(firstWord)) {
            return {
                isValid: false,
                error: `Query must start with one of: ${this.ALLOWED_KEYWORDS.join(', ')}`
            };
        }
        return { isValid: true };
    }
    static checkSqlInjectionPatterns(query, type) {
        const suspiciousPatterns = [
            /;\s*(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)/i, // Multiple statements
            /UNION\s+(ALL\s+)?SELECT/i, // Union-based injection
            /'\s*(OR|AND)\s*'[^']*'\s*=/i, // Quote-based injection
            /'\s*(OR|AND)\s*\d+\s*=\s*\d+/i, // Numeric injection
            /CONCAT\s*\(\s*0x[0-9a-f]+/i, // Hex concatenation
            /(SLEEP|BENCHMARK)\s*\(/i, // Time-based attacks
        ];
        if (type === DatabaseType.MySQL) {
            suspiciousPatterns.push(/INFORMATION_SCHEMA\.\w+\s+(WHERE|AND|OR)/i);
        }
        for (const pattern of suspiciousPatterns) {
            if (pattern.test(query)) {
                return {
                    isValid: false,
                    error: 'Query contains suspicious patterns that may indicate SQL injection'
                };
            }
        }
        return { isValid: true };
    }
    static checkSuspiciousPatterns(query) {
        // Check for extremely long queries (potential DoS)
        if (query.length > 10000) {
            return {
                isValid: false,
                error: 'Query is too long. Maximum allowed length is 10,000 characters.'
            };
        }
        // Check for excessive nesting
        const nestedCount = (query.match(/\(/g) || []).length;
        if (nestedCount > 50) {
            return {
                isValid: false,
                error: 'Query has too many nested expressions. Maximum allowed is 50.'
            };
        }
        return { isValid: true };
    }
    static getWarnings(query) {
        const warnings = [];
        // Warn about potentially slow operations
        if (query.includes('SELECT *')) {
            warnings.push('Using SELECT * may return large result sets. Consider specifying specific columns.');
        }
        if (query.includes('ORDER BY') && !query.includes('LIMIT')) {
            warnings.push('ORDER BY without LIMIT may be slow on large tables.');
        }
        if (query.includes('LIKE %') || query.includes("LIKE '%")) {
            warnings.push('Leading wildcard in LIKE patterns may cause slow queries.');
        }
        // Check for cross-joins
        if (query.match(/FROM\s+\w+\s*,\s*\w+/i) && !query.includes('WHERE')) {
            warnings.push('Potential cartesian product detected. Consider adding WHERE conditions.');
        }
        return warnings;
    }
    // Validate table and column names to prevent injection through identifiers
    static validateIdentifier(identifier) {
        if (!identifier || identifier.trim().length === 0) {
            return {
                isValid: false,
                error: 'Identifier cannot be empty'
            };
        }
        // MySQL/PostgreSQL identifier rules (simplified common)
        const validIdentifier = /^[a-zA-Z_][a-zA-Z0-9_$]*$|^`[^`]+`$/;
        if (!validIdentifier.test(identifier.trim())) {
            return {
                isValid: false,
                error: 'Invalid identifier format. Use only letters, numbers, underscore, and dollar sign.'
            };
        }
        // Check length (common limit is 64 characters)
        const cleanIdentifier = identifier.replace(/[`"]/g, '');
        if (cleanIdentifier.length > 64) {
            return {
                isValid: false,
                error: 'Identifier too long. Maximum length is 64 characters.'
            };
        }
        return { isValid: true };
    }
    // Sanitize user input
    static sanitizeInput(input) {
        if (!input)
            return '';
        // Remove null bytes and control characters
        return input
            .replace(/\0/g, '')
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
            .trim();
    }
    // Check if a query is a simple read operation
    static isSimpleReadQuery(query) {
        const normalized = this.normalizeQuery(query);
        const firstWord = normalized.split(' ')[0];
        return ['SELECT', 'SHOW', 'DESCRIBE', 'DESC', 'EXPLAIN', 'WITH', 'VALUES'].includes(firstWord);
    }
    // Estimate query complexity
    static getQueryComplexity(query) {
        const normalized = this.normalizeQuery(query);
        let complexity = 0;
        // Count joins
        complexity += (normalized.match(/\bJOIN\b/g) || []).length * 2;
        // Count subqueries
        complexity += (normalized.match(/\bSELECT\b/g) || []).length - 1;
        // Count aggregation functions
        complexity += (normalized.match(/\b(COUNT|SUM|AVG|MAX|MIN|GROUP_CONCAT)\b/g) || []).length;
        // Count sorting and grouping
        if (normalized.includes('ORDER BY'))
            complexity += 1;
        if (normalized.includes('GROUP BY'))
            complexity += 2;
        if (normalized.includes('HAVING'))
            complexity += 1;
        if (complexity <= 2)
            return 'low';
        if (complexity <= 6)
            return 'medium';
        return 'high';
    }
}
//# sourceMappingURL=query-validator.js.map