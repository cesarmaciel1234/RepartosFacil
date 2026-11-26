export class FirestorePermissionError extends Error {
  constructor(context: {
    path: string;
    operation: string;
    requestResourceData?: unknown;
  }) {
    super(`Local database operation failed: ${context.operation} ${context.path}`);
    this.name = "LocalDatabaseError";
  }
}
