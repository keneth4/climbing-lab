import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(
  'https://defblrjdwgnqyzzgozdf.supabase.co',
  'sb_publishable_1WjLUELSbBm3Rx75BcsWdg_6k49FKhz',
  { auth: { flowType: 'pkce', detectSessionInUrl: true } },
);
export async function api(
  path: string,
  body?: unknown,
  method?: 'POST' | 'PUT' | 'DELETE',
) {
  const { data } = await supabase.auth.getSession();
  const response = await fetch(`/api${path}`, {
    method: method || (body === undefined ? 'GET' : 'POST'),
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(data.session
        ? { Authorization: `Bearer ${data.session.access_token}` }
        : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || 'No se pudo completar la operación.');
  return result;
}
