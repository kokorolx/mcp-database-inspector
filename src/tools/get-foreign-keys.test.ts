// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { handleGetForeignKeys } from './get-foreign-keys';
import { DatabaseManager } from '../database/manager';

const mockDbManager = {
  getForeignKeys: vi.fn()
} as unknown as DatabaseManager;

describe('get_foreign_keys', () => {
  it('should return foreign keys for a single table', async () => {
    mockDbManager.getForeignKeys.mockResolvedValueOnce([{ column: 'user_id', referencedTable: 'users' }]);
    const args = { database: 'testdb', table: 'orders' };
    const result = await handleGetForeignKeys(args, mockDbManager);
    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].table).toBe('orders');
    expect(result.tables[0].foreignKeys[0].column).toBe('user_id');
  });

  it('should return foreign keys for multiple tables', async () => {
    mockDbManager.getForeignKeys
      .mockResolvedValueOnce([{ column: 'user_id', referencedTable: 'users' }])
      .mockResolvedValueOnce([{ column: 'order_id', referencedTable: 'orders' }]);
    const args = { database: 'testdb', tables: ['orders', 'order_items'] };
    const result = await handleGetForeignKeys(args, mockDbManager);
    expect(result.tables).toHaveLength(2);
    expect(result.tables.map(t => t.table)).toEqual(['orders', 'order_items']);
  });

  it('should throw error if neither table nor tables is provided', async () => {
    await expect(() =>
      handleGetForeignKeys({ database: 'testdb' }, mockDbManager)
    ).rejects.toThrow(/Either 'table' or non-empty 'tables'/);
  });

  it('should throw error for invalid table name', async () => {
    await expect(() =>
      handleGetForeignKeys({ database: 'testdb', table: 'invalid;DROP' }, mockDbManager)
    ).rejects.toThrow(/Invalid table name/);
  });

  it('should throw error if table not found', async () => {
    mockDbManager.getForeignKeys.mockResolvedValueOnce([]);
    await expect(() =>
      handleGetForeignKeys({ database: 'testdb', table: 'notfound' }, mockDbManager)
    ).rejects.toThrow(/not found/);
  });
});