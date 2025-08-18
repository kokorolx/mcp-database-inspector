import mysql from 'mysql2/promise';
import { URL } from 'url';
import { Logger } from '../utils/logger.js';
import { DatabaseError } from '../utils/errors.js';
export class DatabaseConnection {
    static DEFAULT_TIMEOUT = 30000;
    static DEFAULT_ACQUIRE_TIMEOUT = 60000;
    static parseConnectionUrl(url) {
        try {
            const parsedUrl = new URL(url);
            if (parsedUrl.protocol !== 'mysql:') {
                throw new DatabaseError(`Unsupported protocol: ${parsedUrl.protocol}. Only 'mysql:' is supported.`);
            }
            const options = {
                host: parsedUrl.hostname,
                port: parsedUrl.port ? parseInt(parsedUrl.port) : 3306,
                user: parsedUrl.username,
                password: parsedUrl.password,
                database: parsedUrl.pathname.slice(1), // Remove leading slash
                reconnect: true
            };
            // Parse SSL settings from query parameters
            const searchParams = parsedUrl.searchParams;
            if (searchParams.has('ssl')) {
                const sslValue = searchParams.get('ssl');
                if (sslValue === 'true' || sslValue === '1') {
                    options.ssl = true;
                }
                else if (sslValue === 'false' || sslValue === '0') {
                    options.ssl = false;
                }
            }
            // Parse timeout if specified
            // (timeout property is deprecated and no longer used)
            return options;
        }
        catch (error) {
            throw new DatabaseError(`Invalid connection URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    static async createConnection(options) {
        try {
            Logger.info(`Connecting to database at ${options.host}:${options.port}/${options.database}`);
            const connectionConfig = {
                host: options.host,
                port: options.port,
                user: options.user,
                password: options.password,
                database: options.database,
                // Additional security settings
                multipleStatements: false, // Prevent SQL injection through multiple statements
                dateStrings: true, // Return dates as strings to avoid timezone issues
            };
            // Handle SSL configuration properly
            if (options.ssl === false) {
                // Explicitly disable SSL
                connectionConfig.ssl = false;
            }
            else if (options.ssl === true) {
                // Enable SSL with default options
                connectionConfig.ssl = {};
            }
            else if (options.ssl && typeof options.ssl === 'object') {
                // Use custom SSL options
                connectionConfig.ssl = options.ssl;
            }
            // If ssl is undefined, don't set it (use MySQL default)
            const connection = await mysql.createConnection(connectionConfig);
            // Test the connection
            await connection.ping();
            Logger.info(`Successfully connected to database: ${options.database}`);
            return connection;
        }
        catch (error) {
            Logger.error(`Failed to connect to database: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw new DatabaseError(`Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    static async executeQuery(connection, query, params) {
        try {
            Logger.debug(`Executing query: ${query.substring(0, 100)}${query.length > 100 ? '...' : ''}`);
            const [rows, fields] = await connection.execute(query, params);
            const result = {
                rows: Array.isArray(rows) ? rows : [],
                fields: Array.isArray(fields) ? fields : [],
            };
            Logger.debug(`Query executed successfully, returned ${result.rows.length} rows`);
            return result;
        }
        catch (error) {
            Logger.error(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}\n` +
                `Full SQL: ${query}\n` +
                `Params: ${JSON.stringify(params)}`);
            throw new DatabaseError(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    static async closeConnection(connection) {
        try {
            await connection.end();
            Logger.info('Database connection closed successfully');
        }
        catch (error) {
            Logger.warn(`Error closing database connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    static async testConnection(options) {
        let connection = null;
        try {
            connection = await this.createConnection(options);
            await connection.ping();
            return true;
        }
        catch (error) {
            Logger.warn(`Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return false;
        }
        finally {
            if (connection) {
                await this.closeConnection(connection);
            }
        }
    }
    static extractDatabaseName(url) {
        try {
            const parsedUrl = new URL(url);
            return parsedUrl.pathname.slice(1) || 'default';
        }
        catch {
            return 'default';
        }
    }
}
//# sourceMappingURL=connection.js.map