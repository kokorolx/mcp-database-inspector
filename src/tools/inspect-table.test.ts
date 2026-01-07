// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import { handleInspectTable } from './inspect-table';
import { DatabaseManager } from '../database/manager';

const mockDbManager = {
  getTableSchema: vi.fn(),
  getIndexes: vi.fn(),
  getForeignKeys: vi.fn()
} as unknown as DatabaseManager;

describe('inspect_table', () => {
  it('should return schema for a single table', async () => {
    mockDbManager.getTableSchema.mockResolvedValueOnce([{ columnName: 'id', dataType: 'int', isNullable: 'NO', isPrimaryKey: true, isAutoIncrement: true }]);
    mockDbManager.getIndexes.mockResolvedValueOnce([{ indexName: 'PRIMARY', columnName: 'id', nonUnique: false, nullable: false, isPrimary: true }]);
    mockDbManager.getForeignKeys.mockResolvedValueOnce([]);
    const args = { database: 'testdb', table: 'users' };
    const result = await handleInspectTable(args, mockDbManager);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.table).toBe('users');
  });

  it('should return schemas for multiple tables', async () => {
    mockDbManager.getTableSchema
      .mockResolvedValueOnce([{ columnName: 'id', dataType: 'int', isNullable: 'NO', isPrimaryKey: true, isAutoIncrement: true }])
      .mockResolvedValueOnce([{ columnName: 'id', dataType: 'int', isNullable: 'NO', isPrimaryKey: true, isAutoIncrement: true }]);
    mockDbManager.getIndexes
      .mockResolvedValueOnce([{ indexName: 'PRIMARY', columnName: 'id', nonUnique: false, nullable: false, isPrimary: true }])
      .mockResolvedValueOnce([{ indexName: 'PRIMARY', columnName: 'id', nonUnique: false, nullable: false, isPrimary: true }]);
    mockDbManager.getForeignKeys
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const args = { database: 'testdb', tables: ['users', 'orders'] };
    const result = await handleInspectTable(args, mockDbManager);
    const parsed = JSON.parse(result.content[0].text);
    expect(Object.keys(parsed)).toHaveLength(2);
    expect(parsed.users.table).toBe('users');
    expect(parsed.orders.table).toBe('orders');
  });

  it('should throw error if neither table nor tables is provided', async () => {
    await expect(() =>
      handleInspectTable({ database: 'testdb' }, mockDbManager)
    ).rejects.toThrow(/Either 'table' or non-empty 'tables'/);
  });

  it('should throw error for invalid table name', async () => {
    await expect(() =>
      handleInspectTable({ database: 'testdb', table: 'invalid;DROP' }, mockDbManager)
    ).rejects.toThrow(/Invalid table name/);
  });

  it('should throw error if table not found', async () => {
    mockDbManager.getTableSchema.mockResolvedValueOnce([]);
    await expect(() =>
      handleInspectTable({ database: 'testdb', table: 'notfound' }, mockDbManager)
    ).rejects.toThrow(/not found/);
  });
});