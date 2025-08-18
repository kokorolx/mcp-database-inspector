import { DatabaseManager } from '../database/manager.js';
declare const ALLOWED_TABLES: readonly ["COLUMNS", "TABLES", "ROUTINES"];
export interface InformationSchemaQueryTool {
    name: 'information_schema_query';
    description: 'Query INFORMATION_SCHEMA tables (COLUMNS, TABLES, ROUTINES) with filters and limits. Only safe, parameterized queries are allowed.';
    inputSchema: {
        type: 'object';
        properties: {
            database: {
                type: 'string';
                description: 'Database name';
            };
            table: {
                type: 'string';
                enum: typeof ALLOWED_TABLES;
                description: 'INFORMATION_SCHEMA table to query';
            };
            filters?: {
                type: 'object';
                description: 'Key-value filters for WHERE clause';
            };
            limit?: {
                type: 'number';
                description: 'Maximum number of rows to return (default 100)';
            };
        };
        required: ['database', 'table'];
    };
}
export declare const informationSchemaQueryToolDefinition: InformationSchemaQueryTool;
export declare function handleInformationSchemaQuery(args: unknown, dbManager: DatabaseManager): Promise<any>;
export {};
//# sourceMappingURL=information-schema-query.d.ts.map