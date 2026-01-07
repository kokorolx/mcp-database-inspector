import mysql from 'mysql2/promise';
import { URL } from 'url';
import { DatabaseType } from './types.js';
import { Logger } from '../utils/logger.js';
import { DatabaseError } from '../utils/errors.js';
import { PostgresConnection } from './postgres-connection.js';
export class DatabaseConnection {
    static DEFAULT_TIMEOUT = 30000;
    static DEFAULT_ACQUIRE_TIMEOUT = 60000;
    static detectDatabaseType(url) {
        try {
            const protocol = new URL(url).protocol.replace(':', '');
            if (protocol === 'mysql')
                return DatabaseType.MySQL;
            if (protocol === 'postgresql' || protocol === 'postgres')
                return DatabaseType.PostgreSQL;
            throw new DatabaseError(`Unsupported database protocol: ${protocol}. Supported protocols: mysql, postgresql, postgres.`);
        }
        catch (error) {
            if (error instanceof DatabaseError)
                throw error;
            throw new DatabaseError(`Invalid connection URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    static parseConnectionUrl(url) {
        const type = this.detectDatabaseType(url);
        if (type === DatabaseType.PostgreSQL) {
            return PostgresConnection.parseConnectionUrl(url);
        }
        // MySQL parsing logic (orig)
        try {
            const parsedUrl = new URL(url);
            const options = {
                type: DatabaseType.MySQL,
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
            return options;
        }
        catch (error) {
            throw new DatabaseError(`Invalid connection URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    static async createConnection(options) {
        if (options.type === DatabaseType.PostgreSQL) {
            return PostgresConnection.createClient(options);
        }
        try {
            Logger.info(`Connecting to MySQL database at ${options.host}:${options.port}/${options.database}`);
            const connectionConfig = {
                host: options.host,
                port: options.port,
                user: options.user,
                password: options.password,
                database: options.database,
                multipleStatements: false,
                dateStrings: true,
            };
            if (options.ssl === false) {
                connectionConfig.ssl = false;
            }
            else if (options.ssl === true) {
                connectionConfig.ssl = {};
            }
            else if (options.ssl && typeof options.ssl === 'object') {
                connectionConfig.ssl = options.ssl;
            }
            const connection = await mysql.createConnection(connectionConfig);
            await connection.ping();
            Logger.info(`Successfully connected to MySQL database: ${options.database}`);
            return connection;
        }
        catch (error) {
            Logger.error(`Failed to connect to MySQL database: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw new DatabaseError(`Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    static async executeQuery(connection, query, params, type = DatabaseType.MySQL) {
        if (type === DatabaseType.PostgreSQL) {
            return PostgresConnection.executeQuery(connection, query, params);
        }
        try {
            Logger.debug(`Executing MySQL query: ${query.substring(0, 100)}${query.length > 100 ? '...' : ''}`);
            const [rows, fields] = await connection.execute(query, params);
            const result = {
                rows: Array.isArray(rows) ? rows : [],
                fields: Array.isArray(fields) ? fields : [],
            };
            Logger.debug(`Query executed successfully, returned ${result.rows.length} rows`);
            return result;
        }
        catch (error) {
            Logger.error(`MySQL query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}\n` +
                `Full SQL: ${query}\n` +
                `Params: ${JSON.stringify(params)}`);
            throw new DatabaseError(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    static async closeConnection(connection, type = DatabaseType.MySQL) {
        if (type === DatabaseType.PostgreSQL) {
            return PostgresConnection.closeConnection(connection);
        }
        try {
            await connection.end();
            Logger.info('MySQL connection closed successfully');
        }
        catch (error) {
            Logger.warn(`Error closing MySQL connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    static async testConnection(options) {
        if (options.type === DatabaseType.PostgreSQL) {
            return PostgresConnection.testConnection(options);
        }
        let connection = null;
        try {
            connection = await this.createConnection(options);
            return true;
        }
        catch (error) {
            Logger.warn(`MySQL connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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