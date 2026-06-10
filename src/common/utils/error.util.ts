export function formatToolError(error: unknown): string {
  if (error instanceof Error) {
    return `Tool execution failed: ${error.message}`;
  }

  return `Tool execution failed: ${String(error)}`;
}
