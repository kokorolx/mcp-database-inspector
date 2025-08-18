// Entry point: initializes MySQL and MCP server using a connection string argument

import { createMySQLPool } from './mysql.js';
import { createMCPServer } from './mcp.js';

async function main() {
  const dbUrl = process.argv[2];
  if (!dbUrl) {
    console.error('Error: Missing required MySQL connection string argument.\nUsage: node dist/index.js <mysql-connection-string>');
    process.exit(1);
  }
  const pool = createMySQLPool(dbUrl);

  await createMCPServer({ pool });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error:', err);
  process.exit(1);
});