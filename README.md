# MCP MySQL Inspector

A powerful Model Context Protocol (MCP) server for inspecting MySQL database schemas, relationships, and structure. This tool provides AI assistants with comprehensive database introspection capabilities while maintaining strict read-only access for security.

## 🚀 Features

- **Read-Only Database Inspection**: Secure schema exploration without modification risks
- **Multi-Database Support**: Connect to multiple MySQL databases simultaneously
- **Comprehensive Schema Analysis**: Detailed table, column, index, and relationship information
- **Foreign Key Relationship Mapping**: Understand data relationships across tables
- **Index Performance Analysis**: Identify optimization opportunities
- **Security-First Design**: Query validation, input sanitization, and audit logging
- **Cross-Database Awareness**: Analyze relationships across multiple database instances

## 📋 Requirements

- Node.js 18 or higher
- MySQL 5.7+ or compatible database (MariaDB, Aurora, etc.)
- Network access to target database(s)
- Valid database credentials with SELECT permissions

## 📦 Installation

### Global Installation
```bash
npm install -g mcp-mysql-inspector
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
    "mysql-inspector": {
      "command": "npx",
      "args": [
        "mcp-mysql-inspector",
        "mysql://dev:password@localhost:3306/ecommerce",
        "mysql://dev:password@localhost:3306/analytics"
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
    "mysql-inspector": {
      "command": "node",
      "args": [
        "/path/to/mcp-mysql-inspector/dist/index.js",
        "mysql://username:password@localhost:3306/database1",
        "mysql://username:password@localhost:3306/database2"
      ]
    }
  }
}
```

## 🛠 Available Tools

### 1. `list_databases`
Lists all connected databases with connection status.

### 2. `list_tables`
Lists all tables in a specified database with metadata.

### 3. `inspect_table`
Get complete table schema including columns, types, constraints, and metadata.
Supports both single-table and multi-table inspection via the `table` (string) or `tables` (string[]) parameter.

**Parameters:**
- `database` (string, required): Name of the database.
- `table` (string, optional): Name of a single table to inspect.
- `tables` (string[], optional): Array of table names to inspect (multi-table mode).
  Provide either `table` or `tables`, not both.

**Examples:**
```json
{ "database": "mydb", "table": "users" }
{ "database": "mydb", "tables": ["users", "orders", "products"] }
```

### 4. `get_foreign_keys`
Get foreign key relationships for one or more tables, or the entire database.
Supports both single-table and multi-table inspection via the `table` (string) or `tables` (string[]) parameter.

**Parameters:**
- `database` (string, required): Name of the database.
- `table` (string, optional): Name of a single table to analyze.
- `tables` (string[], optional): Array of table names to analyze (multi-table mode).
  Provide either `table` or `tables`, not both.

**Examples:**
```json
{ "database": "mydb", "table": "orders" }
{ "database": "mydb", "tables": ["orders", "order_items"] }
```

### 5. `get_indexes`
Get detailed index information for one or more tables.
Supports both single-table and multi-table inspection via the `table` (string) or `tables` (string[]) parameter.

**Parameters:**
- `database` (string, required): Name of the database.
- `table` (string, optional): Name of a single table to analyze.
- `tables` (string[], optional): Array of table names to analyze (multi-table mode).
  Provide either `table` or `tables`, not both.

**Examples:**
```json
{ "database": "mydb", "table": "products" }
{ "database": "mydb", "tables": ["products", "categories"] }
```

## 🔒 Security Features

### Query Safety
- **Whitelist-Only Approach**: Only SELECT, SHOW, DESCRIBE, EXPLAIN queries allowed
- **SQL Injection Prevention**: Multi-layer validation and parameter binding
- **Row Limits**: Automatic limits to prevent resource exhaustion
- **Timeout Protection**: Internal query timeouts are enforced, but `timeout` is not a valid connection option.

### Input Validation
- **URL Validation**: Comprehensive connection string validation
- **Identifier Sanitization**: MySQL identifier format validation
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
```
mysql://username:password@hostname:port/database?options
```

**Supported Options:**
- `ssl=true/false` - Enable/disable SSL connections
<!--
- `timeout=seconds` - (Not supported) The `timeout` option is not valid for MySQL2 Connection and will be ignored.
-->

## 🚨 Troubleshooting

### Common Issues

#### Connection Failures
```bash
# Test connection manually
mysql -h hostname -u username -p database_name

# Check network connectivity
telnet hostname 3306

# Verify credentials and permissions
SHOW GRANTS FOR 'username'@'hostname';
```

#### Permission Errors
Ensure the database user has at least:
```sql
GRANT SELECT ON database_name.* TO 'username'@'%';
GRANT SELECT ON INFORMATION_SCHEMA.* TO 'username'@'%';
```

### Debug Mode
Enable detailed logging:
```bash
LOG_LEVEL=debug mcp-mysql-inspector "mysql://..."
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
