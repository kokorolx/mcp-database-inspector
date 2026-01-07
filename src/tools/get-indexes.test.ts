// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import { handleGetIndexes } from './get-indexes';
import { DatabaseManager } from '../database/manager';

const mockDbManager = {
  getIndexes: vi.fn()
} as unknown as DatabaseManager;

describe('get_indexes', () => {
  it('should return indexes for a single table', async () => {
    mockDbManager.getIndexes.mockResolvedValueOnce([{ indexName: 'PRIMARY', tableName: 'products', columnName: 'id', nonUnique: false, nullable: false, isPrimary: true }]);
    const args = { database: 'testdb', table: 'products' };
    const result = await handleGetIndexes(args, mockDbManager);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.table).toBe('products');
    expect(parsed.indexes[0].name).toBe('PRIMARY');
  });

  it('should return indexes for multiple tables', async () => {
    mockDbManager.getIndexes
      .mockResolvedValueOnce([{ indexName: 'PRIMARY', tableName: 'products', columnName: 'id', nonUnique: false, nullable: false, isPrimary: true }])
      .mockResolvedValueOnce([{ indexName: 'PRIMARY', tableName: 'categories', columnName: 'id', nonUnique: false, nullable: false, isPrimary: true }]);
    const args = { database: 'testdb', tables: ['products', 'categories'] };
    const result = await handleGetIndexes(args, mockDbManager);
    const parsed = JSON.parse(result.content[0].text);
    expect(Object.keys(parsed)).toHaveLength(2);
    expect(parsed.products.table).toBe('products');
    expect(parsed.categories.table).toBe('categories');
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

  it('should return empty result if table not found', async () => {
    mockDbManager.getIndexes.mockResolvedValueOnce([]);
    const result = await handleGetIndexes({ database: 'testdb', table: 'notfound' }, mockDbManager);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.indexes).toHaveLength(0);
    expect(parsed.summary.message).toMatch(/No indexes found/);
  });
});