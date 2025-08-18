import { DatabaseManager } from '../database/manager.js';
export interface GetIndexesTool {
    name: 'get_indexes';
    description: 'Get detailed index information for a specific table';
    inputSchema: {
        type: 'object';
        properties: {
            database: {
                type: 'string';
                description: 'Name of the database containing the table';
            };
            table: {
                type: 'string';
                description: 'Name of the table to get indexes for';
            };
        };
        required: ['database', 'table'];
    };
}
export declare const getIndexesToolDefinition: GetIndexesTool;
export declare function handleGetIndexes(args: unknown, dbManager: DatabaseManager): Promise<any>;
//# sourceMappingURL=get-indexes.d.ts.map