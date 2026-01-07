import { z } from 'zod';
import { DatabaseManager } from '../database/manager.js';
import { Logger } from '../utils/logger.js';
import { ToolError, createErrorResponse } from '../utils/errors.js';

// Tool schema - no input required
const ListDatabasesArgsSchema = z.object({});

export interface ListDatabasesTool {
  name: 'list_databases';
  description: 'List all connected database names with connection status';
  inputSchema: {
    type: 'object';
    properties: {};
    required: never[];
  };
}

export const listDatabasesToolDefinition: ListDatabasesTool = {
  name: 'list_databases',
  description: 'List all connected database names with connection status',
  inputSchema: {
    type: 'object',
    properties: {},
    required: []
  }
};

export async function handleListDatabases(
  args: unknown,
  dbManager: DatabaseManager
): Promise<any> {
  try {
    Logger.info('Executing list_databases tool');

    // Validate arguments (should be empty object)
    const validationResult = ListDatabasesArgsSchema.safeParse(args);
    if (!validationResult.success) {
      Logger.warn('Invalid arguments for list_databases', validationResult.error);
      throw new ToolError(
        `Invalid arguments: ${validationResult.error.issues.map(e => e.message).join(', ')}`,
        'list_databases'
      );
    }

    Logger.time('list_databases_execution');

    // Get database list from manager
    const databases = dbManager.listDatabases();

    Logger.timeEnd('list_databases_execution');
    Logger.info(`Found ${databases.length} configured databases`);

    // Format response with detailed information
    const response = {
      databases: databases.map(db => ({
        name: db.name,
        type: db.type,
        host: db.host,
        database: db.database,
        connected: db.connected,
        lastUsed: db.lastUsed.toISOString(),
        connectionStatus: db.connected ? 'active' : 'disconnected'
      })),
      totalCount: databases.length,
      connectedCount: databases.filter(db => db.connected).length,
      summary: {
        hasConnectedDatabases: databases.length > 0,
        allConnected: databases.every(db => db.connected),
        message: databases.length === 0
          ? 'No databases configured. Add database connections first.'
          : `Found ${databases.length} database(s), ${databases.filter(db => db.connected).length} connected.`
      }
    };

    Logger.debug('list_databases completed successfully', {
      totalDatabases: response.totalCount,
      connectedCount: response.connectedCount
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2)
      }]
    };

  } catch (error) {
    Logger.error('Error in list_databases tool', error);

    if (error instanceof ToolError) {
      throw error;
    }

    throw new ToolError(
      `Failed to list databases: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'list_databases',
      error instanceof Error ? error : undefined
    );
  }
}

export function getListDatabasesSummary(dbManager: DatabaseManager): string {
  try {
    const databases = dbManager.listDatabases();
    const connectedCount = databases.filter(db => db.connected).length;

    if (databases.length === 0) {
      return 'No databases configured';
    }

    return `${databases.length} database(s) configured, ${connectedCount} connected: ${
      databases.map(db => `${db.name} (${db.connected ? 'connected' : 'disconnected'})`).join(', ')
    }`;
  } catch (error) {
    Logger.error('Error getting database summary', error);
    return 'Error retrieving database information';
  }
}
