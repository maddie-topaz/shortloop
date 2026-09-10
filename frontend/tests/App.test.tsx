import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { App } from '../src/App';

// Intercepts at axios' transport layer, so api.ts runs for real — the same
// arrangement the old `global.fetch` stub gave us.
const mock = new MockAdapter(axios);

describe('App', () => {
  beforeEach(() => {
    mock.reset();
    mock.onGet('/api/links').reply(200, []);
  });

  afterAll(() => {
    mock.restore();
  });

  it('loads and displays existing links', async () => {
    mock
      .onGet('/api/links')
      .reply(200, [{ code: 'abc1234', url: 'https://example.com', createdAt: new Date().toISOString() }]);

    render(<App />);

    expect(await screen.findByText(/\/abc1234/)).toBeInTheDocument();
  });

  it('submits a url and shows the new short link', async () => {
    const user = userEvent.setup();
    render(<App />);

    mock.onPost('/api/links').reply(201, {
      code: 'newcode',
      url: 'https://example.com/new',
      createdAt: new Date().toISOString(),
    });

    await user.type(screen.getByPlaceholderText(/https:\/\//), 'https://example.com/new');
    await user.click(screen.getByRole('button', { name: /shorten/i }));

    await waitFor(() => expect(screen.getByText(/\/newcode/)).toBeInTheDocument());
  });

  it('surfaces the error the backend reports', async () => {
    const user = userEvent.setup();
    render(<App />);

    mock.onPost('/api/links').reply(400, { error: 'url must be a valid http(s) URL' });

    await user.type(screen.getByPlaceholderText(/https:\/\//), 'https://example.com/bad');
    await user.click(screen.getByRole('button', { name: /shorten/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('url must be a valid http(s) URL');
  });
});
