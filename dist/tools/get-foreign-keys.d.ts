import { DatabaseManager } from '../database/manager.js';
/**
 * Tool: get_foreign_keys
 * Get foreign key relationships for one or more tables, or the entire database.
 *
 * Supports both single-table and multi-table inspection:
 * - Provide either `table` (string) for a single table, or `tables` (string[]) for multiple tables.
 * - If `tables` is provided, returns a mapping of table names to their foreign key analysis.
 * - Do not provide both `table` and `tables` at the same time.
 */
export interface GetForeignKeysTool {
    name: 'get_foreign_keys';
    description: 'Get foreign key relationships for one or more tables, or the entire database. Supports multi-table inspection via the tables: string[] parameter.';
    inputSchema: {
        type: 'object';
        properties: {
            database: {
                type: 'string';
                description: 'Name of the database to analyze';
            };
            table: {
                type: 'string';
                description: 'Specific table name to get foreign keys for (single-table mode)';
            };
            tables: {
                type: 'array';
                items: {
                    type: 'string';
                };
                description: 'Array of table names to get foreign keys for (multi-table mode)';
            };
        };
        required: ['database'];
    };
}
export declare const getForeignKeysToolDefinition: GetForeignKeysTool;
export declare function handleGetForeignKeys(args: unknown, dbManager: DatabaseManager): Promise<any>;
//# sourceMappingURL=get-foreign-keys.d.ts.map