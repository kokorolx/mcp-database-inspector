#!/usr/bin/env node
import { MySQLInspectorServer } from './server.js';
import { Logger } from './utils/logger.js';
import { InputValidator } from './validators/input-validator.js';
async function main() {
    try {
        // Parse command line arguments
        const args = process.argv.slice(2);
        if (args.length === 0) {
            console.error(`
Usage: mcp-mysql-inspector <database_url1> [database_url2] [database_url3] ...

Examples:
  # Single database
  mcp-mysql-inspector "mysql://user:password@localhost:3306/mydb"

  # Multiple databases
  mcp-mysql-inspector \\
    "mysql://user:pass@db1:3306/orders" \\
    "mysql://user:pass@db2:3306/inventory" \\
    "mysql://user:pass@db3:3306/users"

  # With SSL
  mcp-mysql-inspector "mysql://user:pass@localhost:3306/db?ssl=true"

Environment Variables:
  LOG_LEVEL - Set logging level (error, warn, info, debug, trace)
              Default: info

Database URL Format:
  mysql://username:password@hostname:port/database?options

Supported Options:
  - ssl=true/false - Enable/disable SSL connection
  - timeout=30 - Connection timeout in seconds (default: 30)
`);
            process.exit(1);
        }
        // Set log level from environment
        const logLevel = process.env.LOG_LEVEL?.toLowerCase();
        if (logLevel && ['error', 'warn', 'info', 'debug', 'trace'].includes(logLevel)) {
            Logger.setLogLevel(logLevel);
        }
        Logger.info('MCP MySQL Inspector starting...');
        Logger.info(`Log level: ${Logger.getLogLevel()}`);
        // Validate connection URLs
        const connectionUrls = [];
        for (const url of args) {
            Logger.debug(`Validating connection URL: ${InputValidator.sanitizeForLogging(url)}`);
            const validation = InputValidator.validateConnectionUrl(url);
            if (!validation.isValid) {
                Logger.error(`Invalid connection URL: ${validation.error}`);
                console.error(`Error: Invalid connection URL - ${validation.error}`);
                process.exit(1);
            }
            connectionUrls.push(url);
            Logger.debug(`Connection URL validated successfully`);
        }
        Logger.info(`Validated ${connectionUrls.length} connection URL(s)`);
        // Create and initialize server
        const server = new MySQLInspectorServer();
        // Set up graceful shutdown
        let isShuttingDown = false;
        const shutdownHandler = async () => {
            if (isShuttingDown)
                return;
            isShuttingDown = true;
            Logger.info('Shutting down...');
            try {
                await server.shutdown();
            }
            catch (error) {
                Logger.error('Error during shutdown:', error);
            }
            process.exit(0);
        };
        process.on('SIGINT', shutdownHandler);
        process.on('SIGTERM', shutdownHandler);
        // Initialize with database connections
        Logger.info('Initializing database connections...');
        await server.initialize(connectionUrls);
        // Get server info for logging
        const serverInfo = await server.getServerInfo();
        Logger.info('Server initialization complete', {
            connectedDatabases: serverInfo.connectedDatabases,
            databases: serverInfo.databases.map((db) => db.name),
            status: serverInfo.status
        });
        // Start the server
        await server.run();
        // This point should not be reached as the server runs indefinitely
        Logger.warn('Server.run() returned unexpectedly');
    }
    catch (error) {
        Logger.error('Fatal error during startup:', error);
        console.error(`Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
    }
}
// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    Logger.error('Unhandled Promise Rejection:', { promise, reason });
    console.error('Unhandled Promise Rejection:', reason);
    process.exit(1);
});
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    Logger.error('Uncaught Exception:', error);
    console.error('Uncaught Exception:', error.message);
    process.exit(1);
});
// Start the application
main().catch((error) => {
    Logger.error('Error in main function:', error);
    console.error('Startup error:', error.message);
    process.exit(1);
});
//# sourceMappingURL=index.js.map