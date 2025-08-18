export interface DatabaseConfig {
    name: string;
    url: string;
    connection: any | null;
    lastUsed: Date;
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    ssl?: boolean | object;
}
export interface DatabaseInfo {
    name: string;
    connected: boolean;
    lastUsed: Date;
    host: string;
    database: string;
}
export interface TableInfo {
    tableName: string;
    tableType: 'BASE TABLE' | 'VIEW' | 'SYSTEM TABLE';
    engine?: string;
    tableRows?: number;
    tableComment?: string;
}
export interface ColumnInfo {
    columnName: string;
    dataType: string;
    isNullable: 'YES' | 'NO';
    columnDefault?: string | null;
    isPrimaryKey: boolean;
    isAutoIncrement: boolean;
    columnComment?: string;
    characterMaximumLength?: number;
    numericPrecision?: number;
    numericScale?: number;
}
export interface ForeignKeyInfo {
    constraintName: string;
    tableName: string;
    columnName: string;
    referencedTableName: string;
    referencedColumnName: string;
    updateRule: string;
    deleteRule: string;
}
export interface IndexInfo {
    tableName: string;
    indexName: string;
    columnName: string;
    nonUnique: boolean;
    indexType: string;
    cardinality?: number;
    subPart?: number;
    nullable: boolean;
}
export interface QueryResult {
    rows: any[];
    fields: any[];
    affectedRows?: number;
}
export interface ValidationResult {
    isValid: boolean;
    error?: string;
    warnings?: string[];
}
export interface DatabaseConnectionOptions {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    ssl?: boolean | object;
    reconnect?: boolean;
}
//# sourceMappingURL=types.d.ts.map