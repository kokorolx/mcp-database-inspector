import pg from 'pg';
import { URL } from 'url';
import { DatabaseType } from './types.js';
import { Logger } from '../utils/logger.js';
import { DatabaseError } from '../utils/errors.js';
export class PostgresConnection {
    static parseConnectionUrl(url) {
        try {
            const parsedUrl = new URL(url);
            if (parsedUrl.protocol !== 'postgresql:' && parsedUrl.protocol !== 'postgres:') {
                throw new DatabaseError(`Unsupported protocol: ${parsedUrl.protocol}. Only 'postgresql:' or 'postgres:' is supported.`);
            }
            const options = {
                type: DatabaseType.PostgreSQL,
                host: parsedUrl.hostname,
                port: parsedUrl.port ? parseInt(parsedUrl.port) : 5432,
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
                else if (sslValue === 'no-verify') {
                    options.ssl = { rejectUnauthorized: false };
                }
            }
            return options;
        }
        catch (error) {
            throw new DatabaseError(`Invalid connection URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    static async createClient(options) {
        try {
            Logger.info(`Connecting to PostgreSQL database at ${options.host}:${options.port}/${options.database}`);
            const clientConfig = {
                host: options.host,
                port: options.port,
                user: options.user,
                password: options.password,
                database: options.database,
            };
            if (options.ssl) {
                clientConfig.ssl = options.ssl;
            }
            const client = new pg.Client(clientConfig);
            await client.connect();
            // Test the connection
            await client.query('SELECT 1');
            Logger.info(`Successfully connected to PostgreSQL database: ${options.database}`);
            return client;
        }
        catch (error) {
            Logger.error(`Failed to connect to PostgreSQL database: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw new DatabaseError(`Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    static async executeQuery(client, query, params) {
        try {
            Logger.debug(`Executing PostgreSQL query: ${query.substring(0, 100)}${query.length > 100 ? '...' : ''}`);
            // PostgreSQL uses $1, $2 for parameters, but if we receive ? from MySQL style queries
            // we might need translation, but for now we expect raw compatibility or manual handling
            const res = await client.query(query, params);
            const result = {
                rows: res.rows,
                fields: res.fields.map((f) => ({ name: f.name, type: f.dataTypeID })),
            };
            Logger.debug(`Query executed successfully, returned ${result.rows.length} rows`);
            return result;
        }
        catch (error) {
            Logger.error(`PostgreSQL query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}\n` +
                `Full SQL: ${query}\n` +
                `Params: ${JSON.stringify(params)}`);
            throw new DatabaseError(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    static async closeConnection(client) {
        try {
            await client.end();
            Logger.info('PostgreSQL connection closed successfully');
        }
        catch (error) {
            Logger.warn(`Error closing PostgreSQL connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    static async testConnection(options) {
        let client = null;
        try {
            client = await this.createClient(options);
            return true;
        }
        catch (error) {
            Logger.warn(`PostgreSQL connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return false;
        }
        finally {
            if (client) {
                await this.closeConnection(client);
            }
        }
    }
}
//# sourceMappingURL=postgres-connection.js.map