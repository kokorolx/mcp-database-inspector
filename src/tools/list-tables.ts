import { z } from 'zod';
import { DatabaseManager } from '../database/manager.js';
import { InputValidator } from '../validators/input-validator.js';
import { Logger } from '../utils/logger.js';
import { ToolError, createErrorResponse } from '../utils/errors.js';

// Tool schema
const ListTablesArgsSchema = z.object({
  database: z.string().min(1, 'Database name is required')
});

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

export const listTablesToolDefinition: ListTablesTool = {
  name: 'list_tables',
  description: 'List all tables in the specified database with metadata',
  inputSchema: {
    type: 'object',
    properties: {
      database: {
        type: 'string',
        description: 'Name of the database to list tables from'
      }
    },
    required: ['database']
  }
};

export async function handleListTables(
  args: unknown,
  dbManager: DatabaseManager
): Promise<any> {
  try {
    Logger.info('Executing list_tables tool');
    
    // Validate arguments
    const validationResult = ListTablesArgsSchema.safeParse(args);
    if (!validationResult.success) {
      Logger.warn('Invalid arguments for list_tables', validationResult.error);
      throw new ToolError(
        `Invalid arguments: ${validationResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        'list_tables'
      );
    }

    const { database } = validationResult.data;
    
    // Sanitize database name
    const sanitizedDatabase = InputValidator.sanitizeString(database);
    
    // Validate database name format
    const dbNameValidation = InputValidator.validateDatabaseName(sanitizedDatabase);
    if (!dbNameValidation.isValid) {
      throw new ToolError(
        `Invalid database name: ${dbNameValidation.error}`,
        'list_tables'
      );
    }

    Logger.info(`Listing tables for database: ${sanitizedDatabase}`);
    Logger.time('list_tables_execution');
    
    // Get tables from database
    const tables = await dbManager.getTables(sanitizedDatabase);
    
    Logger.timeEnd('list_tables_execution');
    Logger.info(`Found ${tables.length} tables in database: ${sanitizedDatabase}`);

    // Group tables by type
    const tablesByType = tables.reduce((acc, table) => {
      const type = table.tableType;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(table);
      return acc;
    }, {} as Record<string, typeof tables>);

    // Calculate statistics
    const stats = {
      totalTables: tables.length,
      baseTables: (tablesByType['BASE TABLE'] || []).length,
      views: (tablesByType['VIEW'] || []).length,
      systemTables: (tablesByType['SYSTEM TABLE'] || []).length,
      totalEstimatedRows: tables.reduce((sum, table) => sum + (table.tableRows || 0), 0)
    };

    // Format response
    const response = {
      database: sanitizedDatabase,
      tables: tables.map(table => ({
        name: table.tableName,
        type: table.tableType,
        engine: table.engine,
        estimatedRows: table.tableRows,
        comment: table.tableComment,
        category: table.tableType === 'BASE TABLE' ? 'table' : 
                 table.tableType === 'VIEW' ? 'view' : 
                 'system'
      })),
      statistics: stats,
      tablesByType: Object.keys(tablesByType).map(type => ({
        type,
        count: tablesByType[type].length,
        tables: tablesByType[type].map(t => t.tableName)
      })),
      summary: {
        hasData: tables.length > 0,
        message: tables.length === 0 
          ? `No tables found in database '${sanitizedDatabase}'. Database may be empty or inaccessible.`
          : `Found ${tables.length} table(s) in database '${sanitizedDatabase}': ${stats.baseTables} base tables, ${stats.views} views.`
      }
    };

    Logger.debug('list_tables completed successfully', {
      database: sanitizedDatabase,
      tableCount: tables.length,
      baseTables: stats.baseTables,
      views: stats.views
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2)
      }]
    };

  } catch (error) {
    Logger.error('Error in list_tables tool', error);
    
    if (error instanceof ToolError) {
      throw error;
    }
    
    throw new ToolError(
      `Failed to list tables: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'list_tables',
      error instanceof Error ? error : undefined
    );
  }
}

export async function getTablesSummary(
  dbManager: DatabaseManager, 
  database: string
): Promise<string> {
  try {
    const tables = await dbManager.getTables(database);
    const baseTables = tables.filter(t => t.tableType === 'BASE TABLE').length;
    const views = tables.filter(t => t.tableType === 'VIEW').length;
    
    if (tables.length === 0) {
      return `Database '${database}' has no tables`;
    }
    
    const parts = [];
    if (baseTables > 0) parts.push(`${baseTables} table(s)`);
    if (views > 0) parts.push(`${views} view(s)`);
    
    return `Database '${database}' contains ${parts.join(', ')}: ${
      tables.slice(0, 5).map(t => t.tableName).join(', ')
    }${tables.length > 5 ? `, and ${tables.length - 5} more` : ''}`;
  } catch (error) {
    Logger.error(`Error getting table summary for ${database}`, error);
    return `Error retrieving tables for database '${database}'`;
  }
}
