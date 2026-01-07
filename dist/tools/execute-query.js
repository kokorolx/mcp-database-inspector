import { z } from 'zod';
import { InputValidator } from '../validators/input-validator.js';
import { Logger } from '../utils/logger.js';
import { ToolError } from '../utils/errors.js';
// Zod schema for arguments
const ExecuteQueryArgsSchema = z.object({
    database: z.string().min(1, 'Database name is required'),
    query: z.string().min(1, 'SQL query is required'),
    params: z.array(z.any()).optional(),
    limit: z.number().int().min(1).max(1000).optional()
});
export const executeQueryToolDefinition = {
    name: 'execute_query',
    description: 'Execute a safe read-only SQL query (SELECT, SHOW, DESCRIBE, EXPLAIN). Automatic row limits are applied for security.',
    inputSchema: {
        type: 'object',
        properties: {
            database: { type: 'string', description: 'Database name' },
            query: { type: 'string', description: 'SQL query to execute' },
            params: { type: 'array', items: { type: 'any' }, description: 'Optional parameters for the query' },
            limit: { type: 'number', description: 'Optional limit for number of rows (default 1000, max 1000)' }
        },
        required: ['database', 'query']
    }
};
export async function handleExecuteQuery(args, dbManager) {
    try {
        Logger.info('Executing execute_query tool');
        const validationResult = ExecuteQueryArgsSchema.safeParse(args);
        if (!validationResult.success) {
            Logger.warn('Invalid arguments for execute_query', validationResult.error);
            throw new ToolError(`Invalid arguments: ${validationResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`, 'execute_query');
        }
        const { database, query, params, limit } = validationResult.data;
        // Sanitize and validate database name
        const sanitizedDatabase = InputValidator.sanitizeString(database);
        const dbNameValidation = InputValidator.validateDatabaseName(sanitizedDatabase);
        if (!dbNameValidation.isValid) {
            throw new ToolError(`Invalid database name: ${dbNameValidation.error}`, 'execute_query');
        }
        Logger.info(`Executing query on database ${sanitizedDatabase}`);
        const result = await dbManager.executeQuery(sanitizedDatabase, query, params);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify(result.rows, null, 2)
                }]
        };
    }
    catch (error) {
        Logger.error('Error in execute_query tool', error);
        if (error instanceof ToolError)
            throw error;
        throw new ToolError(`Failed to execute query: ${error instanceof Error ? error.message : 'Unknown error'}`, 'execute_query', error instanceof Error ? error : undefined);
    }
}
//# sourceMappingURL=execute-query.js.map