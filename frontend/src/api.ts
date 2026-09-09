import { Link } from './types';

export async function createLink(url: string): Promise<Link> {
  const res = await fetch('/api/links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error ?? 'failed to create link');
  }
  return body;
}

export async function listLinks(): Promise<Link[]> {
  const res = await fetch('/api/links');
  if (!res.ok) {
    throw new Error('failed to list links');
  }
  return res.json();
}
