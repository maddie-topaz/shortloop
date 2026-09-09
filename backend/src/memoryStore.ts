import { CodeAlreadyExistsError, Link, LinkStore } from './store';

export class MemoryStore implements LinkStore {
  private links = new Map<string, Link>();

  async createLink(code: string, url: string): Promise<Link> {
    if (this.links.has(code)) {
      throw new CodeAlreadyExistsError(code);
    }
    const link: Link = { code, url, createdAt: new Date().toISOString() };
    this.links.set(code, link);
    return link;
  }

  async getLink(code: string): Promise<Link | null> {
    return this.links.get(code) ?? null;
  }

  async listLinks(): Promise<Link[]> {
    return [...this.links.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
}
