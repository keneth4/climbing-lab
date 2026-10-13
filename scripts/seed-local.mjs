import { spawnSync } from 'node:child_process';
const gym = process.argv[2];
if (!['gym-a', 'gym-b'].includes(gym)) throw new Error('Use gym-a or gym-b');
const id = gym === 'gym-a' ? 'route-a' : 'route-b';
const snapshot = JSON.stringify({
  id,
  revision: 1,
  name: `Ruta demo ${gym}`,
  grade: 'V2',
  sector: 'Spray wall',
  beta: '',
  holds: [],
}).replaceAll("'", "''");
const sql = `INSERT OR IGNORE INTO routes(id,name,grade,sector) VALUES('${id}','Ruta demo ${gym}','V2','Spray wall'); INSERT OR IGNORE INTO route_revisions(route_id,revision,snapshot) VALUES('${id}',1,'${snapshot}');`;
const args = [
  'wrangler',
  'd1',
  'execute',
  'DB',
  '--local',
  '--command',
  sql,
  ...(gym === 'gym-b' ? ['--env', 'gym-b'] : []),
];
const r = spawnSync('npx', args, { stdio: 'inherit' });
process.exit(r.status ?? 1);
