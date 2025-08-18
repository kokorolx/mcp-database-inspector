import { DatabaseManager } from '../database/manager.js';
export interface ListTablesTool {
    name: 'list_tables';
    description: 'List all tables in the specified database with metadata';
    inputSchema: {
        type: 'object';
        properties: {
            database: {
                type: 'string';
                description: 'Name of the database to list tables from';
            };
        };
        required: ['database'];
    };
}
export declare const listTablesToolDefinition: ListTablesTool;
export declare function handleListTables(args: unknown, dbManager: DatabaseManager): Promise<any>;
export declare function getTablesSummary(dbManager: DatabaseManager, database: string): Promise<string>;
//# sourceMappingURL=list-tables.d.ts.map