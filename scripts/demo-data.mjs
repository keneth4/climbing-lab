import { readFileSync } from 'node:fs';
export const manifest = JSON.parse(
  readFileSync(
    new URL('../shared/demo-manifest.json', import.meta.url),
    'utf8',
  ),
);
export const quote = (value) => "'" + String(value).replaceAll("'", "''") + "'";
export function seedSql() {
  const statements = ['BEGIN TRANSACTION;'];
  for (const [index, r] of manifest.routes.entries()) {
    const snapshot = {
      ...r,
      revision: 1,
      holds: [
        { id: 'start', x: 22, y: 78, role: 'inicio' },
        { id: 'middle', x: 48, y: 48, role: 'intermedio' },
        { id: 'finish', x: 75, y: 20, role: 'final' },
      ],
      updatedAt: '2026-10-13T12:00:00Z',
      markersVerified: false,
    };
    // Snapshot first: a previously edited route is never reseeded or overwritten.
    statements.push(
      `INSERT INTO routes(id,name,grade,sector,beta,status,publication_state) SELECT ${quote(r.id)},${quote(r.name)},${quote(r.grade)},${quote(r.sector)},${quote(r.beta)},${quote(r.status === 'retirada' ? 'retirada' : 'activa')},${quote(r.status === 'borrador' ? 'draft' : 'public')} WHERE NOT EXISTS (SELECT 1 FROM routes WHERE id=${quote(r.id)});`,
    );
    statements.push(
      `INSERT INTO route_revisions(route_id,revision,snapshot) SELECT ${quote(r.id)},1,${quote(JSON.stringify(snapshot))} WHERE NOT EXISTS (SELECT 1 FROM route_revisions WHERE route_id=${quote(r.id)});`,
    );
  }
  statements.push('COMMIT;');
  return statements.join('\n');
}
export function poster(route) {
  const escape = (text) =>
    text
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="900" viewBox="0 0 1080 900"><rect width="1080" height="900" fill="#f4f6f8"/><path d="M180 690 260 150 820 130 930 690Z" fill="#d9e3eb"/><path d="m280 630 230-245 240-180" fill="none" stroke="#174f86" stroke-width="8" stroke-dasharray="16 16"/><g fill="#174f86" stroke="white" stroke-width="5"><ellipse cx="280" cy="630" rx="60" ry="32"/><ellipse cx="510" cy="385" rx="52" ry="30"/><ellipse cx="750" cy="205" rx="60" ry="32"/></g><g fill="white" font-family="sans-serif" font-size="28" text-anchor="middle"><text x="280" y="640">I</text><text x="510" y="395">2</text><text x="750" y="215">F</text></g><g fill="#172c3e" font-family="sans-serif"><text x="70" y="76" font-size="34">${escape(route.name)} · ${escape(route.grade)}</text><text x="70" y="765" font-size="28">${escape(route.sector)}</text><text x="70" y="818" font-size="26">Ilustración de ejemplo; no fotografía del muro</text><text x="70" y="862" font-size="22">Climbing Lab · Gimnasio de ejemplo · Sin captura 3D verificada</text></g></svg>`;
}
