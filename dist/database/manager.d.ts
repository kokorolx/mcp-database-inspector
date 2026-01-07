import { DatabaseInfo, QueryResult, TableInfo, ColumnInfo, ForeignKeyInfo, IndexInfo, DatabaseType } from './types.js';
export declare class DatabaseManager {
    private databases;
    private readonly connectionTimeout;
    private readonly maxRowLimit;
    addDatabase(url: string, name?: string): Promise<string>;
    removeDatabase(name: string): Promise<void>;
    listDatabases(): DatabaseInfo[];
    getDatabaseType(dbName: string): DatabaseType;
    private getConnection;
    executeQuery(dbName: string, query: string, params?: any[]): Promise<QueryResult>;
    private addRowLimitToQuery;
    getTables(dbName: string): Promise<TableInfo[]>;
    private getTablesPostgres;
    getTableSchema(dbName: string, tableName: string): Promise<ColumnInfo[]>;
    private getTableSchemaPostgres;
    getForeignKeys(dbName: string, tableName?: string): Promise<ForeignKeyInfo[]>;
    private getForeignKeysPostgres;
    getIndexes(dbName: string, tableName: string): Promise<IndexInfo[]>;
    private getIndexesPostgres;
    cleanup(): Promise<void>;
    queryInformationSchema(dbName: string, table: 'COLUMNS' | 'TABLES' | 'ROUTINES', filters?: Record<string, string>, limit?: number): Promise<QueryResult>;
    analyzeQuery(dbName: string, query: string): Promise<any>;
    private summarizePlan;
    private traversePostgresPlan;
    private traverseMySQLPlan;
}
//# sourceMappingURL=manager.d.ts.map