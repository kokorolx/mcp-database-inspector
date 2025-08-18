// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { handleInspectTable } from './inspect-table';
import { DatabaseManager } from '../database/manager';

const mockDbManager = {
  getTableSchema: vi.fn(),
  getIndexes: vi.fn(),
  getForeignKeys: vi.fn()
} as unknown as DatabaseManager;

describe('inspect_table', () => {
  it('should return schema for a single table', async () => {
    mockDbManager.getTableSchema.mockResolvedValueOnce([{ name: 'id', type: 'int' }]);
    mockDbManager.getIndexes.mockResolvedValueOnce([{ name: 'PRIMARY', columns: [{ name: 'id' }] }]);
    mockDbManager.getForeignKeys.mockResolvedValueOnce([]);
    const args = { database: 'testdb', table: 'users' };
    const result = await handleInspectTable(args, mockDbManager);
    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].table).toBe('users');
  });

  it('should return schemas for multiple tables', async () => {
    mockDbManager.getTableSchema
      .mockResolvedValueOnce([{ name: 'id', type: 'int' }])
      .mockResolvedValueOnce([{ name: 'id', type: 'int' }]);
    mockDbManager.getIndexes
      .mockResolvedValueOnce([{ name: 'PRIMARY', columns: [{ name: 'id' }] }])
      .mockResolvedValueOnce([{ name: 'PRIMARY', columns: [{ name: 'id' }] }]);
    mockDbManager.getForeignKeys
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const args = { database: 'testdb', tables: ['users', 'orders'] };
    const result = await handleInspectTable(args, mockDbManager);
    expect(result.tables).toHaveLength(2);
    expect(result.tables.map(t => t.table)).toEqual(['users', 'orders']);
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