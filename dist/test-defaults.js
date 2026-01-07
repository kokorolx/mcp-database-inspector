import { DatabaseManager } from './database/manager.js';
import { Logger } from './utils/logger.js';
async function testConnections() {
    const dbManager = new DatabaseManager();
    // Default credentials
    const mysqlUrl = 'mysql://root:root@localhost:3306/mysql';
    const postgresUrl = 'postgresql://postgres:postgres@localhost:5432/postgres';
    Logger.setLogLevel('info');
    console.log('Starting connectivity test with default credentials...');
    // Test MySQL
    console.log('\n--- Testing MySQL (root/root) ---');
    try {
        const mysqlName = await dbManager.addDatabase(mysqlUrl, 'mysql_default');
        console.log(`✅ Successfully added MySQL database: ${mysqlName}`);
        const tables = await dbManager.getTables(mysqlName);
        console.log(`✅ Retrieved ${tables.length} tables from MySQL`);
        if (tables.length > 0) {
            const table = tables[0].tableName;
            console.log(`\n--- Analyzing MySQL Query on ${table} ---`);
            const analysis = await dbManager.analyzeQuery(mysqlName, `SELECT * FROM ${table} LIMIT 10`);
            console.log('✅ Analysis Success');
            console.log('   Cost:', analysis.summary.cost);
            console.log('   Operations:', analysis.summary.operations.join(', '));
            if (analysis.summary.potentialIssues.length > 0) {
                console.log('   ⚠️ Issues:', analysis.summary.potentialIssues.join(', '));
            }
        }
    }
    catch (error) {
        console.error(`❌ MySQL test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    // Test PostgreSQL
    console.log('\n--- Testing PostgreSQL (postgres/postgres) ---');
    try {
        const pgName = await dbManager.addDatabase(postgresUrl, 'postgres_default');
        console.log(`✅ Successfully added PostgreSQL database: ${pgName}`);
        console.log(`\n--- Analyzing PostgreSQL Query ---`);
        // Use a system table that always exists
        const analysis = await dbManager.analyzeQuery(pgName, 'SELECT * FROM pg_catalog.pg_class LIMIT 5');
        console.log('✅ Analysis Success');
        console.log('   Cost:', analysis.summary.cost);
        console.log('   Operations:', analysis.summary.operations.join(', '));
        if (analysis.summary.potentialIssues.length > 0) {
            console.log('   ⚠️ Issues:', analysis.summary.potentialIssues.join(', '));
        }
    }
    catch (error) {
        console.error(`❌ PostgreSQL test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    await dbManager.cleanup();
    console.log('\nTest complete.');
}
testConnections().catch(err => {
    console.error('Fatal error during test:', err);
    process.exit(1);
});
//# sourceMappingURL=test-defaults.js.map