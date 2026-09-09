export interface Link {
  code: string;
  url: string;
  createdAt: string;
}

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
