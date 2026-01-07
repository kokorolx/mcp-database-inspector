export enum DatabaseType {
  MySQL = 'mysql',
  PostgreSQL = 'postgresql'
}

export interface DatabaseConfig {
  name: string;
  url: string;
  type: DatabaseType;
  connection: any | null; // Can be mysql.Connection or pg.Client
  lastUsed: Date;
  host: string;
  port: number;
  username: string;
  password?: string;
  database: string;
  ssl?: boolean | any;
}

export interface DatabaseInfo {
  name: string;
  type: DatabaseType;
  connected: boolean;
  lastUsed: Date;
  host: string;
  database: string;
}

export interface TableInfo {
  tableName: string;
  tableType: string;
  engine?: string;
  tableRows?: number;
  tableComment?: string;
}

export interface ColumnInfo {
  columnName: string;
  dataType: string;
  isNullable: string;
  columnDefault?: any;
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
  updateRule?: string;
  deleteRule?: string;
}

export interface IndexInfo {
  tableName: string;
  indexName: string;
  columnName: string;
  nonUnique: boolean;
  indexType?: string;
  cardinality?: number;
  subPart?: number;
  nullable: boolean;
  isPrimary?: boolean;
}

export interface QueryResult {
  rows: any[];
  fields: any[];
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

export interface DatabaseConnectionOptions {
  type: DatabaseType;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: boolean | object;
  // timeout and acquireTimeout are not valid for Connection configs and should not be used
  reconnect?: boolean;
}
