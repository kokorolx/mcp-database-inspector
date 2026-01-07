import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleAnalyzeQuery } from './analyze-query.js';
import { DatabaseManager } from '../database/manager.js';

describe('analyze_query', () => {
  let mockDbManager: any;

  beforeEach(() => {
    mockDbManager = {
      analyzeQuery: vi.fn()
    };
  });

  it('should analyze a MySQL query and return execution plan', async () => {
    const mockAnalysis = {
      database: 'testdb',
      type: 'MySQL',
      query: 'SELECT * FROM users',
      plan: { query_block: { cost_info: { query_cost: 1.5 } } },
      summary: {
        cost: 1.5,
        operations: ['ALL'],
        potentialIssues: ['Full table scan on users']
      }
    };

    mockDbManager.analyzeQuery.mockResolvedValueOnce(mockAnalysis);

    const result = await handleAnalyzeQuery(
      { database: 'testdb', query: 'SELECT * FROM users' },
      mockDbManager
    );

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.summary.cost).toBe(1.5);
    expect(parsed.summary.potentialIssues).toContain('Full table scan on users');
    expect(parsed.summary.recommendation).toContain('potential performance issues');
  });

  it('should analyze a PostgreSQL query and return execution plan', async () => {
    const mockAnalysis = {
      database: 'testdb',
      type: 'PostgreSQL',
      query: 'SELECT * FROM products',
      plan: { Plan: { 'Total Cost': 2.5, 'Node Type': 'Seq Scan' } },
      summary: {
        cost: 2.5,
        operations: ['Seq Scan'],
        potentialIssues: ['Full table scan on products']
      }
    };

    mockDbManager.analyzeQuery.mockResolvedValueOnce(mockAnalysis);

    const result = await handleAnalyzeQuery(
      { database: 'testdb', query: 'SELECT * FROM products' },
      mockDbManager
    );

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.summary.cost).toBe(2.5);
    expect(parsed.summary.operations).toContain('Seq Scan');
  });

  it('should return positive recommendation when no issues found', async () => {
    const mockAnalysis = {
      database: 'testdb',
      type: 'MySQL',
      query: 'SELECT * FROM users WHERE id = 1',
      plan: { query_block: { cost_info: { query_cost: 0.35 } } },
      summary: {
        cost: 0.35,
        operations: ['const'],
        potentialIssues: []
      }
    };

    mockDbManager.analyzeQuery.mockResolvedValueOnce(mockAnalysis);

    const result = await handleAnalyzeQuery(
      { database: 'testdb', query: 'SELECT * FROM users WHERE id = 1' },
      mockDbManager
    );

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.summary.recommendation).toContain('No major performance issues');
  });

  it('should throw error if neither database nor query is provided', async () => {
    await expect(() =>
      handleAnalyzeQuery({ database: 'testdb' }, mockDbManager)
    ).rejects.toThrow(/Invalid arguments/);
  });

  it('should throw error for invalid database name', async () => {
    await expect(() =>
      handleAnalyzeQuery({ database: '', query: 'SELECT 1' }, mockDbManager)
    ).rejects.toThrow(/Invalid arguments/);
  });
});
