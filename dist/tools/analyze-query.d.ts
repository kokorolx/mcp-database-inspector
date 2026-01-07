import { z } from 'zod';
import { DatabaseManager } from '../database/manager.js';
export declare const AnalyzeQueryArgsSchema: z.ZodObject<{
    database: z.ZodString;
    query: z.ZodString;
}, z.core.$strip>;
export interface AnalyzeQueryTool {
    name: 'analyze_query';
    description: 'Analyze a SQL query performance and provide recommendations';
    inputSchema: {
        type: 'object';
        properties: {
            database: {
                type: 'string';
                description: 'Name of the database to run the analysis against';
            };
            query: {
                type: 'string';
                description: 'The SQL query to analyze';
            };
        };
        required: ['database', 'query'];
    };
}
export declare const analyzeQueryToolDefinition: AnalyzeQueryTool;
export declare function handleAnalyzeQuery(args: unknown, dbManager: DatabaseManager): Promise<any>;
//# sourceMappingURL=analyze-query.d.ts.map