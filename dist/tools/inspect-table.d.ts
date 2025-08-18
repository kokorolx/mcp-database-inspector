import { DatabaseManager } from '../database/manager.js';
/**
 * Tool: inspect_table
 * Get complete table schema including columns, types, constraints, and metadata.
 *
 * Supports both single-table and multi-table inspection:
 * - Provide either `table` (string) for a single table, or `tables` (string[]) for multiple tables.
 * - If `tables` is provided, returns a mapping of table names to their schema analysis.
 * - Do not provide both `table` and `tables` at the same time.
 */
export interface InspectTableTool {
    name: 'inspect_table';
    description: 'Get complete table schema including columns, types, constraints, and metadata. Supports multi-table inspection via the tables: string[] parameter.';
    inputSchema: {
        type: 'object';
        properties: {
            database: {
                type: 'string';
                description: 'Name of the database containing the table(s)';
            };
            table: {
                type: 'string';
                description: 'Name of the table to inspect (single-table mode)';
            };
            tables: {
                type: 'array';
                items: {
                    type: 'string';
                };
                description: 'Array of table names to inspect (multi-table mode)';
            };
        };
        required: ['database'];
    };
}
export declare const inspectTableToolDefinition: InspectTableTool;
export declare function handleInspectTable(args: unknown, dbManager: DatabaseManager): Promise<any>;
//# sourceMappingURL=inspect-table.d.ts.map