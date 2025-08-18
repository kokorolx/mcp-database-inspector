// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { handleGetIndexes } from './get-indexes';
import { DatabaseManager } from '../database/manager';

const mockDbManager = {
  getIndexes: vi.fn()
} as unknown as DatabaseManager;

describe('get_indexes', () => {
  it('should return indexes for a single table', async () => {
    mockDbManager.getIndexes.mockResolvedValueOnce([{ name: 'PRIMARY', columns: [{ name: 'id' }] }]);
    const args = { database: 'testdb', table: 'products' };
    const result = await handleGetIndexes(args, mockDbManager);
    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].table).toBe('products');
    expect(result.tables[0].indexes[0].name).toBe('PRIMARY');
  });

  it('should return indexes for multiple tables', async () => {
    mockDbManager.getIndexes
      .mockResolvedValueOnce([{ name: 'PRIMARY', columns: [{ name: 'id' }] }])
      .mockResolvedValueOnce([{ name: 'PRIMARY', columns: [{ name: 'id' }] }]);
    const args = { database: 'testdb', tables: ['products', 'categories'] };
    const result = await handleGetIndexes(args, mockDbManager);
    expect(result.tables).toHaveLength(2);
    expect(result.tables.map(t => t.table)).toEqual(['products', 'categories']);
  });

  it('should throw error if neither table nor tables is provided', async () => {
    await expect(() =>
      handleGetIndexes({ database: 'testdb' }, mockDbManager)
    ).rejects.toThrow(/Either 'table' or non-empty 'tables'/);
  });

  it('should throw error for invalid table name', async () => {
    await expect(() =>
      handleGetIndexes({ database: 'testdb', table: 'invalid;DROP' }, mockDbManager)
    ).rejects.toThrow(/Invalid table name/);
  });

  it('should throw error if table not found', async () => {
    mockDbManager.getIndexes.mockResolvedValueOnce([]);
    await expect(() =>
      handleGetIndexes({ database: 'testdb', table: 'notfound' }, mockDbManager)
    ).rejects.toThrow(/not found/);
  });
});