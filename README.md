# MCP Database Inspector

A powerful Model Context Protocol (MCP) server for inspecting **MySQL** and **PostgreSQL** database schemas, relationships, and structure. This tool provides AI assistants with comprehensive database introspection capabilities while maintaining strict read-only access for security.

## 🚀 Features

- **Multi-Database Support**: Connect to MySQL and PostgreSQL databases simultaneously
- **SQL Query Analysis**: Analyze query performance with `EXPLAIN` and get optimization recommendations
- **Read-Only Database Inspection**: Secure schema exploration without modification risks
- **Comprehensive Schema Analysis**: Detailed table, column, index, and relationship information
- **Foreign Key Relationship Mapping**: Understand data relationships across tables
- **Index Performance Analysis**: Identify optimization opportunities
- **Security-First Design**: Query validation, input sanitization, and audit logging
- **Cross-Database Awareness**: Analyze relationships across multiple database instances

## 📋 Requirements

- Node.js 18 or higher
- MySQL 5.7+ or PostgreSQL 12+ (or compatible databases)
- Network access to target database(s)
- Valid database credentials with SELECT permissions

## 📦 Installation

### Global Installation
```bash
npm install -g mcp-database-inspector
```

### Local Development
```bash
git clone https://github.com/kokorolx/mcp-mysql-inspector.git
cd mcp-mysql-inspector
npm install
npm run build
```

### MCP Client Integration

#### Roo Configuration
Create `roo-config.json`:
```json
{
  "servers": {
    "database-inspector": {
      "command": "npx",
      "args": [
        "mcp-database-inspector",
        "mysql://dev:password@localhost:3306/ecommerce",
        "postgresql://dev:password@localhost:5432/analytics"
      ]
    }
  }
}
```

#### Claude Desktop Configuration
Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "database-inspector": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-database-inspector",
        "mysql://username:password@localhost:3306/database1",
        "postgresql://username:password@localhost:5432/database2"
      ]
    }
  }
}
```

## 🛠 Available Tools

### 1. `list_databases`
Lists all connected databases with connection status and type (MySQL/PostgreSQL).

### 2. `list_tables`
Lists all tables in a specified database with metadata.

### 3. `inspect_table`
Get complete table schema including columns, types, constraints, and metadata.
Supports both single-table and multi-table inspection via the `table` (string) or `tables` (string[]) parameter.

**Parameters:**
- `database` (string, required): Name of the database.
- `table` (string, optional): Name of a single table to inspect.
- `tables` (string[], optional): Array of table names to inspect (multi-table mode).

**Examples:**
```json
{ "database": "mydb", "table": "users" }
{ "database": "mydb", "tables": ["users", "orders", "products"] }
```

### 4. `get_foreign_keys`
Get foreign key relationships for one or more tables, or the entire database.
Supports both single-table and multi-table inspection.

**Parameters:**
- `database` (string, required): Name of the database.
- `table` (string, optional): Name of a single table to analyze.
- `tables` (string[], optional): Array of table names to analyze (multi-table mode).

**Examples:**
```json
{ "database": "mydb", "table": "orders" }
{ "database": "mydb", "tables": ["orders", "order_items"] }
```

### 5. `get_indexes`
Get detailed index information for one or more tables.
Supports both single-table and multi-table inspection.

**Parameters:**
- `database` (string, required): Name of the database.
- `table` (string, optional): Name of a single table to analyze.
- `tables` (string[], optional): Array of table names to analyze (multi-table mode).

**Examples:**
```json
{ "database": "mydb", "table": "products" }
{ "database": "mydb", "tables": ["products", "categories"] }
```

### 6. `analyze_query` ✨ NEW
Analyze SQL query performance using `EXPLAIN` and get optimization recommendations.

**Parameters:**
- `database` (string, required): Name of the database to run the analysis against.
- `query` (string, required): The SQL query to analyze.

**Example:**
```json
{
  "database": "mydb",
  "query": "SELECT * FROM users WHERE email = 'test@example.com'"
}
```

**Response includes:**
- Query cost estimation
- Execution plan operations
- Potential performance issues (e.g., full table scans)
- Actionable recommendations

### 7. `execute_query`
Execute safe, read-only SQL queries with automatic validation and row limits.

**Parameters:**
- `database` (string, required): Name of the database.
- `query` (string, required): The SQL query to execute.
- `limit` (number, optional): Maximum rows to return (default: 1000, max: 10000).

**Example:**
```json
{
  "database": "mydb",
  "query": "SELECT id, name FROM users WHERE active = true",
  "limit": 100
}
```

### 8. `information_schema_query`
Query INFORMATION_SCHEMA tables with filters and limits.

**Parameters:**
- `database` (string, required): Name of the database.
- `table` (string, required): INFORMATION_SCHEMA table (COLUMNS, TABLES, or ROUTINES).
- `filters` (object, optional): Key-value filters for WHERE clause.
- `limit` (number, optional): Maximum rows to return (default: 100, max: 1000).

## 🔒 Security Features

### Query Safety
- **Whitelist-Only Approach**: Only SELECT, SHOW, DESCRIBE, EXPLAIN queries allowed
- **SQL Injection Prevention**: Multi-layer validation and parameter binding
- **Row Limits**: Automatic limits to prevent resource exhaustion
- **Timeout Protection**: Query timeouts enforced

### Input Validation
- **URL Validation**: Comprehensive connection string validation
- **Identifier Sanitization**: Database identifier format validation
- **Parameter Sanitization**: Input cleaning and null-byte removal

### Audit & Logging
- **Comprehensive Logging**: All operations logged with configurable levels
- **Sensitive Data Masking**: Credentials automatically redacted from logs
- **Performance Monitoring**: Query timing and resource usage tracking

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|----------|
| `LOG_LEVEL` | Logging level (error, warn, info, debug, trace) | `info` | `LOG_LEVEL=debug` |

### Database URL Format

**MySQL:**
```
mysql://username:password@hostname:port/database?ssl=true
```

**PostgreSQL:**
```
postgresql://username:password@hostname:port/database?ssl=true
postgres://username:password@hostname:port/database
```

**Supported Options:**
- `ssl=true/false` - Enable/disable SSL connections

## 🚨 Troubleshooting

### Common Issues

#### Connection Failures
```bash
# Test MySQL connection
mysql -h hostname -u username -p database_name

# Test PostgreSQL connection
psql -h hostname -U username -d database_name

# Check network connectivity
telnet hostname 3306  # MySQL
telnet hostname 5432  # PostgreSQL
```

#### Permission Errors
**MySQL:**
```sql
GRANT SELECT ON database_name.* TO 'username'@'%';
GRANT SELECT ON INFORMATION_SCHEMA.* TO 'username'@'%';
```

**PostgreSQL:**
```sql
GRANT CONNECT ON DATABASE database_name TO username;
GRANT USAGE ON SCHEMA public TO username;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO username;
```

### Debug Mode
Enable detailed logging:
```bash
LOG_LEVEL=debug npx mcp-database-inspector "mysql://..." "postgresql://..."
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
