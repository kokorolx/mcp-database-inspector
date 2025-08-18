// MySQL connection pool setup
import mysql from 'mysql2/promise';
export function createMySQLPool(connectionString) {
    return mysql.createPool(connectionString);
}
