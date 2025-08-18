import { DatabaseConnection } from './connection.js';
import { QueryValidator } from '../validators/query-validator.js';
import { Logger } from '../utils/logger.js';
import { DatabaseError, ValidationError } from '../utils/errors.js';
export class DatabaseManager {
    databases = new Map();
    connectionTimeout = 30000;
    maxRowLimit = 1000;
    async addDatabase(url, name) {
        try {
            const connectionOptions = DatabaseConnection.parseConnectionUrl(url);
            const dbName = name || DatabaseConnection.extractDatabaseName(url);
            // Test the connection first
            const isConnectable = await DatabaseConnection.testConnection(connectionOptions);
            if (!isConnectable) {
                throw new DatabaseError(`Cannot connect to database: ${dbName}`);
            }
            const config = {
                name: dbName,
                url,
                connection: null,
                lastUsed: new Date(),
                host: connectionOptions.host,
                port: connectionOptions.port,
                username: connectionOptions.user,
                password: connectionOptions.password,
                database: connectionOptions.database,
                ssl: connectionOptions.ssl
            };
            this.databases.set(dbName, config);
            Logger.info(`Added database configuration: ${dbName}`);
            return dbName;
        }
        catch (error) {
            Logger.error(`Failed to add database: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }
    async removeDatabase(name) {
        const config = this.databases.get(name);
        if (!config) {
            throw new DatabaseError(`Database not found: ${name}`);
        }
        if (config.connection) {
            await DatabaseConnection.closeConnection(config.connection);
        }
        this.databases.delete(name);
        Logger.info(`Removed database: ${name}`);
    }
    listDatabases() {
        return Array.from(this.databases.values()).map(config => ({
            name: config.name,
            connected: config.connection !== null,
            lastUsed: config.lastUsed,
            host: config.host,
            database: config.database
        }));
    }
    async getConnection(dbName) {
        const config = this.databases.get(dbName);
        if (!config) {
            throw new DatabaseError(`Database not found: ${dbName}`);
        }
        // Create new connection for each request (stateless approach)
        const connectionOptions = DatabaseConnection.parseConnectionUrl(config.url);
        const connection = await DatabaseConnection.createConnection(connectionOptions);
        config.lastUsed = new Date();
        return connection;
    }
    async executeQuery(dbName, query, params) {
        // Validate query is read-only
        const validation = QueryValidator.validateQuery(query);
        if (!validation.isValid) {
            throw new ValidationError(`Query validation failed: ${validation.error}`);
        }
        let connection = null;
        try {
            connection = await this.getConnection(dbName);
            // Add row limit to SELECT queries if not already present
            const limitedQuery = this.addRowLimitToQuery(query);
            const result = await DatabaseConnection.executeQuery(connection, limitedQuery, params);
            return result;
        }
        finally {
            if (connection) {
                await DatabaseConnection.closeConnection(connection);
            }
        }
    }
    addRowLimitToQuery(query) {
        const trimmedQuery = query.trim().toUpperCase();
        if (trimmedQuery.startsWith('SELECT') && !trimmedQuery.includes('LIMIT')) {
            return `${query.trim()} LIMIT ${this.maxRowLimit}`;
        }
        return query;
    }
    async getTables(dbName) {
        const query = `
      SELECT 
        TABLE_NAME as tableName,
        TABLE_TYPE as tableType,
        ENGINE as engine,
        TABLE_ROWS as tableRows,
        TABLE_COMMENT as tableComment
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME
    `;
        let connection = null;
        try {
            connection = await this.getConnection(dbName);
            const config = this.databases.get(dbName);
            const result = await DatabaseConnection.executeQuery(connection, query, [config.database]);
            return result.rows.map(row => ({
                tableName: row.tableName,
                tableType: row.tableType,
                engine: row.engine,
                tableRows: row.tableRows ? parseInt(row.tableRows) : undefined,
                tableComment: row.tableComment || undefined
            }));
        }
        finally {
            if (connection) {
                await DatabaseConnection.closeConnection(connection);
            }
        }
    }
    async getTableSchema(dbName, tableName) {
        const query = `
      SELECT 
        c.COLUMN_NAME as columnName,
        c.DATA_TYPE as dataType,
        c.IS_NULLABLE as isNullable,
        c.COLUMN_DEFAULT as columnDefault,
        c.EXTRA as extra,
        c.COLUMN_COMMENT as columnComment,
        c.CHARACTER_MAXIMUM_LENGTH as characterMaximumLength,
        c.NUMERIC_PRECISION as numericPrecision,
        c.NUMERIC_SCALE as numericScale,
        CASE WHEN k.COLUMN_NAME IS NOT NULL THEN true ELSE false END as isPrimaryKey
      FROM INFORMATION_SCHEMA.COLUMNS c
      LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE k 
        ON c.TABLE_SCHEMA = k.TABLE_SCHEMA 
        AND c.TABLE_NAME = k.TABLE_NAME 
        AND c.COLUMN_NAME = k.COLUMN_NAME
        AND k.CONSTRAINT_NAME = 'PRIMARY'
      WHERE c.TABLE_SCHEMA = ? AND c.TABLE_NAME = ?
      ORDER BY c.ORDINAL_POSITION
    `;
        let connection = null;
        try {
            connection = await this.getConnection(dbName);
            const config = this.databases.get(dbName);
            const result = await DatabaseConnection.executeQuery(connection, query, [config.database, tableName]);
            return result.rows.map(row => ({
                columnName: row.columnName,
                dataType: row.dataType,
                isNullable: row.isNullable,
                columnDefault: row.columnDefault,
                isPrimaryKey: Boolean(row.isPrimaryKey),
                isAutoIncrement: row.extra && row.extra.toLowerCase().includes('auto_increment'),
                columnComment: row.columnComment || undefined,
                characterMaximumLength: row.characterMaximumLength,
                numericPrecision: row.numericPrecision,
                numericScale: row.numericScale
            }));
        }
        finally {
            if (connection) {
                await DatabaseConnection.closeConnection(connection);
            }
        }
    }
    async getForeignKeys(dbName, tableName) {
        let query = `
      SELECT
        rc.CONSTRAINT_NAME as constraintName,
        kcu.TABLE_NAME as tableName,
        kcu.COLUMN_NAME as columnName,
        kcu.REFERENCED_TABLE_NAME as referencedTableName,
        kcu.REFERENCED_COLUMN_NAME as referencedColumnName,
        rc.UPDATE_RULE as updateRule,
        rc.DELETE_RULE as deleteRule
      FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
        ON rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
        AND rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
      WHERE rc.CONSTRAINT_SCHEMA = ?
    `;
        const params = [];
        const config = this.databases.get(dbName);
        params.push(config.database);
        if (tableName) {
            query += ' AND kcu.TABLE_NAME = ?';
            params.push(tableName);
        }
        query += ' ORDER BY kcu.TABLE_NAME, rc.CONSTRAINT_NAME';
        let connection = null;
        try {
            connection = await this.getConnection(dbName);
            const result = await DatabaseConnection.executeQuery(connection, query, params);
            return result.rows.map(row => ({
                constraintName: row.constraintName,
                tableName: row.tableName,
                columnName: row.columnName,
                referencedTableName: row.referencedTableName,
                referencedColumnName: row.referencedColumnName,
                updateRule: row.updateRule,
                deleteRule: row.deleteRule
            }));
        }
        finally {
            if (connection) {
                await DatabaseConnection.closeConnection(connection);
            }
        }
    }
    async getIndexes(dbName, tableName) {
        const query = `
      SELECT 
        TABLE_NAME as tableName,
        INDEX_NAME as indexName,
        COLUMN_NAME as columnName,
        NON_UNIQUE as nonUnique,
        INDEX_TYPE as indexType,
        CARDINALITY as cardinality,
        SUB_PART as subPart,
        NULLABLE as nullable
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY INDEX_NAME, SEQ_IN_INDEX
    `;
        let connection = null;
        try {
            connection = await this.getConnection(dbName);
            const config = this.databases.get(dbName);
            const result = await DatabaseConnection.executeQuery(connection, query, [config.database, tableName]);
            return result.rows.map(row => ({
                tableName: row.tableName,
                indexName: row.indexName,
                columnName: row.columnName,
                nonUnique: Boolean(row.nonUnique),
                indexType: row.indexType,
                cardinality: row.cardinality,
                subPart: row.subPart,
                nullable: row.nullable === 'YES'
            }));
        }
        finally {
            if (connection) {
                await DatabaseConnection.closeConnection(connection);
            }
        }
    }
    async cleanup() {
        Logger.info('Cleaning up database connections...');
        for (const [name, config] of this.databases) {
            if (config.connection) {
                try {
                    await DatabaseConnection.closeConnection(config.connection);
                }
                catch (error) {
                    Logger.warn(`Error closing connection for ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
        }
        this.databases.clear();
        Logger.info('Database cleanup completed');
    }
}
//# sourceMappingURL=manager.js.map