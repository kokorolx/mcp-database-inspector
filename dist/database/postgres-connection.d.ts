import pg from 'pg';
import { DatabaseConnectionOptions, QueryResult } from './types.js';
export declare class PostgresConnection {
    static parseConnectionUrl(url: string): DatabaseConnectionOptions;
    static createClient(options: DatabaseConnectionOptions): Promise<pg.Client>;
    static executeQuery(client: pg.Client, query: string, params?: any[]): Promise<QueryResult>;
    static closeConnection(client: pg.Client): Promise<void>;
    static testConnection(options: DatabaseConnectionOptions): Promise<boolean>;
}
//# sourceMappingURL=postgres-connection.d.ts.map