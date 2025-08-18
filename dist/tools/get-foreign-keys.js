import { z } from 'zod';
import { InputValidator } from '../validators/input-validator.js';
import { Logger } from '../utils/logger.js';
import { ToolError } from '../utils/errors.js';
// Tool schema
const GetForeignKeysArgsSchema = z.object({
    database: z.string().min(1, 'Database name is required'),
    table: z.string().optional(),
    tables: z.array(z.string().min(1)).optional()
}).superRefine((data, ctx) => {
    const hasTable = typeof data.table === 'string' && data.table.length > 0;
    const hasTables = Array.isArray(data.tables) && data.tables.length > 0;
    if (hasTable && hasTables) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Provide either 'table' or 'tables', not both"
        });
    }
    else if (!hasTable && !hasTables) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Either 'table' or non-empty 'tables' must be provided"
        });
    }
});
export const getForeignKeysToolDefinition = {
    name: 'get_foreign_keys',
    description: 'Get foreign key relationships for one or more tables, or the entire database. Supports multi-table inspection via the tables: string[] parameter.',
    inputSchema: {
        type: 'object',
        properties: {
            database: {
                type: 'string',
                description: 'Name of the database to analyze'
            },
            table: {
                type: 'string',
                description: 'Specific table name to get foreign keys for (single-table mode)'
            },
            tables: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of table names to get foreign keys for (multi-table mode)'
            }
        },
        required: ['database']
    }
};
export async function handleGetForeignKeys(args, dbManager) {
    try {
        Logger.info('Executing get_foreign_keys tool');
        // Validate arguments
        const validationResult = GetForeignKeysArgsSchema.safeParse(args);
        if (!validationResult.success) {
            Logger.warn('Invalid arguments for get_foreign_keys', validationResult.error);
            throw new ToolError(`Invalid arguments: ${validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`, 'get_foreign_keys');
        }
        const { database, table, tables } = validationResult.data;
        // Sanitize inputs
        const sanitizedDatabase = InputValidator.sanitizeString(database);
        const sanitizedTable = table ? InputValidator.sanitizeString(table) : undefined;
        const sanitizedTables = tables ? tables.map(InputValidator.sanitizeString) : undefined;
        // Validate database name format
        const dbNameValidation = InputValidator.validateDatabaseName(sanitizedDatabase);
        if (!dbNameValidation.isValid) {
            throw new ToolError(`Invalid database name: ${dbNameValidation.error}`, 'get_foreign_keys');
        }
        // Multi-table mode
        if (sanitizedTables && sanitizedTables.length > 0) {
            Logger.info(`Multi-table mode: Getting foreign keys for tables: ${sanitizedTables.join(', ')} in database: ${sanitizedDatabase}`);
            const results = {};
            const errors = {};
            for (const tbl of sanitizedTables) {
                try {
                    const tableNameValidation = InputValidator.validateTableName(tbl);
                    if (!tableNameValidation.isValid) {
                        throw new ToolError(`Invalid table name: ${tableNameValidation.error}`, 'get_foreign_keys');
                    }
                    Logger.info(`Getting foreign keys for table: ${tbl} in database: ${sanitizedDatabase}`);
                    Logger.time(`get_foreign_keys_execution_${tbl}`);
                    const foreignKeys = await dbManager.getForeignKeys(sanitizedDatabase, tbl);
                    Logger.timeEnd(`get_foreign_keys_execution_${tbl}`);
                    Logger.info(`Found ${foreignKeys.length} foreign key(s) in table: ${tbl}`);
                    const analysis = analyzeForeignKeyRelationships(foreignKeys);
                    const foreignKeysByTable = groupForeignKeysByTable(foreignKeys);
                    results[tbl] = {
                        database: sanitizedDatabase,
                        table: tbl,
                        scope: 'table',
                        foreignKeys: foreignKeys.map(fk => ({
                            constraintName: fk.constraintName,
                            sourceTable: fk.tableName,
                            sourceColumn: fk.columnName,
                            targetTable: fk.referencedTableName,
                            targetColumn: fk.referencedColumnName,
                            updateRule: fk.updateRule,
                            deleteRule: fk.deleteRule,
                            relationshipType: determineRelationshipType(fk.updateRule, fk.deleteRule)
                        })),
                        relationships: analysis.relationships,
                        statistics: {
                            totalForeignKeys: foreignKeys.length,
                            uniqueConstraints: [...new Set(foreignKeys.map(fk => fk.constraintName))].length,
                            affectedTables: [...new Set(foreignKeys.map(fk => fk.tableName))].length,
                            referencedTables: [...new Set(foreignKeys.map(fk => fk.referencedTableName))].length,
                            cascadeDeleteCount: foreignKeys.filter(fk => fk.deleteRule === 'CASCADE').length,
                            cascadeUpdateCount: foreignKeys.filter(fk => fk.updateRule === 'CASCADE').length,
                            restrictDeleteCount: foreignKeys.filter(fk => fk.deleteRule === 'RESTRICT').length,
                            restrictUpdateCount: foreignKeys.filter(fk => fk.updateRule === 'RESTRICT').length
                        },
                        foreignKeysByTable,
                        analysis: {
                            ...analysis,
                            integrityRules: analyzeIntegrityRules(foreignKeys),
                            potentialIssues: identifyPotentialIssues(foreignKeys)
                        },
                        summary: {
                            hasRelationships: foreignKeys.length > 0,
                            message: foreignKeys.length === 0
                                ? `No foreign key relationships found in table '${tbl}' of database '${sanitizedDatabase}'`
                                : `Found ${foreignKeys.length} foreign key relationship(s) in table '${tbl}' involving ${analysis.relationships.length} table connection(s)`
                        }
                    };
                    Logger.debug('get_foreign_keys completed for table', {
                        database: sanitizedDatabase,
                        table: tbl,
                        foreignKeyCount: foreignKeys.length,
                        relationshipCount: analysis.relationships.length
                    });
                }
                catch (err) {
                    Logger.error(`Error processing table '${tbl}' in get_foreign_keys`, err);
                    errors[tbl] = err instanceof Error ? err.message : String(err);
                }
            }
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({ database: sanitizedDatabase, results, errors }, null, 2)
                    }]
            };
        }
        // Single-table or all-tables mode (original behavior)
        // Validate table name format if provided
        if (sanitizedTable) {
            const tableNameValidation = InputValidator.validateTableName(sanitizedTable);
            if (!tableNameValidation.isValid) {
                throw new ToolError(`Invalid table name: ${tableNameValidation.error}`, 'get_foreign_keys');
            }
        }
        const scope = sanitizedTable ? `table: ${sanitizedTable}` : 'entire database';
        Logger.info(`Getting foreign keys for ${scope} in database: ${sanitizedDatabase}`);
        Logger.time('get_foreign_keys_execution');
        // Get foreign keys
        const foreignKeys = await dbManager.getForeignKeys(sanitizedDatabase, sanitizedTable);
        Logger.timeEnd('get_foreign_keys_execution');
        Logger.info(`Found ${foreignKeys.length} foreign key(s) in ${scope}`);
        // Analyze relationships
        const analysis = analyzeForeignKeyRelationships(foreignKeys);
        // Group foreign keys by table
        const foreignKeysByTable = groupForeignKeysByTable(foreignKeys);
        // Create response
        const response = {
            database: sanitizedDatabase,
            table: sanitizedTable || null,
            scope: sanitizedTable ? 'table' : 'database',
            foreignKeys: foreignKeys.map(fk => ({
                constraintName: fk.constraintName,
                sourceTable: fk.tableName,
                sourceColumn: fk.columnName,
                targetTable: fk.referencedTableName,
                targetColumn: fk.referencedColumnName,
                updateRule: fk.updateRule,
                deleteRule: fk.deleteRule,
                relationshipType: determineRelationshipType(fk.updateRule, fk.deleteRule)
            })),
            relationships: analysis.relationships,
            statistics: {
                totalForeignKeys: foreignKeys.length,
                uniqueConstraints: [...new Set(foreignKeys.map(fk => fk.constraintName))].length,
                affectedTables: [...new Set(foreignKeys.map(fk => fk.tableName))].length,
                referencedTables: [...new Set(foreignKeys.map(fk => fk.referencedTableName))].length,
                cascadeDeleteCount: foreignKeys.filter(fk => fk.deleteRule === 'CASCADE').length,
                cascadeUpdateCount: foreignKeys.filter(fk => fk.updateRule === 'CASCADE').length,
                restrictDeleteCount: foreignKeys.filter(fk => fk.deleteRule === 'RESTRICT').length,
                restrictUpdateCount: foreignKeys.filter(fk => fk.updateRule === 'RESTRICT').length
            },
            foreignKeysByTable,
            analysis: {
                ...analysis,
                integrityRules: analyzeIntegrityRules(foreignKeys),
                potentialIssues: identifyPotentialIssues(foreignKeys)
            },
            summary: {
                hasRelationships: foreignKeys.length > 0,
                message: foreignKeys.length === 0
                    ? `No foreign key relationships found in ${scope} of database '${sanitizedDatabase}'`
                    : `Found ${foreignKeys.length} foreign key relationship(s) in ${scope} involving ${analysis.relationships.length} table connection(s)`
            }
        };
        Logger.debug('get_foreign_keys completed successfully', {
            database: sanitizedDatabase,
            table: sanitizedTable,
            foreignKeyCount: foreignKeys.length,
            relationshipCount: analysis.relationships.length
        });
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify(response, null, 2)
                }]
        };
    }
    catch (error) {
        // Add table context to error logs
        let tableContext;
        let argTables;
        let argTable;
        if (args && typeof args === 'object') {
            // @ts-ignore
            argTables = Array.isArray(args.tables) ? args.tables : undefined;
            // @ts-ignore
            argTable = typeof args.table === 'string' ? args.table : undefined;
        }
        if (Array.isArray(argTables) && argTables.length > 0) {
            tableContext = `tables: [${argTables.join(', ')}]`;
        }
        else if (typeof argTable === 'string' && argTable.length > 0) {
            tableContext = `table: ${argTable}`;
        }
        else {
            tableContext = 'no table(s) specified';
        }
        Logger.error(`Error in get_foreign_keys tool (${tableContext})`, error);
        if (error instanceof ToolError) {
            throw error;
        }
        throw new ToolError(`Failed to get foreign keys (${tableContext}): ${error instanceof Error ? error.message : 'Unknown error'}`, 'get_foreign_keys', error instanceof Error ? error : undefined);
    }
}
// Helper functions
function groupForeignKeysByTable(foreignKeys) {
    const groups = {};
    foreignKeys.forEach(fk => {
        if (!groups[fk.tableName]) {
            groups[fk.tableName] = [];
        }
        groups[fk.tableName].push({
            constraintName: fk.constraintName,
            column: fk.columnName,
            referencedTable: fk.referencedTableName,
            referencedColumn: fk.referencedColumnName,
            updateRule: fk.updateRule,
            deleteRule: fk.deleteRule
        });
    });
    return groups;
}
function analyzeForeignKeyRelationships(foreignKeys) {
    const relationships = [];
    const tableConnections = {};
    // Group by constraint to handle composite foreign keys
    const constraintGroups = {};
    foreignKeys.forEach(fk => {
        if (!constraintGroups[fk.constraintName]) {
            constraintGroups[fk.constraintName] = [];
        }
        constraintGroups[fk.constraintName].push(fk);
    });
    // Analyze each constraint
    Object.keys(constraintGroups).forEach(constraintName => {
        const fks = constraintGroups[constraintName];
        const firstFK = fks[0];
        relationships.push({
            constraintName,
            fromTable: firstFK.tableName,
            toTable: firstFK.referencedTableName,
            columns: fks.map(fk => ({
                from: fk.columnName,
                to: fk.referencedColumnName
            })),
            isComposite: fks.length > 1,
            updateRule: firstFK.updateRule,
            deleteRule: firstFK.deleteRule,
            relationshipStrength: determineRelationshipStrength(firstFK.updateRule, firstFK.deleteRule)
        });
        // Track table connections
        if (!tableConnections[firstFK.tableName]) {
            tableConnections[firstFK.tableName] = new Set();
        }
        tableConnections[firstFK.tableName].add(firstFK.referencedTableName);
    });
    return {
        relationships,
        tableConnections: Object.fromEntries(Object.entries(tableConnections).map(([table, connections]) => [
            table,
            Array.from(connections)
        ])),
        totalRelationships: relationships.length,
        compositeRelationships: relationships.filter(r => r.isComposite).length
    };
}
function determineRelationshipType(updateRule, deleteRule) {
    if (deleteRule === 'CASCADE') {
        return 'strong_dependency'; // Child cannot exist without parent
    }
    else if (deleteRule === 'RESTRICT' || deleteRule === 'NO ACTION') {
        return 'protective'; // Prevents accidental deletion
    }
    else if (deleteRule === 'SET NULL') {
        return 'optional_reference'; // Relationship can be broken
    }
    else {
        return 'unknown';
    }
}
function determineRelationshipStrength(updateRule, deleteRule) {
    if (deleteRule === 'CASCADE' && updateRule === 'CASCADE') {
        return 'strong';
    }
    else if (deleteRule === 'RESTRICT' || updateRule === 'RESTRICT') {
        return 'medium';
    }
    else {
        return 'weak';
    }
}
function analyzeIntegrityRules(foreignKeys) {
    const rules = {
        cascade: {
            delete: foreignKeys.filter(fk => fk.deleteRule === 'CASCADE'),
            update: foreignKeys.filter(fk => fk.updateRule === 'CASCADE')
        },
        restrict: {
            delete: foreignKeys.filter(fk => fk.deleteRule === 'RESTRICT' || fk.deleteRule === 'NO ACTION'),
            update: foreignKeys.filter(fk => fk.updateRule === 'RESTRICT' || fk.updateRule === 'NO ACTION')
        },
        setNull: {
            delete: foreignKeys.filter(fk => fk.deleteRule === 'SET NULL'),
            update: foreignKeys.filter(fk => fk.updateRule === 'SET NULL')
        }
    };
    return {
        rules,
        summary: {
            cascadeDeleteTables: [...new Set(rules.cascade.delete.map(fk => fk.tableName))],
            protectedTables: [...new Set(rules.restrict.delete.map(fk => fk.referencedTableName))],
            weaklyReferencedTables: [...new Set(rules.setNull.delete.map(fk => fk.referencedTableName))]
        }
    };
}
function identifyPotentialIssues(foreignKeys) {
    const issues = [];
    // Check for circular references
    const tableGraph = {};
    foreignKeys.forEach(fk => {
        if (!tableGraph[fk.tableName]) {
            tableGraph[fk.tableName] = [];
        }
        tableGraph[fk.tableName].push(fk.referencedTableName);
    });
    // Simple cycle detection (this is a basic check, not comprehensive)
    Object.keys(tableGraph).forEach(table => {
        tableGraph[table].forEach(referenced => {
            if (tableGraph[referenced] && tableGraph[referenced].includes(table)) {
                issues.push(`Potential circular reference detected between tables '${table}' and '${referenced}'`);
            }
        });
    });
    // Check for many cascade delete relationships from same parent
    const cascadeParents = {};
    foreignKeys.filter(fk => fk.deleteRule === 'CASCADE').forEach(fk => {
        cascadeParents[fk.referencedTableName] = (cascadeParents[fk.referencedTableName] || 0) + 1;
    });
    Object.entries(cascadeParents).forEach(([table, count]) => {
        if (count > 5) {
            issues.push(`Table '${table}' has ${count} cascade delete relationships - consider the impact of deletions`);
        }
    });
    // Check for inconsistent naming patterns
    const constraintNames = foreignKeys.map(fk => fk.constraintName);
    const hasConsistentNaming = constraintNames.every(name => name.startsWith('fk_') || name.startsWith('FK_') ||
        name.includes('_fk') || name.includes('_FK'));
    if (!hasConsistentNaming && constraintNames.length > 1) {
        issues.push('Foreign key constraint names follow inconsistent naming patterns');
    }
    return issues;
}
//# sourceMappingURL=get-foreign-keys.js.map