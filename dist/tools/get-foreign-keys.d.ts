import { DatabaseManager } from '../database/manager.js';
export interface GetForeignKeysTool {
    name: 'get_foreign_keys';
    description: 'Get foreign key relationships for a table or entire database';
    inputSchema: {
        type: 'object';
        properties: {
            database: {
                type: 'string';
                description: 'Name of the database to analyze';
            };
            table: {
                type: 'string';
                description: 'Optional: specific table name to get foreign keys for';
            };
        };
        required: ['database'];
    };
}
export declare const getForeignKeysToolDefinition: GetForeignKeysTool;
export declare function handleGetForeignKeys(args: unknown, dbManager: DatabaseManager): Promise<any>;
//# sourceMappingURL=get-foreign-keys.d.ts.map