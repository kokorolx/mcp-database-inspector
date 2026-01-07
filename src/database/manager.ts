import mysql from 'mysql2/promise';
import pg from 'pg';
import { DatabaseConfig, DatabaseInfo, QueryResult, TableInfo, ColumnInfo, ForeignKeyInfo, IndexInfo, DatabaseType } from './types.js';
import { DatabaseConnection } from './connection.js';
import { QueryValidator } from '../validators/query-validator.js';
import { Logger } from '../utils/logger.js';
import { DatabaseError, ValidationError } from '../utils/errors.js';

export class DatabaseManager {
  private databases: Map<string, DatabaseConfig> = new Map();
  private readonly connectionTimeout: number = 30000;
  private readonly maxRowLimit: number = 1000;

  async addDatabase(url: string, name?: string): Promise<string> {
    try {
      const type = DatabaseConnection.detectDatabaseType(url);
      const connectionOptions = DatabaseConnection.parseConnectionUrl(url);
      const dbName = name || DatabaseConnection.extractDatabaseName(url);

      // Test the connection first
      const isConnectable = await DatabaseConnection.testConnection(connectionOptions);
      if (!isConnectable) {
        throw new DatabaseError(`Cannot connect to database: ${dbName}`);
      }

      const config: DatabaseConfig = {
        name: dbName,
        url,
        type,
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
      Logger.info(`Added ${type} database configuration: ${dbName}`);
      return dbName;
    } catch (error) {
      Logger.error(`Failed to add database: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async removeDatabase(name: string): Promise<void> {
    const config = this.databases.get(name);
    if (!config) {
      throw new DatabaseError(`Database not found: ${name}`);
    }

    if (config.connection) {
      await DatabaseConnection.closeConnection(config.connection, config.type);
    }

    this.databases.delete(name);
    Logger.info(`Removed database: ${name}`);
  }

  listDatabases(): DatabaseInfo[] {
    return Array.from(this.databases.values()).map(config => ({
      name: config.name,
      type: config.type,
      connected: config.connection !== null,
      lastUsed: config.lastUsed,
      host: config.host,
      database: config.database
    }));
  }

  getDatabaseType(dbName: string): DatabaseType {
    const config = this.databases.get(dbName);
    if (!config) {
      throw new DatabaseError(`Database not found: ${dbName}`);
    }
    return config.type;
  }

  private async getConnection(dbName: string): Promise<any> {
    const config = this.databases.get(dbName);
    if (!config) {
      throw new DatabaseError(`Database not found: ${dbName}`);
    }

    const connectionOptions = DatabaseConnection.parseConnectionUrl(config.url);
    const connection = await DatabaseConnection.createConnection(connectionOptions);

    config.lastUsed = new Date();
    return connection;
  }

  async executeQuery(dbName: string, query: string, params?: any[]): Promise<QueryResult> {
    const config = this.databases.get(dbName);
    if (!config) throw new DatabaseError(`Database not found: ${dbName}`);

    // Validate query is read-only
    const validation = QueryValidator.validateQuery(query);
    if (!validation.isValid) {
      throw new ValidationError(`Query validation failed: ${validation.error}`);
    }

    let connection: any = null;
    try {
      connection = await this.getConnection(dbName);

      // Add row limit to SELECT queries if not already present
      const limitedQuery = this.addRowLimitToQuery(query, config.type);

      const result = await DatabaseConnection.executeQuery(connection, limitedQuery, params, config.type);
      return result;
    } finally {
      if (connection) {
        await DatabaseConnection.closeConnection(connection, config.type);
      }
    }
  }

  private addRowLimitToQuery(query: string, type: DatabaseType): string {
    const trimmedQuery = query.trim().toUpperCase();

    if (trimmedQuery.startsWith('SELECT') && !trimmedQuery.includes('LIMIT')) {
      if (type === DatabaseType.PostgreSQL) {
          return `${query.trim()} LIMIT ${this.maxRowLimit}`;
      }
      return `${query.trim()} LIMIT ${this.maxRowLimit}`;
    }

    return query;
  }

  async getTables(dbName: string): Promise<TableInfo[]> {
    const config = this.databases.get(dbName);
    if (!config) throw new DatabaseError(`Database not found: ${dbName}`);

    if (config.type === DatabaseType.PostgreSQL) {
        return this.getTablesPostgres(dbName);
    }

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

    let connection: any = null;
    try {
      connection = await this.getConnection(dbName);
      const result = await DatabaseConnection.executeQuery(connection, query, [config.database], config.type);

      return result.rows.map(row => ({
        tableName: row.tableName,
        tableType: row.tableType,
        engine: row.engine,
        tableRows: row.tableRows ? parseInt(row.tableRows) : undefined,
        tableComment: row.tableComment || undefined
      }));
    } finally {
      if (connection) {
        await DatabaseConnection.closeConnection(connection, config.type);
      }
    }
  }

  private async getTablesPostgres(dbName: string): Promise<TableInfo[]> {
    const config = this.databases.get(dbName)!;
    const query = `
      SELECT
        table_name as "tableName",
        table_type as "tableType",
        NULL as engine,
        NULL as "tableRows",
        NULL as "tableComment"
      FROM information_schema.tables
      WHERE table_schema = 'public'
         OR table_schema = $1
      ORDER BY table_name
    `;

    let connection: any = null;
    try {
      connection = await this.getConnection(dbName);
      const result = await DatabaseConnection.executeQuery(connection, query, [config.database], config.type);

      return result.rows.map(row => ({
        tableName: row.tableName,
        tableType: row.tableType,
        engine: undefined,
        tableRows: undefined,
        tableComment: undefined
      }));
    } finally {
      if (connection) {
        await DatabaseConnection.closeConnection(connection, config.type);
      }
    }
  }

  async getTableSchema(dbName: string, tableName: string): Promise<ColumnInfo[]> {
    const config = this.databases.get(dbName);
    if (!config) throw new DatabaseError(`Database not found: ${dbName}`);

    if (config.type === DatabaseType.PostgreSQL) {
        return this.getTableSchemaPostgres(dbName, tableName);
    }

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

    let connection: any = null;
    try {
      connection = await this.getConnection(dbName);
      const result = await DatabaseConnection.executeQuery(connection, query, [config.database, tableName], config.type);

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
    } finally {
      if (connection) {
        await DatabaseConnection.closeConnection(connection, config.type);
      }
    }
  }

  private async getTableSchemaPostgres(dbName: string, tableName: string): Promise<ColumnInfo[]> {
    const config = this.databases.get(dbName)!;
    const query = `
      SELECT
        c.column_name as "columnName",
        c.data_type as "dataType",
        c.is_nullable as "isNullable",
        c.column_default as "columnDefault",
        NULL as extra,
        NULL as "columnComment",
        c.character_maximum_length as "characterMaximumLength",
        c.numeric_precision as "numericPrecision",
        c.numeric_scale as "numericScale",
        EXISTS (
            SELECT 1 FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
            WHERE tc.constraint_type = 'PRIMARY KEY'
              AND tc.table_name = c.table_name
              AND kcu.column_name = c.column_name
        ) as "isPrimaryKey"
      FROM information_schema.columns c
      WHERE c.table_name = $2 AND (c.table_schema = 'public' OR c.table_schema = $1)
      ORDER BY c.ordinal_position
    `;

    let connection: any = null;
    try {
      connection = await this.getConnection(dbName);
      const result = await DatabaseConnection.executeQuery(connection, query, [config.database, tableName], config.type);

      return result.rows.map(row => ({
        columnName: row.columnName,
        dataType: row.dataType,
        isNullable: row.isNullable,
        columnDefault: row.columnDefault,
        isPrimaryKey: Boolean(row.isPrimaryKey),
        isAutoIncrement: row.columnDefault && row.columnDefault.includes('nextval'),
        columnComment: undefined,
        characterMaximumLength: row.characterMaximumLength,
        numericPrecision: row.numericPrecision,
        numericScale: row.numericScale
      }));
    } finally {
      if (connection) {
        await DatabaseConnection.closeConnection(connection, config.type);
      }
    }
  }

  async getForeignKeys(dbName: string, tableName?: string): Promise<ForeignKeyInfo[]> {
    const config = this.databases.get(dbName);
    if (!config) throw new DatabaseError(`Database not found: ${dbName}`);

    if (config.type === DatabaseType.PostgreSQL) {
        return this.getForeignKeysPostgres(dbName, tableName);
    }

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

    const params: string[] = [];
    params.push(config.database);

    if (tableName) {
      query += ' AND kcu.TABLE_NAME = ?';
      params.push(tableName);
    }

    query += ' ORDER BY kcu.TABLE_NAME, rc.CONSTRAINT_NAME';

    let connection: any = null;
    try {
      connection = await this.getConnection(dbName);
      const result = await DatabaseConnection.executeQuery(connection, query, params, config.type);

      return result.rows.map(row => ({
        constraintName: row.constraintName,
        tableName: row.tableName,
        columnName: row.columnName,
        referencedTableName: row.referencedTableName,
        referencedColumnName: row.referencedColumnName,
        updateRule: row.updateRule,
        deleteRule: row.deleteRule
      }));
    } finally {
      if (connection) {
        await DatabaseConnection.closeConnection(connection, config.type);
      }
    }
  }

  private async getForeignKeysPostgres(dbName: string, tableName?: string): Promise<ForeignKeyInfo[]> {
    const config = this.databases.get(dbName)!;
    let query = `
      SELECT
        tc.constraint_name as "constraintName",
        tc.table_name as "tableName",
        kcu.column_name as "columnName",
        ccu.table_name AS "referencedTableName",
        ccu.column_name AS "referencedColumnName"
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND (tc.table_schema = 'public' OR tc.table_schema = $1)
    `;

    const params: string[] = [config.database];
    if (tableName) {
      query += ' AND tc.table_name = $2';
      params.push(tableName);
    }

    let connection: any = null;
    try {
      connection = await this.getConnection(dbName);
      const result = await DatabaseConnection.executeQuery(connection, query, params, config.type);

      return result.rows.map(row => ({
        constraintName: row.constraintName,
        tableName: row.tableName,
        columnName: row.columnName,
        referencedTableName: row.referencedTableName,
        referencedColumnName: row.referencedColumnName,
        updateRule: undefined,
        deleteRule: undefined
      }));
    } finally {
      if (connection) {
        await DatabaseConnection.closeConnection(connection, config.type);
      }
    }
  }

  async getIndexes(dbName: string, tableName: string): Promise<IndexInfo[]> {
    const config = this.databases.get(dbName);
    if (!config) throw new DatabaseError(`Database not found: ${dbName}`);

    if (config.type === DatabaseType.PostgreSQL) {
        return this.getIndexesPostgres(dbName, tableName);
    }

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

    let connection: any = null;
    try {
      connection = await this.getConnection(dbName);
      const result = await DatabaseConnection.executeQuery(connection, query, [config.database, tableName], config.type);

      return result.rows.map(row => ({
        tableName: row.tableName,
        indexName: row.indexName,
        columnName: row.columnName,
        nonUnique: Boolean(row.nonUnique),
        indexType: row.indexType,
        cardinality: row.cardinality,
        subPart: row.subPart,
        nullable: row.nullable === 'YES',
        isPrimary: row.indexName === 'PRIMARY'
      }));
    } finally {
      if (connection) {
        await DatabaseConnection.closeConnection(connection, config.type);
      }
    }
  }

  private async getIndexesPostgres(dbName: string, tableName: string): Promise<IndexInfo[]> {
    const config = this.databases.get(dbName)!;
    const query = `
      SELECT
        t.relname as "tableName",
        i.relname as "indexName",
        a.attname as "columnName",
        NOT ix.indisunique as "nonUnique",
        ix.indisprimary as "isPrimary",
        am.amname as "indexType"
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      JOIN pg_am am ON i.relam = am.oid
      WHERE t.relname = $1
      ORDER BY i.relname
    `;

    let connection: any = null;
    try {
      connection = await this.getConnection(dbName);
      const result = await DatabaseConnection.executeQuery(connection, query, [tableName], config.type);

      return result.rows.map(row => ({
        tableName: row.tableName,
        indexName: row.indexName,
        columnName: row.columnName,
        nonUnique: Boolean(row.nonUnique),
        indexType: row.indexType,
        cardinality: undefined,
        subPart: undefined,
        nullable: true, // pg_attribute doesn't directly tell us nullable here, but irrelevant for simple index list
        isPrimary: Boolean(row.isPrimary)
      }));
    } finally {
      if (connection) {
        await DatabaseConnection.closeConnection(connection, config.type);
      }
    }
  }

  async cleanup(): Promise<void> {
    Logger.info('Cleaning up database connections...');

    for (const [name, config] of this.databases) {
      if (config.connection) {
        try {
          await DatabaseConnection.closeConnection(config.connection, config.type);
        } catch (error) {
          Logger.warn(`Error closing connection for ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    this.databases.clear();
    Logger.info('Database cleanup completed');
  }

  async queryInformationSchema(
    dbName: string,
    table: 'COLUMNS' | 'TABLES' | 'ROUTINES',
    filters?: Record<string, string>,
    limit: number = 100
  ): Promise<QueryResult> {
    const config = this.databases.get(dbName);
    if (!config) throw new DatabaseError(`Database not found: ${dbName}`);

    const allowedTables = ['COLUMNS', 'TABLES', 'ROUTINES'];
    if (!allowedTables.includes(table)) {
      throw new ValidationError(`Table '${table}' is not allowed for INFORMATION_SCHEMA queries.`);
    }

    let whereClauses: string[] = [];
    let params: any[] = [];

    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (!/^[A-Z_]+$/.test(key)) {
          throw new ValidationError(`Invalid filter key: ${key}. Only uppercase letters and underscores allowed.`);
        }
        if (config.type === DatabaseType.PostgreSQL) {
            whereClauses.push(`${key.toLowerCase()} = $${params.length + 1}`);
        } else {
            whereClauses.push(`${key} = ?`);
        }
        params.push(value);
      }
    }

    if (config.type === DatabaseType.PostgreSQL) {
        whereClauses.unshift(`table_schema = $${params.length + 1}`);
        params.push('public'); // Default for PG
    } else {
        whereClauses.unshift('TABLE_SCHEMA = ?');
        params.unshift(config.database);
    }

    let sql = `SELECT * FROM INFORMATION_SCHEMA.${table}`;
    if (whereClauses.length > 0) {
      sql += ' WHERE ' + whereClauses.join(' AND ');
    }
    sql += ` LIMIT ${Math.min(Math.max(limit, 1), 1000)}`;

    let connection: any = null;
    try {
      connection = await this.getConnection(dbName);
      const result = await DatabaseConnection.executeQuery(connection, sql, params, config.type);
      return result;
    } finally {
      if (connection) {
        await DatabaseConnection.closeConnection(connection, config.type);
      }
    }
  }

  async analyzeQuery(dbName: string, query: string): Promise<any> {
    const config = this.databases.get(dbName);
    if (!config) throw new DatabaseError(`Database not found: ${dbName}`);

    // Validate query is read-only
    const validation = QueryValidator.validateQuery(query);
    if (!validation.isValid) {
      throw new ValidationError(`Query validation failed: ${validation.error}`);
    }

    let explainQuery: string;
    if (config.type === DatabaseType.PostgreSQL) {
      explainQuery = `EXPLAIN (FORMAT JSON, VERBOSE, ANALYZE FALSE) ${query}`;
    } else {
      explainQuery = `EXPLAIN FORMAT=JSON ${query}`;
    }

    let connection: any = null;
    try {
      connection = await this.getConnection(dbName);
      const result = await DatabaseConnection.executeQuery(connection, explainQuery, [], config.type);

      let rawPlan: any;
      if (config.type === DatabaseType.PostgreSQL) {
        // PG returns [{ "QUERY PLAN": [...] }] or similar
        const firstRow = result.rows[0];
        const firstKey = Object.keys(firstRow)[0];
        const val = firstRow[firstKey];
        rawPlan = Array.isArray(val) ? val[0] : val;
      } else {
        // MySQL returns [{ EXPLAIN: "json_string" }] or similar
        const firstRow = result.rows[0];
        const firstKey = Object.keys(firstRow)[0];
        try {
          rawPlan = typeof firstRow[firstKey] === 'string' ? JSON.parse(firstRow[firstKey]) : firstRow[firstKey];
        } catch (e) {
          rawPlan = firstRow[firstKey];
        }
      }

      return {
        database: dbName,
        type: config.type,
        query,
        plan: rawPlan,
        summary: this.summarizePlan(rawPlan, config.type)
      };
    } finally {
      if (connection) {
        await DatabaseConnection.closeConnection(connection, config.type);
      }
    }
  }

  private summarizePlan(plan: any, type: DatabaseType): any {
    const summary: any = {
      cost: 0,
      potentialIssues: [] as string[],
      operations: [] as string[]
    };

    if (type === DatabaseType.PostgreSQL) {
      const rootPlan = plan?.Plan || plan?.[0]?.Plan;
      if (rootPlan) {
        summary.cost = rootPlan['Total Cost'];
        this.traversePostgresPlan(rootPlan, summary);
      }
    } else {
      // MySQL JSON format is deeply nested under query_block
      const queryBlock = plan?.query_block;
      if (queryBlock) {
        summary.cost = queryBlock.cost_info?.query_cost;
        this.traverseMySQLPlan(queryBlock, summary);
      }
    }

    return summary;
  }

  private traversePostgresPlan(plan: any, summary: any) {
    const nodeType = plan['Node Type'];
    summary.operations.push(nodeType);

    if (nodeType === 'Seq Scan') {
      summary.potentialIssues.push(`Full table scan on ${plan['Relation Name']}`);
    }

    if (plan.Plans) {
      for (const subPlan of plan.Plans) {
        this.traversePostgresPlan(subPlan, summary);
      }
    }
  }

  private traverseMySQLPlan(node: any, summary: any) {
    if (node.table) {
      summary.operations.push(node.table.access_type);
      if (node.table.access_type === 'ALL') {
        summary.potentialIssues.push(`Full table scan on ${node.table.table_name}`);
      }
    }

    for (const key in node) {
      if (typeof node[key] === 'object' && node[key] !== null) {
        this.traverseMySQLPlan(node[key], summary);
      }
    }
  }
}
