import { DatabaseManager } from '../database/manager.js';
export interface ListDatabasesTool {
    name: 'list_databases';
    description: 'List all connected database names with connection status';
    inputSchema: {
        type: 'object';
        properties: {};
        required: never[];
    };
}
export declare const listDatabasesToolDefinition: ListDatabasesTool;
export declare function handleListDatabases(args: unknown, dbManager: DatabaseManager): Promise<any>;
export declare function getListDatabasesSummary(dbManager: DatabaseManager): string;
//# sourceMappingURL=list-databases.d.ts.map