// Utility functions for MCP MySQL Inspector

export function formatTableRows(rows: any[]): any[] {
  // Optionally format rows for output (identity for now)
  return rows;
}

export function handleError(error: unknown): { error: string } {
  if (error instanceof Error) {
    return { error: error.message };
  }
  return { error: String(error) };
}