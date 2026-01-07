import { DatabaseManager } from '../database/manager.js';
export interface ExecuteQueryTool {
    name: 'execute_query';
    description: 'Execute a safe read-only SQL query (SELECT, SHOW, DESCRIBE, EXPLAIN). Automatic row limits are applied for security.';
    inputSchema: {
        type: 'object';
        properties: {
            database: {
                type: 'string';
                description: 'Database name';
            };
            query: {
                type: 'string';
                description: 'SQL query to execute';
            };
            params?: {
                type: 'array';
                items: {
                    type: 'any';
                };
                description: 'Optional parameters for the query';
            };
            limit?: {
                type: 'number';
                description: 'Optional limit for number of rows (default 1000, max 1000)';
            };
        };
        required: ['database', 'query'];
    };
}
export declare const executeQueryToolDefinition: ExecuteQueryTool;
export declare function handleExecuteQuery(args: unknown, dbManager: DatabaseManager): Promise<any>;
//# sourceMappingURL=execute-query.d.ts.map