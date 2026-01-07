// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import { handleGetForeignKeys } from './get-foreign-keys';
import { DatabaseManager } from '../database/manager';

const mockDbManager = {
  getForeignKeys: vi.fn()
} as unknown as DatabaseManager;

describe('get_foreign_keys', () => {
  it('should return foreign keys for a single table', async () => {
    mockDbManager.getForeignKeys.mockResolvedValueOnce([{ constraintName: 'fk_orders_users', tableName: 'orders', columnName: 'user_id', referencedTableName: 'users', referencedColumnName: 'id' }]);
    const args = { database: 'testdb', table: 'orders' };
    const result = await handleGetForeignKeys(args, mockDbManager);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.table).toBe('orders');
    expect(parsed.foreignKeys[0].sourceColumn).toBe('user_id');
  });

  it('should return foreign keys for multiple tables', async () => {
    mockDbManager.getForeignKeys
      .mockResolvedValueOnce([{ constraintName: 'fk_orders_users', tableName: 'orders', columnName: 'user_id', referencedTableName: 'users', referencedColumnName: 'id' }])
      .mockResolvedValueOnce([{ constraintName: 'fk_items_orders', tableName: 'order_items', columnName: 'order_id', referencedTableName: 'orders', referencedColumnName: 'id' }]);
    const args = { database: 'testdb', tables: ['orders', 'order_items'] };
    const result = await handleGetForeignKeys(args, mockDbManager);
    const parsed = JSON.parse(result.content[0].text);
    expect(Object.keys(parsed.results)).toHaveLength(2);
    expect(parsed.results.orders.table).toBe('orders');
    expect(parsed.results.order_items.table).toBe('order_items');
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

  it('should return empty result if table not found', async () => {
    mockDbManager.getForeignKeys.mockResolvedValueOnce([]);
    const result = await handleGetForeignKeys({ database: 'testdb', table: 'notfound' }, mockDbManager);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.foreignKeys).toHaveLength(0);
    expect(parsed.summary.message).toMatch(/No foreign key relationships found/);
  });
});