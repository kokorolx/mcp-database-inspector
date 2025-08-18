import mysql from 'mysql2/promise';
import { DatabaseConnectionOptions, QueryResult } from './types.js';
export declare class DatabaseConnection {
    private static readonly DEFAULT_TIMEOUT;
    private static readonly DEFAULT_ACQUIRE_TIMEOUT;
    static parseConnectionUrl(url: string): DatabaseConnectionOptions;
    static createConnection(options: DatabaseConnectionOptions): Promise<mysql.Connection>;
    static executeQuery(connection: mysql.Connection, query: string, params?: any[]): Promise<QueryResult>;
    static closeConnection(connection: mysql.Connection): Promise<void>;
    static testConnection(options: DatabaseConnectionOptions): Promise<boolean>;
    static extractDatabaseName(url: string): string;
}
//# sourceMappingURL=connection.d.ts.map