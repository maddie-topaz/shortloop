import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';

function mockFetchOnce(response: unknown, ok = true) {
  return jest.fn().mockResolvedValueOnce({
    ok,
    json: () => Promise.resolve(response),
  });
}

describe('App', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) }) as any;
  });

  it('loads and displays existing links', async () => {
    global.fetch = mockFetchOnce([
      { code: 'abc1234', url: 'https://example.com', createdAt: new Date().toISOString() },
    ]) as any;

    render(<App />);

    expect(await screen.findByText(/\/abc1234/)).toBeInTheDocument();
  });

  it('submits a url and shows the new short link', async () => {
    const user = userEvent.setup();
    render(<App />);

    global.fetch = mockFetchOnce({
      code: 'newcode',
      url: 'https://example.com/new',
      createdAt: new Date().toISOString(),
    }) as any;

    await user.type(screen.getByPlaceholderText(/https:\/\//), 'https://example.com/new');
    await user.click(screen.getByRole('button', { name: /shorten/i }));

    await waitFor(() => expect(screen.getByText(/\/newcode/)).toBeInTheDocument());
  });
});
