import manifest from '../shared/demo-manifest.json';
import { HttpError } from './http';
export async function demoAsset(
  request: Request,
  env: Env,
): Promise<Response | undefined> {
  const path = new URL(request.url).pathname;
  if (!path.startsWith('/api/demo-assets/')) return;
  if (request.method !== 'GET') throw new HttpError(405, 'Solo lectura.');
  const id = path.slice('/api/demo-assets/'.length);
  if (
    env.GYM_ID !== 'gym-demo' ||
    !manifest.routes.some((r) => r.illustrationId === id)
  )
    throw new HttpError(404, 'Ilustración no disponible.');
  const published = await env.DB.prepare(
    "SELECT 1 FROM route_revisions rr JOIN routes r ON r.id=rr.route_id WHERE r.publication_state='public' AND json_extract(rr.snapshot,'$.illustrationId')=? LIMIT 1",
  )
    .bind(id)
    .first();
  if (!published) throw new HttpError(404, 'Ilustración no disponible.');
  const object = await env.CAPTURES.get(`demo/v1/${id}.svg`);
  if (!object) throw new HttpError(404, 'Ilustración no disponible.');
  return new Response(object.body, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy':
        "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
