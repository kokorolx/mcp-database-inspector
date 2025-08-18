import { DatabaseManager } from '../database/manager.js';
/**
 * Tool: get_indexes
 * Get detailed index information for one or more tables.
 *
 * Supports both single-table and multi-table inspection:
 * - Provide either `table` (string) for a single table, or `tables` (string[]) for multiple tables.
 * - If `tables` is provided, returns a mapping of table names to their index analysis.
 * - Do not provide both `table` and `tables` at the same time.
 */
export interface GetIndexesTool {
    name: 'get_indexes';
    description: 'Get detailed index information for one or more tables. Supports multi-table inspection via the tables: string[] parameter.';
    inputSchema: {
        type: 'object';
        properties: {
            database: {
                type: 'string';
                description: 'Name of the database containing the table(s)';
            };
            table: {
                type: 'string';
                description: 'Name of the table to get indexes for (single-table mode)';
            };
            tables: {
                type: 'array';
                items: {
                    type: 'string';
                };
                description: 'Array of table names to get indexes for (multi-table mode)';
            };
        };
        required: ['database'];
    };
}
export declare const getIndexesToolDefinition: GetIndexesTool;
export declare function handleGetIndexes(args: unknown, dbManager: DatabaseManager): Promise<any>;
//# sourceMappingURL=get-indexes.d.ts.map