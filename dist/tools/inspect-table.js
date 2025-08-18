import { z } from 'zod';
import { InputValidator } from '../validators/input-validator.js';
import { Logger } from '../utils/logger.js';
import { ToolError } from '../utils/errors.js';
// Tool schema
const InspectTableArgsSchema = z.object({
    database: z.string().min(1, 'Database name is required'),
    table: z.string().min(1, 'Table name is required')
});
export const inspectTableToolDefinition = {
    name: 'inspect_table',
    description: 'Get complete table schema including columns, types, constraints, and metadata',
    inputSchema: {
        type: 'object',
        properties: {
            database: {
                type: 'string',
                description: 'Name of the database containing the table'
            },
            table: {
                type: 'string',
                description: 'Name of the table to inspect'
            }
        },
        required: ['database', 'table']
    }
};
export async function handleInspectTable(args, dbManager) {
    try {
        Logger.info('Executing inspect_table tool');
        // Validate arguments
        const validationResult = InspectTableArgsSchema.safeParse(args);
        if (!validationResult.success) {
            Logger.warn('Invalid arguments for inspect_table', validationResult.error);
            throw new ToolError(`Invalid arguments: ${validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`, 'inspect_table');
        }
        const { database, table } = validationResult.data;
        // Sanitize inputs
        const sanitizedDatabase = InputValidator.sanitizeString(database);
        const sanitizedTable = InputValidator.sanitizeString(table);
        // Validate database name format
        const dbNameValidation = InputValidator.validateDatabaseName(sanitizedDatabase);
        if (!dbNameValidation.isValid) {
            throw new ToolError(`Invalid database name: ${dbNameValidation.error}`, 'inspect_table');
        }
        // Validate table name format
        const tableNameValidation = InputValidator.validateTableName(sanitizedTable);
        if (!tableNameValidation.isValid) {
            throw new ToolError(`Invalid table name: ${tableNameValidation.error}`, 'inspect_table');
        }
        Logger.info(`Inspecting table: ${sanitizedDatabase}.${sanitizedTable}`);
        Logger.time('inspect_table_execution');
        // Get table schema
        const columns = await dbManager.getTableSchema(sanitizedDatabase, sanitizedTable);
        // Get additional metadata in parallel
        const [foreignKeys, indexes] = await Promise.all([
            dbManager.getForeignKeys(sanitizedDatabase, sanitizedTable),
            dbManager.getIndexes(sanitizedDatabase, sanitizedTable)
        ]);
        Logger.timeEnd('inspect_table_execution');
        Logger.info(`Retrieved schema for table: ${sanitizedDatabase}.${sanitizedTable} with ${columns.length} columns`);
        if (columns.length === 0) {
            throw new ToolError(`Table '${sanitizedTable}' not found in database '${sanitizedDatabase}' or has no accessible columns`, 'inspect_table');
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
                unique: indexes.filter(idx => !idx.nonUnique && idx.indexName !== 'PRIMARY')
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
                description: `Table '${sanitizedTable}' has ${columns.length} columns with ${columns.filter(col => col.isPrimaryKey).length} primary key column(s) and ${indexes.length > 0 ? [...new Set(indexes.map(idx => idx.indexName))].length : 0} index(es)`,
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
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify(response, null, 2)
                }]
        };
    }
    catch (error) {
        Logger.error('Error in inspect_table tool', error);
        if (error instanceof ToolError) {
            throw error;
        }
        throw new ToolError(`Failed to inspect table: ${error instanceof Error ? error.message : 'Unknown error'}`, 'inspect_table', error instanceof Error ? error : undefined);
    }
}
// Helper functions
function formatFullDataType(column) {
    let type = column.dataType.toLowerCase();
    if (column.characterMaximumLength !== null && column.characterMaximumLength !== undefined) {
        type += `(${column.characterMaximumLength})`;
    }
    else if (column.numericPrecision !== null && column.numericPrecision !== undefined) {
        if (column.numericScale !== null && column.numericScale !== undefined && column.numericScale > 0) {
            type += `(${column.numericPrecision},${column.numericScale})`;
        }
        else {
            type += `(${column.numericPrecision})`;
        }
    }
    return type;
}
function getColumnConstraints(column) {
    const constraints = [];
    if (column.isPrimaryKey)
        constraints.push('PRIMARY KEY');
    if (column.isAutoIncrement)
        constraints.push('AUTO_INCREMENT');
    if (column.isNullable === 'NO')
        constraints.push('NOT NULL');
    return constraints;
}
function groupColumnsByType(columns) {
    const groups = {
        numeric: [],
        string: [],
        datetime: [],
        binary: [],
        json: [],
        other: []
    };
    columns.forEach(col => {
        const type = col.dataType.toLowerCase();
        if (['int', 'bigint', 'smallint', 'tinyint', 'mediumint', 'decimal', 'numeric', 'float', 'double', 'bit'].some(t => type.includes(t))) {
            groups.numeric.push(col.columnName);
        }
        else if (['varchar', 'char', 'text', 'longtext', 'mediumtext', 'tinytext', 'enum', 'set'].some(t => type.includes(t))) {
            groups.string.push(col.columnName);
        }
        else if (['datetime', 'date', 'time', 'timestamp', 'year'].some(t => type.includes(t))) {
            groups.datetime.push(col.columnName);
        }
        else if (['binary', 'varbinary', 'blob', 'longblob', 'mediumblob', 'tinyblob'].some(t => type.includes(t))) {
            groups.binary.push(col.columnName);
        }
        else if (type === 'json') {
            groups.json.push(col.columnName);
        }
        else {
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
            subPart: idx.subPart
        });
    });
    return Object.values(indexGroups);
}
function analyzeTableSchema(columns, indexes, foreignKeys) {
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
//# sourceMappingURL=inspect-table.js.map