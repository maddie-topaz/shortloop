import type { Link } from '@shortloop/contract';

// Re-exported so store consumers keep importing Link from here, but the shape
// itself is inferred from the contract schema rather than declared twice.
export type { Link };

// The one class in the codebase: custom error types need `extends Error` for
// `instanceof` narrowing (app.ts relies on it) and for usable stack traces.
// eslint-disable-next-line no-restricted-syntax
export class CodeAlreadyExistsError extends Error {
  constructor(code: string) {
    super(`code already exists: ${code}`);
  }
}

export interface LinkStore {
  createLink(code: string, url: string): Promise<Link>;
  getLink(code: string): Promise<Link | null>;
  listLinks(): Promise<Link[]>;
}
