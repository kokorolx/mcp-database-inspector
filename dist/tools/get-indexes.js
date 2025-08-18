import { z } from 'zod';
import { InputValidator } from '../validators/input-validator.js';
import { Logger } from '../utils/logger.js';
import { ToolError } from '../utils/errors.js';
// Tool schema
const GetIndexesArgsSchema = z.object({
    database: z.string().min(1, 'Database name is required'),
    table: z.string().min(1, 'Table name is required')
});
export const getIndexesToolDefinition = {
    name: 'get_indexes',
    description: 'Get detailed index information for a specific table',
    inputSchema: {
        type: 'object',
        properties: {
            database: {
                type: 'string',
                description: 'Name of the database containing the table'
            },
            table: {
                type: 'string',
                description: 'Name of the table to get indexes for'
            }
        },
        required: ['database', 'table']
    }
};
export async function handleGetIndexes(args, dbManager) {
    try {
        Logger.info('Executing get_indexes tool');
        // Validate arguments
        const validationResult = GetIndexesArgsSchema.safeParse(args);
        if (!validationResult.success) {
            Logger.warn('Invalid arguments for get_indexes', validationResult.error);
            throw new ToolError(`Invalid arguments: ${validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`, 'get_indexes');
        }
        const { database, table } = validationResult.data;
        // Sanitize inputs
        const sanitizedDatabase = InputValidator.sanitizeString(database);
        const sanitizedTable = InputValidator.sanitizeString(table);
        // Validate database name format
        const dbNameValidation = InputValidator.validateDatabaseName(sanitizedDatabase);
        if (!dbNameValidation.isValid) {
            throw new ToolError(`Invalid database name: ${dbNameValidation.error}`, 'get_indexes');
        }
        // Validate table name format
        const tableNameValidation = InputValidator.validateTableName(sanitizedTable);
        if (!tableNameValidation.isValid) {
            throw new ToolError(`Invalid table name: ${tableNameValidation.error}`, 'get_indexes');
        }
        Logger.info(`Getting indexes for table: ${sanitizedDatabase}.${sanitizedTable}`);
        Logger.time('get_indexes_execution');
        // Get indexes
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
        // Create response
        const response = {
            database: sanitizedDatabase,
            table: sanitizedTable,
            indexes: groupedIndexes.map(idx => ({
                name: idx.name,
                type: idx.type,
                unique: idx.unique,
                columns: idx.columns.map((col) => ({
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
    }
    catch (error) {
        Logger.error('Error in get_indexes tool', error);
        if (error instanceof ToolError) {
            throw error;
        }
        throw new ToolError(`Failed to get indexes: ${error instanceof Error ? error.message : 'Unknown error'}`, 'get_indexes', error instanceof Error ? error : undefined);
    }
}
// Helper functions
function groupIndexesByName(indexes) {
    const indexGroups = {};
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
function analyzeIndexes(indexes) {
    const uniqueIndexes = indexes.filter(idx => idx.unique).length;
    const primaryIndex = indexes.find(idx => idx.name === 'PRIMARY');
    const compositeIndexes = indexes.filter(idx => idx.columns.length > 1).length;
    const singleColumnIndexes = indexes.filter(idx => idx.columns.length === 1).length;
    // Get all indexed columns (unique)
    const indexedColumns = new Set();
    indexes.forEach(idx => {
        idx.columns.forEach((col) => indexedColumns.add(col.name));
    });
    // Estimate table size from cardinality
    let estimatedTableSize = 0;
    if (primaryIndex && primaryIndex.columns.length > 0) {
        estimatedTableSize = primaryIndex.columns[0].cardinality || 0;
    }
    else {
        // Use highest cardinality from unique indexes
        const maxCardinality = Math.max(...indexes
            .filter(idx => idx.unique)
            .flatMap(idx => idx.columns.map((col) => col.cardinality || 0)));
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
function analyzeIndexPerformance(indexes) {
    const performance = {
        highSelectivity: [],
        lowSelectivity: [],
        potentiallyRedundant: [],
        wellDesigned: []
    };
    indexes.forEach(idx => {
        const firstColumn = idx.columns[0];
        if (!firstColumn)
            return;
        const cardinality = firstColumn.cardinality || 0;
        const isLowCardinality = cardinality < 10; // Very low selectivity
        const isHighCardinality = cardinality > 1000; // Good selectivity
        if (isLowCardinality && !idx.unique && idx.name !== 'PRIMARY') {
            performance.lowSelectivity.push({
                name: idx.name,
                cardinality,
                reason: 'Low cardinality may not provide good query performance'
            });
        }
        else if (isHighCardinality) {
            performance.highSelectivity.push({
                name: idx.name,
                cardinality,
                reason: 'High selectivity should provide good query performance'
            });
        }
        // Check for well-designed composite indexes (decreasing cardinality)
        if (idx.columns.length > 1) {
            const cardinalities = idx.columns.map((col) => col.cardinality || 0);
            const isWellOrdered = cardinalities.every((card, i) => i === 0 || card <= cardinalities[i - 1]);
            if (isWellOrdered) {
                performance.wellDesigned.push({
                    name: idx.name,
                    columns: idx.columns.map((col) => `${col.name}(${col.cardinality})`).join(', '),
                    reason: 'Columns ordered by decreasing selectivity'
                });
            }
        }
    });
    // Look for potentially redundant indexes
    indexes.forEach((idx1, i) => {
        indexes.slice(i + 1).forEach(idx2 => {
            const columns1 = idx1.columns.map((col) => col.name);
            const columns2 = idx2.columns.map((col) => col.name);
            // Check if one index is a prefix of another
            if (columns1.length <= columns2.length) {
                const isPrefix = columns1.every((col, idx) => col === columns2[idx]);
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
function analyzeIndexCoverage(indexes) {
    const coverage = {
        primaryKey: false,
        foreignKeys: [], // Would need FK info to populate
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
    const allColumns = indexes.flatMap(idx => idx.columns.map((col) => col.name.toLowerCase()));
    coverage.primaryKey = indexes.some(idx => idx.name === 'PRIMARY');
    coverage.commonPatterns.hasTimestampIndex = allColumns.some(col => col.includes('created') || col.includes('updated') || col.includes('timestamp'));
    coverage.commonPatterns.hasStatusIndex = allColumns.some(col => col.includes('status') || col.includes('state') || col.includes('active'));
    coverage.commonPatterns.hasNameIndex = allColumns.some(col => col.includes('name') || col.includes('title') || col.includes('description'));
    return coverage;
}
function generateIndexRecommendations(indexes, analysis) {
    const recommendations = [];
    if (!analysis.analysis.hasPrimaryKey) {
        recommendations.push('Add a primary key index for better performance and data integrity');
    }
    if (analysis.statistics.totalIndexes === 0) {
        recommendations.push('Table has no indexes. Consider adding indexes on frequently queried columns');
    }
    else if (analysis.statistics.totalIndexes > 10) {
        recommendations.push('Table has many indexes. Consider removing unused indexes to improve write performance');
    }
    if (analysis.statistics.compositeIndexes === 0 && analysis.statistics.totalIndexes > 3) {
        recommendations.push('Consider creating composite indexes for queries filtering on multiple columns');
    }
    // Check for missing indexes on commonly queried patterns
    const allColumns = indexes.flatMap(idx => idx.columns.map((col) => col.name.toLowerCase()));
    if (!allColumns.some(col => col.includes('created') || col.includes('timestamp'))) {
        recommendations.push('Consider adding an index on timestamp/created_at columns for temporal queries');
    }
    if (indexes.filter(idx => !idx.unique).length > 6) {
        recommendations.push('Many non-unique indexes detected. Review if all are necessary for your query patterns');
    }
    return recommendations;
}
function determinePurpose(index) {
    if (index.name === 'PRIMARY') {
        return 'primary_key';
    }
    else if (index.unique) {
        return 'unique_constraint';
    }
    else if (index.columns.length > 1) {
        return 'composite_query_optimization';
    }
    else {
        const columnName = index.columns[0]?.name.toLowerCase() || '';
        if (columnName.includes('foreign') || columnName.endsWith('_id')) {
            return 'foreign_key_optimization';
        }
        else if (columnName.includes('created') || columnName.includes('updated')) {
            return 'temporal_queries';
        }
        else if (columnName.includes('status') || columnName.includes('state')) {
            return 'filtering_optimization';
        }
        else {
            return 'query_optimization';
        }
    }
}
//# sourceMappingURL=get-indexes.js.map