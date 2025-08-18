// Zod schemas for validating MCP tool/resource input

import { z } from 'zod';

// Example: schema for inspecting a table
export const inspectTableSchema = z.object({
  table: z.string().min(1, 'Table name is required'),
});

// Example: schema for listing tables (no input needed)
export const listTablesSchema = z.object({});