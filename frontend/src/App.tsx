import { useEffect, useState } from 'react';
import { createLink, listLinks } from './api';
import { Link } from './types';

export function App() {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState<Link[]>([]);

  useEffect(() => {
    listLinks()
      .then(setLinks)
      .catch(() => setError('failed to load links'));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const link = await createLink(url);
      setLinks((prev) => [link, ...prev]);
      setUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'something went wrong');
    }
  }

  return (
    <div className="min-h-screen bg-base-200">
      <div className="navbar bg-base-100 shadow-sm">
        <span className="text-xl font-bold px-2">shortloop</span>
      </div>

      <main className="max-w-2xl mx-auto p-6 flex flex-col gap-6">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <form onSubmit={handleSubmit} className="join w-full">
              <input
                type="url"
                placeholder="https://example.com/a/very/long/url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                className="input input-bordered join-item flex-1"
              />
              <button type="submit" className="btn btn-primary join-item">
                Shorten
              </button>
            </form>
          </div>
        </div>

        {error && (
          <div role="alert" className="alert alert-error">
            <span>{error}</span>
          </div>
        )}

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <table className="table">
              <thead>
                <tr>
                  <th>Short link</th>
                  <th>Destination</th>
                </tr>
              </thead>
              <tbody>
                {links.map((link) => (
                  <tr key={link.code}>
                    <td>
                      <a href={`/${link.code}`} className="link link-primary font-mono">
                        {`/${link.code}`}
                      </a>
                    </td>
                    <td className="truncate max-w-xs">{link.url}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
