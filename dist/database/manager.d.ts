import { DatabaseInfo, QueryResult, TableInfo, ColumnInfo, ForeignKeyInfo, IndexInfo } from './types.js';
export declare class DatabaseManager {
    private databases;
    private readonly connectionTimeout;
    private readonly maxRowLimit;
    addDatabase(url: string, name?: string): Promise<string>;
    removeDatabase(name: string): Promise<void>;
    listDatabases(): DatabaseInfo[];
    private getConnection;
    executeQuery(dbName: string, query: string, params?: any[]): Promise<QueryResult>;
    private addRowLimitToQuery;
    getTables(dbName: string): Promise<TableInfo[]>;
    getTableSchema(dbName: string, tableName: string): Promise<ColumnInfo[]>;
    getForeignKeys(dbName: string, tableName?: string): Promise<ForeignKeyInfo[]>;
    getIndexes(dbName: string, tableName: string): Promise<IndexInfo[]>;
    cleanup(): Promise<void>;
    /**
     * Query INFORMATION_SCHEMA tables (COLUMNS, TABLES, ROUTINES) with filters and limits.
     * Only allows safe, parameterized queries.
     */
    queryInformationSchema(dbName: string, table: 'COLUMNS' | 'TABLES' | 'ROUTINES', filters?: Record<string, string>, limit?: number): Promise<QueryResult>;
}
//# sourceMappingURL=manager.d.ts.map