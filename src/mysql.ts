// MySQL connection pool setup

import mysql from 'mysql2/promise';
export function createMySQLPool(connectionString: string) {
  return mysql.createPool(connectionString);
}