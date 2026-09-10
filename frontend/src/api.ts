import axios from 'axios';
import { Link } from './types';

/**
 * The backend reports failures as `{ error: string }`. Axios rejects on any
 * non-2xx rather than handing back a response to inspect, so the message has
 * to be dug out of the rejection instead of read off `res.ok`.
 */
const serverMessage = (err: unknown): string | undefined =>
  axios.isAxiosError(err) ? (err.response?.data as { error?: string } | undefined)?.error : undefined;

export const createLink = async (url: string): Promise<Link> => {
  try {
    const { data } = await axios.post<Link>('/api/links', { url });
    return data;
  } catch (err) {
    throw new Error(serverMessage(err) ?? 'failed to create link', { cause: err });
  }
};

export const listLinks = async (): Promise<Link[]> => {
  try {
    const { data } = await axios.get<Link[]>('/api/links');
    return data;
  } catch (err) {
    throw new Error('failed to list links', { cause: err });
  }
};
