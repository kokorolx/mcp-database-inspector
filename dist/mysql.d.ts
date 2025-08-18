import mysql from 'mysql2/promise';
export declare function createMySQLPool(connectionString: string): mysql.Pool;
