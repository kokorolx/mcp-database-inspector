import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { DatabaseManager } from './database/manager.js';
import { Logger } from './utils/logger.js';
import { createErrorResponse, ToolError } from './utils/errors.js';
// Import tool handlers
import { listDatabasesToolDefinition, handleListDatabases } from './tools/list-databases.js';
import { listTablesToolDefinition, handleListTables } from './tools/list-tables.js';
import { inspectTableToolDefinition, handleInspectTable } from './tools/inspect-table.js';
import { getForeignKeysToolDefinition, handleGetForeignKeys } from './tools/get-foreign-keys.js';
import { getIndexesToolDefinition, handleGetIndexes } from './tools/get-indexes.js';
import { informationSchemaQueryToolDefinition, handleInformationSchemaQuery } from './tools/information-schema-query.js';
export class MySQLInspectorServer {
    server;
    dbManager;
    constructor() {
        this.server = new Server({
            name: 'mcp-mysql-inspector',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.dbManager = new DatabaseManager();
        this.setupHandlers();
    }
    setupHandlers() {
        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            Logger.debug('Received list_tools request');
            return {
                tools: [
                    listDatabasesToolDefinition,
                    listTablesToolDefinition,
                    inspectTableToolDefinition,
                    getForeignKeysToolDefinition,
                    getIndexesToolDefinition,
                    informationSchemaQueryToolDefinition
                ]
            };
        });
        // Handle tool calls
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            Logger.info(`Received tool call: ${name}`);
            Logger.debug(`Tool arguments:`, args);
            try {
                switch (name) {
                    case 'list_databases':
                        return await handleListDatabases(args, this.dbManager);
                    case 'list_tables':
                        return await handleListTables(args, this.dbManager);
                    case 'inspect_table':
                        return await handleInspectTable(args, this.dbManager);
                    case 'get_foreign_keys':
                        return await handleGetForeignKeys(args, this.dbManager);
                    case 'get_indexes':
                        return await handleGetIndexes(args, this.dbManager);
                    case 'information_schema_query':
                        return await handleInformationSchemaQuery(args, this.dbManager);
                    default:
                        Logger.warn(`Unknown tool requested: ${name}`);
                        throw new ToolError(`Unknown tool: ${name}`);
                }
            }
            catch (error) {
                Logger.error(`Error executing tool ${name}:`, error);
                const errorResponse = createErrorResponse(error instanceof Error ? error : new Error('Unknown error'));
                return {
                    content: [{
                            type: 'text',
                            text: `Error: ${errorResponse.error}`
                        }],
                    isError: true
                };
            }
        });
        // Handle server errors
        this.server.onerror = (error) => {
            Logger.error('Server error:', error);
        };
    }
    async initialize(connectionUrls) {
        Logger.info('Initializing MySQL Inspector Server');
        Logger.info(`Connection URLs provided: ${connectionUrls.length}`);
        if (connectionUrls.length === 0) {
            throw new Error('At least one database connection URL is required');
        }
        // Add databases to manager
        for (let i = 0; i < connectionUrls.length; i++) {
            const url = connectionUrls[i];
            try {
                Logger.info(`Adding database connection ${i + 1}/${connectionUrls.length}`);
                const dbName = await this.dbManager.addDatabase(url);
                Logger.info(`Successfully added database: ${dbName}`);
            }
            catch (error) {
                Logger.error(`Failed to add database from URL: ${url}`, error);
                // Continue with other databases instead of failing completely
            }
        }
        const databases = this.dbManager.listDatabases();
        if (databases.length === 0) {
            throw new Error('No valid database connections could be established');
        }
        Logger.info(`Server initialized with ${databases.length} database(s): ${databases.map(db => db.name).join(', ')}`);
    }
    async run() {
        Logger.info('Starting MySQL Inspector MCP Server');
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        Logger.info('Server started and listening for requests');
    }
    async shutdown() {
        Logger.info('Shutting down MySQL Inspector Server');
        try {
            await this.dbManager.cleanup();
            Logger.info('Database connections cleaned up');
        }
        catch (error) {
            Logger.error('Error during database cleanup:', error);
        }
        Logger.info('Server shutdown complete');
    }
    // Utility methods for external use
    getDatabaseManager() {
        return this.dbManager;
    }
    async getServerInfo() {
        const databases = this.dbManager.listDatabases();
        return {
            serverName: 'mcp-mysql-inspector',
            version: '1.0.0',
            connectedDatabases: databases.length,
            databases: databases.map(db => ({
                name: db.name,
                host: db.host,
                database: db.database,
                connected: db.connected,
                lastUsed: db.lastUsed.toISOString()
            })),
            capabilities: [
                'list_databases',
                'list_tables',
                'inspect_table',
                'get_foreign_keys',
                'get_indexes'
            ],
            status: databases.length > 0 ? 'ready' : 'no_connections'
        };
    }
}
// Error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
    Logger.error('Uncaught exception:', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    Logger.error('Unhandled rejection:', { promise, reason });
    process.exit(1);
});
// Graceful shutdown
process.on('SIGINT', async () => {
    Logger.info('Received SIGINT, shutting down gracefully...');
    process.exit(0);
});
process.on('SIGTERM', async () => {
    Logger.info('Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});
export default MySQLInspectorServer;
//# sourceMappingURL=server.js.map