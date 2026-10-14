import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getSession: mocks.session } }),
}));
import { api, setApiOwner } from './auth';
afterEach(() => {
  setApiOwner('');
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it('does not send a draft with a new account token after an asynchronous session change', async () => {
  const fetch = vi.fn(),
    dispatchEvent = vi.fn();
  vi.stubGlobal('fetch', fetch);
  vi.stubGlobal('window', { dispatchEvent });
  let resolve!: (value: unknown) => void;
  mocks.session.mockReturnValue(new Promise((r) => (resolve = r)));
  setApiOwner('account-a');
  const saving = api('/entries', { routeId: 'route', notes: 'Only A' });
  setApiOwner('account-b');
  resolve({
    data: { session: { user: { id: 'account-b' }, access_token: 'token-b' } },
  });
  await expect(saving).rejects.toMatchObject({ status: 401 });
  expect(fetch).not.toHaveBeenCalled();
  expect(dispatchEvent).toHaveBeenCalledOnce();
  setApiOwner('account-a');
  mocks.session.mockResolvedValue({
    data: { session: { user: { id: 'account-b' }, access_token: 'token-b' } },
  });
  await expect(api('/entries')).rejects.toMatchObject({ status: 401 });
  expect(fetch).not.toHaveBeenCalled();
});
it('accepts a confirmed account mutation and never sends the identity guard as a request field', async () => {
  mocks.session.mockResolvedValue({
    data: { session: { user: { id: 'account-a' }, access_token: 'token-a' } },
  });
  const fetch = vi.fn().mockResolvedValue(Response.json({ id: 'entry' }));
  vi.stubGlobal('fetch', fetch);
  setApiOwner('account-a');
  await expect(api('/entries', { routeId: 'route' })).resolves.toEqual({
    id: 'entry',
  });
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer token-a');
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ routeId: 'route' });
});
