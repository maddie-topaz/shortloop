import { contract, Link } from '@shortloop/contract';
import { ApiFetcher, initClient } from '@ts-rest/core';
import axios from 'axios';

/**
 * ts-rest drives axios rather than its default fetch, so the transport stays
 * the one the app already uses. validateStatus is disabled because the
 * contract declares 4xx and 5xx as real responses — ts-rest needs to see the
 * status, not have axios turn it into a rejection.
 */
const axiosApi: ApiFetcher = async ({ path, method, headers, body }) => {
  const response = await axios.request({
    url: path,
    method,
    headers,
    data: body,
    validateStatus: () => true,
  });

  return {
    status: response.status,
    body: response.data,
    headers: new Headers(Object.entries(response.headers).map(([k, v]): [string, string] => [k, String(v)])),
  };
};

const client = initClient(contract, {
  baseUrl: '',
  api: axiosApi,
  // Every response is parsed against the contract, so a backend that changes
  // shape fails loudly here instead of surfacing as `undefined` several
  // components later.
  validateResponse: true,
});

export const createLink = async (url: string): Promise<Link> => {
  const result = await client.createLink({ body: { url } });
  if (result.status === 201) {
    return result.body;
  }
  // 400 and 500 are the only failures the contract declares; anything else is
  // off-contract and has no guaranteed shape to read a message from.
  if (result.status === 400 || result.status === 500) {
    throw new Error(result.body.error);
  }
  throw new Error('failed to create link');
};

export const listLinks = async (): Promise<Link[]> => {
  const result = await client.listLinks();
  if (result.status === 200) {
    return result.body;
  }
  throw new Error('failed to list links');
};
