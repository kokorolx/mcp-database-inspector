// MCP server registration and MySQL tool/resource logic (refactored for ESM SDK API and native HTTP)
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { inspectTableSchema } from './validation.js';
import { formatTableRows, handleError } from './utils.js';
export async function createMCPServer({ pool }) {
    // MCP server info
    const serverInfo = {
        name: 'mysql-inspector',
        description: 'MCP server for MySQL schema inspection',
        version: '1.0.0',
    };
    // Instantiate MCP server
    const mcpServer = new McpServer(serverInfo);
    // Register tools
    mcpServer.tool('list_tables', 'List all tables in the database', async () => {
        try {
            const [rows] = await pool.query('SHOW TABLES');
            return formatTableRows(rows);
        }
        catch (err) {
            return handleError(err);
        }
    });
    mcpServer.tool('inspect_table', 'Get schema for a specific table', inspectTableSchema.shape, async ({ table }) => {
        try {
            const [rows] = await pool.query(`DESCRIBE \`${table}\``);
            return formatTableRows(rows);
        }
        catch (err) {
            return handleError(err);
        }
    });
    // Set up stdio transport
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    // No HTTP server needed for stdio transport
    // eslint-disable-next-line no-console
    console.log('MCP MySQL Inspector running with stdio transport');
}
