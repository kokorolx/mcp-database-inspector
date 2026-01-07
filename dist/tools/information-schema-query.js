// Tool: informationSchemaQuery
import { z } from 'zod';
import { InputValidator } from '../validators/input-validator.js';
import { Logger } from '../utils/logger.js';
import { ToolError } from '../utils/errors.js';
// Allowed tables for INFORMATION_SCHEMA
const ALLOWED_TABLES = ['COLUMNS', 'TABLES', 'ROUTINES'];
// Zod schema for arguments
const InformationSchemaQueryArgsSchema = z.object({
    database: z.string().min(1, 'Database name is required'),
    table: z.enum(ALLOWED_TABLES),
    filters: z.record(z.string(), z.string()).optional(), // key-value pairs for WHERE
    limit: z.number().int().min(1).max(1000).optional()
});
export const informationSchemaQueryToolDefinition = {
    name: 'information_schema_query',
    description: 'Query INFORMATION_SCHEMA tables (COLUMNS, TABLES, ROUTINES) with filters and limits. Only safe, parameterized queries are allowed.',
    inputSchema: {
        type: 'object',
        properties: {
            database: { type: 'string', description: 'Database name' },
            table: { type: 'string', enum: ALLOWED_TABLES, description: 'INFORMATION_SCHEMA table to query' },
            filters: { type: 'object', description: 'Key-value filters for WHERE clause' },
            limit: { type: 'number', description: 'Maximum number of rows to return (default 100)' }
        },
        required: ['database', 'table']
    }
};
export async function handleInformationSchemaQuery(args, dbManager) {
    try {
        Logger.info('Executing information_schema_query tool');
        const validationResult = InformationSchemaQueryArgsSchema.safeParse(args);
        if (!validationResult.success) {
            Logger.warn('Invalid arguments for information_schema_query', validationResult.error);
            throw new ToolError(`Invalid arguments: ${validationResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`, 'information_schema_query');
        }
        const { database, table, filters, limit } = validationResult.data;
        // Sanitize and validate database name
        const sanitizedDatabase = InputValidator.sanitizeString(database);
        const dbNameValidation = InputValidator.validateDatabaseName(sanitizedDatabase);
        if (!dbNameValidation.isValid) {
            throw new ToolError(`Invalid database name: ${dbNameValidation.error}`, 'information_schema_query');
        }
        // Only allow specific INFORMATION_SCHEMA tables
        if (!ALLOWED_TABLES.includes(table)) {
            throw new ToolError(`Table '${table}' is not allowed. Only ${ALLOWED_TABLES.join(', ')} are permitted.`, 'information_schema_query');
        }
        // Validate filters: only allow string keys/values, and only safe columns
        let safeFilters = {};
        if (filters) {
            for (const [key, value] of Object.entries(filters)) {
                if (!/^[A-Z_]+$/.test(key)) {
                    throw new ToolError(`Invalid filter key: ${key}. Only uppercase letters and underscores allowed.`, 'information_schema_query');
                }
                safeFilters[key] = InputValidator.sanitizeString(value);
            }
        }
        // Limit
        const safeLimit = limit && limit > 0 && limit <= 1000 ? limit : 100;
        Logger.info(`Querying INFORMATION_SCHEMA.${table} for database ${sanitizedDatabase} with filters: ${JSON.stringify(safeFilters)} and limit ${safeLimit}`);
        const result = await dbManager.queryInformationSchema(sanitizedDatabase, table, safeFilters, safeLimit);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify(result.rows, null, 2)
                }]
        };
    }
    catch (error) {
        Logger.error('Error in information_schema_query tool', error);
        if (error instanceof ToolError)
            throw error;
        throw new ToolError(`Failed to query INFORMATION_SCHEMA: ${error instanceof Error ? error.message : 'Unknown error'}`, 'information_schema_query', error instanceof Error ? error : undefined);
    }
}
//# sourceMappingURL=information-schema-query.js.map