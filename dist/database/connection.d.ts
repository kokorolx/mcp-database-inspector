import { DatabaseType, DatabaseConnectionOptions, QueryResult } from './types.js';
export declare class DatabaseConnection {
    private static readonly DEFAULT_TIMEOUT;
    private static readonly DEFAULT_ACQUIRE_TIMEOUT;
    static detectDatabaseType(url: string): DatabaseType;
    static parseConnectionUrl(url: string): DatabaseConnectionOptions;
    static createConnection(options: DatabaseConnectionOptions): Promise<any>;
    static executeQuery(connection: any, query: string, params?: any[], type?: DatabaseType): Promise<QueryResult>;
    static closeConnection(connection: any, type?: DatabaseType): Promise<void>;
    static testConnection(options: DatabaseConnectionOptions): Promise<boolean>;
    static extractDatabaseName(url: string): string;
}
//# sourceMappingURL=connection.d.ts.map