import { z } from 'zod';
import { DatabaseManager } from '../database/manager.js';
import { InputValidator } from '../validators/input-validator.js';
import { Logger } from '../utils/logger.js';
import { ToolError } from '../utils/errors.js';

// Tool schema
const GetIndexesArgsSchema = z.object({
  database: z.string().min(1, 'Database name is required'),
  table: z.string().min(1, 'Table name is required').optional(),
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
 * Tool: get_indexes
 * Get detailed index information for one or more tables.
 *
 * Supports both single-table and multi-table inspection:
 * - Provide either `table` (string) for a single table, or `tables` (string[]) for multiple tables.
 * - If `tables` is provided, returns a mapping of table names to their index analysis.
 * - Do not provide both `table` and `tables` at the same time.
 */
export interface GetIndexesTool {
  name: 'get_indexes';
  description: 'Get detailed index information for one or more tables. Supports multi-table inspection via the tables: string[] parameter.';
  inputSchema: {
    type: 'object';
    properties: {
      database: {
        type: 'string';
        description: 'Name of the database containing the table(s)';
      };
      table: {
        type: 'string';
        description: 'Name of the table to get indexes for (single-table mode)';
      };
      tables: {
        type: 'array';
        items: { type: 'string' };
        description: 'Array of table names to get indexes for (multi-table mode)';
      };
    };
    required: ['database'];
  };
}

export const getIndexesToolDefinition: GetIndexesTool = {
  name: 'get_indexes',
  description: 'Get detailed index information for one or more tables. Supports multi-table inspection via the tables: string[] parameter.',
  inputSchema: {
    type: 'object',
    properties: {
      database: {
        type: 'string',
        description: 'Name of the database containing the table(s)'
      },
      table: {
        type: 'string',
        description: 'Name of the table to get indexes for (single-table mode)'
      },
      tables: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of table names to get indexes for (multi-table mode)'
      }
    },
    required: ['database']
  }
};

export async function handleGetIndexes(
  args: unknown,
  dbManager: DatabaseManager
): Promise<any> {
  try {
    Logger.info('Executing get_indexes tool');

    // Validate arguments
    const validationResult = GetIndexesArgsSchema.safeParse(args);
    if (!validationResult.success) {
      Logger.warn('Invalid arguments for get_indexes', validationResult.error);
      throw new ToolError(
        `Invalid arguments: ${validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        'get_indexes'
      );
    }

    const { database, table, tables } = validationResult.data;

    // Sanitize database input
    const sanitizedDatabase = InputValidator.sanitizeString(database);
    const dbNameValidation = InputValidator.validateDatabaseName(sanitizedDatabase);
    if (!dbNameValidation.isValid) {
      throw new ToolError(
        `Invalid database name: ${dbNameValidation.error}`,
        'get_indexes'
      );
    }

    // Multi-table mode
    if (Array.isArray(tables) && tables.length > 0) {
      Logger.info(`Processing indexes for multiple tables: ${tables.join(', ')}`);
      const results: Record<string, any> = {};
      for (const tbl of tables) {
        const sanitizedTable = InputValidator.sanitizeString(tbl);
        const tableNameValidation = InputValidator.validateTableName(sanitizedTable);
        if (!tableNameValidation.isValid) {
          Logger.warn(`Invalid table name for table '${tbl}': ${tableNameValidation.error}`);
          results[tbl] = {
            error: `Invalid table name: ${tableNameValidation.error}`
          };
          continue;
        }
        try {
          Logger.info(`Getting indexes for table: ${sanitizedDatabase}.${sanitizedTable}`);
          Logger.time(`get_indexes_execution_${sanitizedTable}`);
          const indexes = await dbManager.getIndexes(sanitizedDatabase, sanitizedTable);
          Logger.timeEnd(`get_indexes_execution_${sanitizedTable}`);
          Logger.info(`Found ${indexes.length} index entries for table: ${sanitizedDatabase}.${sanitizedTable}`);

          if (indexes.length === 0) {
            results[tbl] = {
              database: sanitizedDatabase,
              table: sanitizedTable,
              indexes: [],
              statistics: {
                totalIndexes: 0,
                uniqueIndexes: 0,
                primaryKeyIndex: false,
                compositeIndexes: 0,
                singleColumnIndexes: 0,
                totalIndexedColumns: 0
              },
              analysis: {
                indexCoverage: 'none',
                recommendations: ['Table has no indexes. Consider adding appropriate indexes for query performance.'],
                potentialIssues: ['No indexes found - all queries will require full table scans']
              },
              summary: {
                hasIndexes: false,
                message: `No indexes found for table '${sanitizedTable}' in database '${sanitizedDatabase}'`
              }
            };
            continue;
          }

          const groupedIndexes = groupIndexesByName(indexes);
          const analysis = analyzeIndexes(groupedIndexes);

          results[tbl] = {
            database: sanitizedDatabase,
            table: sanitizedTable,
            indexes: groupedIndexes.map(idx => ({
              name: idx.name,
              type: idx.type,
              unique: idx.unique,
              columns: idx.columns.map((col: any) => ({
                name: col.name,
                cardinality: col.cardinality,
                subPart: col.subPart,
                nullable: col.nullable,
                selectivity: col.cardinality && analysis.statistics.estimatedTableSize ?
                  (col.cardinality / analysis.statistics.estimatedTableSize).toFixed(4) : null
              })),
              isComposite: idx.columns.length > 1,
              isPrimary: idx.name === 'PRIMARY',
              purpose: determinePurpose(idx)
            })),
            statistics: analysis.statistics,
            indexAnalysis: analysis.analysis,
            performance: analyzeIndexPerformance(groupedIndexes),
            coverage: analyzeIndexCoverage(groupedIndexes),
            recommendations: generateIndexRecommendations(groupedIndexes, analysis),
            summary: {
              hasIndexes: groupedIndexes.length > 0,
              message: `Found ${groupedIndexes.length} index(es) covering ${analysis.statistics.totalIndexedColumns} column(s) in table '${sanitizedTable}'`
            }
          };
        } catch (err) {
          Logger.error(`Error processing table '${tbl}' in get_indexes tool`, err);
          results[tbl] = {
            error: err instanceof Error ? err.message : String(err)
          };
        }
      }
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(results, null, 2)
        }]
      };
    }

    // Single-table mode (backward compatible)
    if (typeof table !== 'string' || table.length === 0) {
      throw new ToolError(
        "Missing required parameter: 'table'",
        'get_indexes'
      );
    }
    const sanitizedTable = InputValidator.sanitizeString(table);
    const tableNameValidation = InputValidator.validateTableName(sanitizedTable);
    if (!tableNameValidation.isValid) {
      throw new ToolError(
        `Invalid table name: ${tableNameValidation.error}`,
        'get_indexes'
      );
    }

    Logger.info(`Getting indexes for table: ${sanitizedDatabase}.${sanitizedTable}`);
    Logger.time('get_indexes_execution');

    const indexes = await dbManager.getIndexes(sanitizedDatabase, sanitizedTable);

    Logger.timeEnd('get_indexes_execution');
    Logger.info(`Found ${indexes.length} index entries for table: ${sanitizedDatabase}.${sanitizedTable}`);

    if (indexes.length === 0) {
      const response = {
        database: sanitizedDatabase,
        table: sanitizedTable,
        indexes: [],
        statistics: {
          totalIndexes: 0,
          uniqueIndexes: 0,
          primaryKeyIndex: false,
          compositeIndexes: 0,
          singleColumnIndexes: 0,
          totalIndexedColumns: 0
        },
        analysis: {
          indexCoverage: 'none',
          recommendations: ['Table has no indexes. Consider adding appropriate indexes for query performance.'],
          potentialIssues: ['No indexes found - all queries will require full table scans']
        },
        summary: {
          hasIndexes: false,
          message: `No indexes found for table '${sanitizedTable}' in database '${sanitizedDatabase}'`
        }
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }]
      };
    }

    // Group indexes by name and analyze
    const groupedIndexes = groupIndexesByName(indexes);
    const analysis = analyzeIndexes(groupedIndexes);

    const response = {
      database: sanitizedDatabase,
      table: sanitizedTable,
      indexes: groupedIndexes.map(idx => ({
        name: idx.name,
        type: idx.type,
        unique: idx.unique,
        columns: idx.columns.map((col: any) => ({
          name: col.name,
          cardinality: col.cardinality,
          subPart: col.subPart,
          nullable: col.nullable,
          selectivity: col.cardinality && analysis.statistics.estimatedTableSize ?
            (col.cardinality / analysis.statistics.estimatedTableSize).toFixed(4) : null
        })),
        isComposite: idx.columns.length > 1,
        isPrimary: idx.name === 'PRIMARY',
        purpose: determinePurpose(idx)
      })),
      statistics: analysis.statistics,
      indexAnalysis: analysis.analysis,
      performance: analyzeIndexPerformance(groupedIndexes),
      coverage: analyzeIndexCoverage(groupedIndexes),
      recommendations: generateIndexRecommendations(groupedIndexes, analysis),
      summary: {
        hasIndexes: groupedIndexes.length > 0,
        message: `Found ${groupedIndexes.length} index(es) covering ${analysis.statistics.totalIndexedColumns} column(s) in table '${sanitizedTable}'`
      }
    };

    Logger.debug('get_indexes completed successfully', {
      database: sanitizedDatabase,
      table: sanitizedTable,
      indexCount: groupedIndexes.length,
      totalIndexedColumns: analysis.statistics.totalIndexedColumns
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2)
      }]
    };

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
    Logger.error(`Error in get_indexes tool (${tableContext})`, error);

    if (error instanceof ToolError) {
      throw error;
    }

    throw new ToolError(
      `Failed to get indexes (${tableContext}): ${error instanceof Error ? error.message : 'Unknown error'}`,
      'get_indexes',
      error instanceof Error ? error : undefined
    );
  }
}

// Helper functions
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
      subPart: idx.subPart,
      nullable: idx.nullable
    });
  });
  
  return Object.values(indexGroups);
}

function analyzeIndexes(indexes: any[]): any {
  const uniqueIndexes = indexes.filter(idx => idx.unique).length;
  const primaryIndex = indexes.find(idx => idx.name === 'PRIMARY');
  const compositeIndexes = indexes.filter(idx => idx.columns.length > 1).length;
  const singleColumnIndexes = indexes.filter(idx => idx.columns.length === 1).length;
  
  // Get all indexed columns (unique)
  const indexedColumns = new Set();
  indexes.forEach(idx => {
    idx.columns.forEach((col: any) => indexedColumns.add(col.name));
  });
  
  // Estimate table size from cardinality
  let estimatedTableSize = 0;
  if (primaryIndex && primaryIndex.columns.length > 0) {
    estimatedTableSize = primaryIndex.columns[0].cardinality || 0;
  } else {
    // Use highest cardinality from unique indexes
    const maxCardinality = Math.max(...indexes
      .filter(idx => idx.unique)
      .flatMap(idx => idx.columns.map((col: any) => col.cardinality || 0))
    );
    estimatedTableSize = maxCardinality > 0 ? maxCardinality : 0;
  }
  
  return {
    statistics: {
      totalIndexes: indexes.length,
      uniqueIndexes,
      primaryKeyIndex: !!primaryIndex,
      compositeIndexes,
      singleColumnIndexes,
      totalIndexedColumns: indexedColumns.size,
      estimatedTableSize,
      averageIndexCardinality: indexes.length > 0 ? 
        indexes.reduce((sum, idx) => sum + (idx.columns[0]?.cardinality || 0), 0) / indexes.length : 0
    },
    analysis: {
      hasGoodCoverage: indexedColumns.size >= Math.min(5, indexes.length * 2), // Heuristic
      hasPrimaryKey: !!primaryIndex,
      hasUniqueConstraints: uniqueIndexes > (primaryIndex ? 1 : 0),
      indexDistribution: {
        simple: singleColumnIndexes,
        composite: compositeIndexes
      }
    }
  };
}

function analyzeIndexPerformance(indexes: any[]): any {
  const performance = {
    highSelectivity: [] as any[],
    lowSelectivity: [] as any[],
    potentiallyRedundant: [] as any[],
    wellDesigned: [] as any[]
  };
  
  indexes.forEach(idx => {
    const firstColumn = idx.columns[0];
    if (!firstColumn) return;
    
    const cardinality = firstColumn.cardinality || 0;
    const isLowCardinality = cardinality < 10; // Very low selectivity
    const isHighCardinality = cardinality > 1000; // Good selectivity
    
    if (isLowCardinality && !idx.unique && idx.name !== 'PRIMARY') {
      performance.lowSelectivity.push({
        name: idx.name,
        cardinality,
        reason: 'Low cardinality may not provide good query performance'
      });
    } else if (isHighCardinality) {
      performance.highSelectivity.push({
        name: idx.name,
        cardinality,
        reason: 'High selectivity should provide good query performance'
      });
    }
    
    // Check for well-designed composite indexes (decreasing cardinality)
    if (idx.columns.length > 1) {
      const cardinalities = idx.columns.map((col: any) => col.cardinality || 0);
      const isWellOrdered = cardinalities.every((card: number, i: number) =>
        i === 0 || card <= cardinalities[i - 1]
      );
      
      if (isWellOrdered) {
        performance.wellDesigned.push({
          name: idx.name,
          columns: idx.columns.map((col: any) => `${col.name}(${col.cardinality})`).join(', '),
          reason: 'Columns ordered by decreasing selectivity'
        });
      }
    }
  });
  
  // Look for potentially redundant indexes
  indexes.forEach((idx1, i) => {
    indexes.slice(i + 1).forEach(idx2 => {
      const columns1 = idx1.columns.map((col: any) => col.name);
      const columns2 = idx2.columns.map((col: any) => col.name);
      
      // Check if one index is a prefix of another
      if (columns1.length <= columns2.length) {
        const isPrefix = columns1.every((col: string, idx: number) => col === columns2[idx]);
        if (isPrefix && !idx1.unique && !idx2.unique) {
          performance.potentiallyRedundant.push({
            redundantIndex: idx1.name,
            supersetIndex: idx2.name,
            reason: `Index '${idx1.name}' may be redundant as '${idx2.name}' covers the same columns and more`
          });
        }
      }
    });
  });
  
  return performance;
}

function analyzeIndexCoverage(indexes: any[]): any {
  const coverage = {
    primaryKey: false,
    foreignKeys: [] as string[], // Would need FK info to populate
    commonPatterns: {
      hasTimestampIndex: false,
      hasStatusIndex: false,
      hasNameIndex: false
    },
    columnTypes: {
      numeric: 0,
      string: 0,
      datetime: 0,
      other: 0
    }
  };
  
  const allColumns = indexes.flatMap(idx => idx.columns.map((col: any) => col.name.toLowerCase()));
  
  coverage.primaryKey = indexes.some(idx => idx.name === 'PRIMARY');
  coverage.commonPatterns.hasTimestampIndex = allColumns.some(col => 
    col.includes('created') || col.includes('updated') || col.includes('timestamp')
  );
  coverage.commonPatterns.hasStatusIndex = allColumns.some(col => 
    col.includes('status') || col.includes('state') || col.includes('active')
  );
  coverage.commonPatterns.hasNameIndex = allColumns.some(col => 
    col.includes('name') || col.includes('title') || col.includes('description')
  );
  
  return coverage;
}

function generateIndexRecommendations(indexes: any[], analysis: any): string[] {
  const recommendations: string[] = [];
  
  if (!analysis.analysis.hasPrimaryKey) {
    recommendations.push('Add a primary key index for better performance and data integrity');
  }
  
  if (analysis.statistics.totalIndexes === 0) {
    recommendations.push('Table has no indexes. Consider adding indexes on frequently queried columns');
  } else if (analysis.statistics.totalIndexes > 10) {
    recommendations.push('Table has many indexes. Consider removing unused indexes to improve write performance');
  }
  
  if (analysis.statistics.compositeIndexes === 0 && analysis.statistics.totalIndexes > 3) {
    recommendations.push('Consider creating composite indexes for queries filtering on multiple columns');
  }
  
  // Check for missing indexes on commonly queried patterns
  const allColumns = indexes.flatMap(idx => idx.columns.map((col: any) => col.name.toLowerCase()));
  
  if (!allColumns.some(col => col.includes('created') || col.includes('timestamp'))) {
    recommendations.push('Consider adding an index on timestamp/created_at columns for temporal queries');
  }
  
  if (indexes.filter(idx => !idx.unique).length > 6) {
    recommendations.push('Many non-unique indexes detected. Review if all are necessary for your query patterns');
  }
  
  return recommendations;
}

function determinePurpose(index: any): string {
  if (index.name === 'PRIMARY') {
    return 'primary_key';
  } else if (index.unique) {
    return 'unique_constraint';
  } else if (index.columns.length > 1) {
    return 'composite_query_optimization';
  } else {
    const columnName = index.columns[0]?.name.toLowerCase() || '';
    if (columnName.includes('foreign') || columnName.endsWith('_id')) {
      return 'foreign_key_optimization';
    } else if (columnName.includes('created') || columnName.includes('updated')) {
      return 'temporal_queries';
    } else if (columnName.includes('status') || columnName.includes('state')) {
      return 'filtering_optimization';
    } else {
      return 'query_optimization';
    }
  }
}
