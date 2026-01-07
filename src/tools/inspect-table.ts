import { z } from 'zod';
import { DatabaseManager } from '../database/manager.js';
import { InputValidator } from '../validators/input-validator.js';
import { Logger } from '../utils/logger.js';
import { ToolError } from '../utils/errors.js';

// Tool schema
const InspectTableArgsSchema = z.object({
  database: z.string().min(1, 'Database name is required'),
  table: z.string().optional(),
  tables: z.array(z.string().min(1)).optional()
}).superRefine((data, ctx) => {
  const hasTable = typeof data.table === 'string' && data.table.length > 0;
  const hasTables = Array.isArray(data.tables) && data.tables.length > 0;
  if (hasTable && hasTables) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide either 'table' or 'tables', not both"
    });
  } else if (!hasTable && !hasTables) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Either 'table' or non-empty 'tables' must be provided"
    });
  }
});

/**
 * Tool: inspect_table
 * Get complete table schema including columns, types, constraints, and metadata.
 *
 * Supports both single-table and multi-table inspection:
 * - Provide either `table` (string) for a single table, or `tables` (string[]) for multiple tables.
 * - If `tables` is provided, returns a mapping of table names to their schema analysis.
 * - Do not provide both `table` and `tables` at the same time.
 */
export interface InspectTableTool {
  name: 'inspect_table';
  description: 'Get complete table schema including columns, types, constraints, and metadata. Supports multi-table inspection via the tables: string[] parameter.';
  inputSchema: {
    type: 'object';
    properties: {
      database: {
        type: 'string';
        description: 'Name of the database containing the table(s)';
      };
      table: {
        type: 'string';
        description: 'Name of the table to inspect (single-table mode)';
      };
      tables: {
        type: 'array';
        items: { type: 'string' };
        description: 'Array of table names to inspect (multi-table mode)';
      };
    };
    required: ['database'];
  };
}

export const inspectTableToolDefinition: InspectTableTool = {
  name: 'inspect_table',
  description: 'Get complete table schema including columns, types, constraints, and metadata. Supports multi-table inspection via the tables: string[] parameter.',
  inputSchema: {
    type: 'object',
    properties: {
      database: {
        type: 'string',
        description: 'Name of the database containing the table(s)'
      },
      table: {
        type: 'string',
        description: 'Name of the table to inspect (single-table mode)'
      },
      tables: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of table names to inspect (multi-table mode)'
      }
    },
    required: ['database']
  }
};

export async function handleInspectTable(
  args: unknown,
  dbManager: DatabaseManager
): Promise<any> {
  try {
    Logger.info('Executing inspect_table tool');

    // Validate arguments
    const validationResult = InspectTableArgsSchema.safeParse(args);
    if (!validationResult.success) {
      Logger.warn('Invalid arguments for inspect_table', validationResult.error);
      throw new ToolError(
        `Invalid arguments: ${validationResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        'inspect_table'
      );
    }

    const { database, table, tables } = validationResult.data;

    // Sanitize database input
    const sanitizedDatabase = InputValidator.sanitizeString(database);

    // Validate database name format
    const dbNameValidation = InputValidator.validateDatabaseName(sanitizedDatabase);
    if (!dbNameValidation.isValid) {
      throw new ToolError(
        `Invalid database name: ${dbNameValidation.error}`,
        'inspect_table'
      );
    }

    // Helper to process a single table
    const processTable = async (tableName: string) => {
      try {
        const sanitizedTable = InputValidator.sanitizeString(tableName);

        // Validate table name format
        const tableNameValidation = InputValidator.validateTableName(sanitizedTable);
        if (!tableNameValidation.isValid) {
          throw new ToolError(
            `Invalid table name: ${tableNameValidation.error}`,
            'inspect_table'
          );
        }

        Logger.info(`Inspecting table: ${sanitizedDatabase}.${sanitizedTable}`);
        Logger.time(`inspect_table_execution_${sanitizedTable}`);

        // Get table schema
        const columns = await dbManager.getTableSchema(sanitizedDatabase, sanitizedTable);

        // Get additional metadata in parallel
        const [foreignKeys, indexes] = await Promise.all([
          dbManager.getForeignKeys(sanitizedDatabase, sanitizedTable),
          dbManager.getIndexes(sanitizedDatabase, sanitizedTable)
        ]);

        Logger.timeEnd(`inspect_table_execution_${sanitizedTable}`);
        Logger.info(`Retrieved schema for table: ${sanitizedDatabase}.${sanitizedTable} with ${columns.length} columns`);

        if (columns.length === 0) {
          throw new ToolError(
            `Table '${sanitizedTable}' not found in database '${sanitizedDatabase}' or has no accessible columns`,
            'inspect_table'
          );
        }

        // Analyze schema patterns
        const analysis = analyzeTableSchema(columns, indexes, foreignKeys);

        // Group columns by characteristics
        const columnsByType = groupColumnsByType(columns);

        // Create comprehensive response
        const response = {
          database: sanitizedDatabase,
          table: sanitizedTable,
          columns: columns.map(col => ({
            name: col.columnName,
            dataType: col.dataType,
            fullType: formatFullDataType(col),
            nullable: col.isNullable === 'YES',
            defaultValue: col.columnDefault,
            isPrimaryKey: col.isPrimaryKey,
            isAutoIncrement: col.isAutoIncrement,
            comment: col.columnComment,
            constraints: getColumnConstraints(col),
            properties: {
              hasLength: col.characterMaximumLength !== null && col.characterMaximumLength !== undefined,
              hasPrecision: col.numericPrecision !== null && col.numericPrecision !== undefined,
              hasScale: col.numericScale !== null && col.numericScale !== undefined
            }
          })),
          constraints: {
            primaryKey: columns.filter(col => col.isPrimaryKey).map(col => col.columnName),
            foreignKeys: foreignKeys.map(fk => ({
              constraintName: fk.constraintName,
              columnName: fk.columnName,
              referencedTable: fk.referencedTableName,
              referencedColumn: fk.referencedColumnName,
              updateRule: fk.updateRule,
              deleteRule: fk.deleteRule
            })),
            unique: indexes.filter(idx => !idx.nonUnique && !idx.isPrimary)
              .map(idx => idx.indexName)
              .filter((value, index, self) => self.indexOf(value) === index) // Remove duplicates
          },
          indexes: groupIndexesByName(indexes),
          statistics: {
            totalColumns: columns.length,
            nullableColumns: columns.filter(col => col.isNullable === 'YES').length,
            primaryKeyColumns: columns.filter(col => col.isPrimaryKey).length,
            autoIncrementColumns: columns.filter(col => col.isAutoIncrement).length,
            indexedColumns: [...new Set(indexes.map(idx => idx.columnName))].length,
            foreignKeyColumns: [...new Set(foreignKeys.map(fk => fk.columnName))].length,
            totalIndexes: [...new Set(indexes.map(idx => idx.indexName))].length,
            totalForeignKeys: foreignKeys.length
          },
          columnsByType,
          analysis,
          summary: {
            description: `Table '${sanitizedTable}' has ${columns.length} columns with ${
              columns.filter(col => col.isPrimaryKey).length
            } primary key column(s) and ${indexes.length > 0 ? [...new Set(indexes.map(idx => idx.indexName))].length : 0} index(es)`,
            recommendations: analysis.recommendations
          }
        };

        Logger.debug('inspect_table completed successfully', {
          database: sanitizedDatabase,
          table: sanitizedTable,
          columnCount: columns.length,
          indexCount: indexes.length,
          foreignKeyCount: foreignKeys.length
        });

        return { ok: true, result: response };
      } catch (err) {
        Logger.error(`Error inspecting table '${tableName}'`, err);
        return {
          ok: false,
          error: err instanceof ToolError
            ? err.message
            : (err instanceof Error ? err.message : 'Unknown error')
        };
      }
    };

    // Multi-table support
    if (Array.isArray(tables) && tables.length > 0) {
      const results: Record<string, any> = {};
      for (const t of tables) {
        const res = await processTable(t);
        if (res.ok) {
          results[t] = res.result;
        } else {
          results[t] = { error: res.error };
        }
      }
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(results, null, 2)
        }]
      };
    }

    // Single-table fallback (backward compatible)
    if (typeof table === 'string' && table.length > 0) {
      const res = await processTable(table);
      if (res.ok) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(res.result, null, 2)
          }]
        };
      } else {
        throw new ToolError(
          `Failed to inspect table '${table}': ${res.error}`,
          'inspect_table'
        );
      }
    }

    // Should not reach here due to schema refinement
    throw new ToolError(
      "Either 'table' or non-empty 'tables' must be provided",
      'inspect_table'
    );
  } catch (error) {
    // Add table context to error logs
    let tableContext: string | undefined;
    let argTables: string[] | undefined;
    let argTable: string | undefined;
    if (args && typeof args === 'object') {
      // @ts-ignore
      argTables = Array.isArray(args.tables) ? args.tables : undefined;
      // @ts-ignore
      argTable = typeof args.table === 'string' ? args.table : undefined;
    }
    if (Array.isArray(argTables) && argTables.length > 0) {
      tableContext = `tables: [${argTables.join(', ')}]`;
    } else if (typeof argTable === 'string' && argTable.length > 0) {
      tableContext = `table: ${argTable}`;
    } else {
      tableContext = 'no table(s) specified';
    }
    Logger.error(`Error in inspect_table tool (${tableContext})`, error);

    if (error instanceof ToolError) {
      throw error;
    }

    throw new ToolError(
      `Failed to inspect table(s) (${tableContext}): ${error instanceof Error ? error.message : 'Unknown error'}`,
      'inspect_table',
      error instanceof Error ? error : undefined
    );
  }
}

// Helper functions
function formatFullDataType(column: any): string {
  let type = column.dataType.toLowerCase();

  if (column.characterMaximumLength !== null && column.characterMaximumLength !== undefined) {
    type += `(${column.characterMaximumLength})`;
  } else if (column.numericPrecision !== null && column.numericPrecision !== undefined) {
    if (column.numericScale !== null && column.numericScale !== undefined && column.numericScale > 0) {
      type += `(${column.numericPrecision},${column.numericScale})`;
    } else {
      type += `(${column.numericPrecision})`;
    }
  }

  return type;
}

function getColumnConstraints(column: any): string[] {
  const constraints = [];

  if (column.isPrimaryKey) constraints.push('PRIMARY KEY');
  if (column.isAutoIncrement) constraints.push('AUTO_INCREMENT');
  if (column.isNullable === 'NO') constraints.push('NOT NULL');

  return constraints;
}

function groupColumnsByType(columns: any[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {
    numeric: [],
    string: [],
    datetime: [],
    binary: [],
    json: [],
    other: []
  };

  columns.forEach(col => {
    const type = col.dataType.toLowerCase();
    if (['int', 'bigint', 'smallint', 'tinyint', 'mediumint', 'decimal', 'numeric', 'float', 'double', 'bit', 'real', 'serial'].some(t => type.includes(t))) {
      groups.numeric.push(col.columnName);
    } else if (['varchar', 'char', 'text', 'longtext', 'mediumtext', 'tinytext', 'enum', 'set', 'uuid', 'inet', 'cidr', 'macaddr'].some(t => type.includes(t))) {
      groups.string.push(col.columnName);
    } else if (['datetime', 'date', 'time', 'timestamp', 'year', 'interval'].some(t => type.includes(t))) {
      groups.datetime.push(col.columnName);
    } else if (['binary', 'varbinary', 'blob', 'longblob', 'mediumblob', 'tinyblob', 'bytea'].some(t => type.includes(t))) {
      groups.binary.push(col.columnName);
    } else if (type === 'json' || type === 'jsonb') {
      groups.json.push(col.columnName);
    } else {
      groups.other.push(col.columnName);
    }
  });

  // Remove empty groups
  Object.keys(groups).forEach(key => {
    if (groups[key].length === 0) {
      delete groups[key];
    }
  });

  return groups;
}

function groupIndexesByName(indexes: any[]): any[] {
  const indexGroups: Record<string, any> = {};

  indexes.forEach(idx => {
    if (!indexGroups[idx.indexName]) {
      indexGroups[idx.indexName] = {
        name: idx.indexName,
        type: idx.indexType,
        unique: !idx.nonUnique,
        columns: []
      };
    }
    indexGroups[idx.indexName].columns.push({
      name: idx.columnName,
      cardinality: idx.cardinality,
      subPart: idx.subPart
    });
  });

  return Object.values(indexGroups);
}

function analyzeTableSchema(columns: any[], indexes: any[], foreignKeys: any[]): any {
  const recommendations = [];
  const patterns = [];

  // Check for common patterns
  const hasId = columns.some(col => col.columnName.toLowerCase() === 'id');
  const hasCreatedAt = columns.some(col => col.columnName.toLowerCase().includes('created'));
  const hasUpdatedAt = columns.some(col => col.columnName.toLowerCase().includes('updated'));

  if (hasId && hasCreatedAt && hasUpdatedAt) {
    patterns.push('Standard entity pattern (id, created_at, updated_at)');
  }

  // Check for missing primary key
  const hasPrimaryKey = columns.some(col => col.isPrimaryKey);
  if (!hasPrimaryKey) {
    recommendations.push('Consider adding a primary key for better performance and replication');
  }

  // Check for missing indexes on foreign key columns
  const fkColumns = new Set(foreignKeys.map(fk => fk.columnName));
  const indexedColumns = new Set(indexes.map(idx => idx.columnName));

  fkColumns.forEach(fkCol => {
    if (!indexedColumns.has(fkCol)) {
      recommendations.push(`Consider adding an index on foreign key column '${fkCol}' for better join performance`);
    }
  });

  // Check for very wide tables
  if (columns.length > 50) {
    recommendations.push('Table has many columns. Consider normalization or vertical partitioning');
  }

  // Check for nullable primary key (should not happen but good to check)
  const nullablePK = columns.find(col => col.isPrimaryKey && col.isNullable === 'YES');
  if (nullablePK) {
    recommendations.push(`Primary key column '${nullablePK.columnName}' should not be nullable`);
  }

  return {
    patterns,
    recommendations,
    hasStandardAuditFields: hasCreatedAt && hasUpdatedAt,
    hasAutoIncrementPK: columns.some(col => col.isPrimaryKey && col.isAutoIncrement),
    isWellIndexed: fkColumns.size === 0 || Array.from(fkColumns).every(col => indexedColumns.has(col))
  };
}
