import { DatabaseManager } from '../database/manager.js';
export interface InspectTableTool {
    name: 'inspect_table';
    description: 'Get complete table schema including columns, types, constraints, and metadata';
    inputSchema: {
        type: 'object';
        properties: {
            database: {
                type: 'string';
                description: 'Name of the database containing the table';
            };
            table: {
                type: 'string';
                description: 'Name of the table to inspect';
            };
        };
        required: ['database', 'table'];
    };
}
export declare const inspectTableToolDefinition: InspectTableTool;
export declare function handleInspectTable(args: unknown, dbManager: DatabaseManager): Promise<any>;
//# sourceMappingURL=inspect-table.d.ts.map