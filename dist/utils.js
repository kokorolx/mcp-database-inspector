// Utility functions for MCP MySQL Inspector
export function formatTableRows(rows) {
    // Optionally format rows for output (identity for now)
    return rows;
}
export function handleError(error) {
    if (error instanceof Error) {
        return { error: error.message };
    }
    return { error: String(error) };
}
