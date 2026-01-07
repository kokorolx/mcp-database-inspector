import { z } from 'zod';
import { DatabaseManager } from '../database/manager.js';
import { InputValidator } from '../validators/input-validator.js';
import { Logger } from '../utils/logger.js';
import { ToolError } from '../utils/errors.js';

// Tool schema
export const AnalyzeQueryArgsSchema = z.object({
  database: z.string().min(1, 'Database name is required'),
  query: z.string().min(1, 'SQL query is required')
});

export interface AnalyzeQueryTool {
  name: 'analyze_query';
  description: 'Analyze a SQL query performance and provide recommendations';
  inputSchema: {
    type: 'object';
    properties: {
      database: {
        type: 'string';
        description: 'Name of the database to run the analysis against';
      };
      query: {
        type: 'string';
        description: 'The SQL query to analyze';
      };
    };
    required: ['database', 'query'];
  };
}

export const analyzeQueryToolDefinition: AnalyzeQueryTool = {
  name: 'analyze_query',
  description: 'Analyze a SQL query performance and provide recommendations',
  inputSchema: {
    type: 'object',
    properties: {
      database: {
        type: 'string',
        description: 'Name of the database to run the analysis against'
      },
      query: {
        type: 'string',
        description: 'The SQL query to analyze'
      }
    },
    required: ['database', 'query']
  }
};

export async function handleAnalyzeQuery(
  args: unknown,
  dbManager: DatabaseManager
): Promise<any> {
  try {
    Logger.info('Executing analyze_query tool');

    // Validate arguments
    const validationResult = AnalyzeQueryArgsSchema.safeParse(args);
    if (!validationResult.success) {
      Logger.warn('Invalid arguments for analyze_query', validationResult.error);
      throw new ToolError(
        `Invalid arguments: ${validationResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        'analyze_query'
      );
    }

    const { database, query } = validationResult.data;

    // Sanitize database name
    const sanitizedDatabase = InputValidator.sanitizeString(database);

    Logger.info(`Analyzing query for database: ${sanitizedDatabase}`);

    const analysis = await dbManager.analyzeQuery(sanitizedDatabase, query);

    const response = {
      database: sanitizedDatabase,
      query: analysis.query,
      type: analysis.type,
      summary: {
        cost: analysis.summary.cost,
        operations: analysis.summary.operations,
        potentialIssues: analysis.summary.potentialIssues,
        recommendation: analysis.summary.potentialIssues.length > 0
          ? `Found ${analysis.summary.potentialIssues.length} potential performance issues. Consider adding indexes or refactoring the query.`
          : 'No major performance issues detected in the execution plan.'
      },
      executionPlan: analysis.plan
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2)
      }]
    };

  } catch (error) {
    Logger.error('Error in analyze_query tool', error);

    if (error instanceof ToolError) {
      throw error;
    }

    throw new ToolError(
      `Failed to analyze query: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'analyze_query',
      error instanceof Error ? error : undefined
    );
  }
}
