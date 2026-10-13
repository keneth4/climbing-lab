import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(
  'https://defblrjdwgnqyzzgozdf.supabase.co',
  'sb_publishable_1WjLUELSbBm3Rx75BcsWdg_6k49FKhz',
  { auth: { flowType: 'pkce', detectSessionInUrl: true } },
);
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api(
  path: string,
  body?: unknown,
  method?: 'POST' | 'PUT' | 'DELETE',
) {
  const { data } = await supabase.auth.getSession();
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: method || (body === undefined ? 'GET' : 'POST'),
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(data.session
          ? { Authorization: `Bearer ${data.session.access_token}` }
          : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError(
      'API no disponible. Comprueba la conexión y reintenta.',
      0,
    );
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new ApiError(
      'API no disponible: respuesta inesperada.',
      0,
    );
  }
  if (!response.ok)
    throw new ApiError(
      result.error || 'No se pudo completar la operación.',
      response.status,
    );
  return result;
}
