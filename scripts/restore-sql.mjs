import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
/** @param {string} source */
export function splitSql(source) {
  const statements = [];
  let start = 0,
    quote = '',
    lineComment = false,
    blockComment = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i],
      next = source[i + 1];
    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false;
        i++;
      }
      continue;
    }
    if (quote) {
      if (ch === quote) {
        if (next === quote) i++;
        else quote = '';
      }
      continue;
    }
    if (ch === '-' && next === '-') {
      lineComment = true;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      blockComment = true;
      i++;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '[') {
      quote = ']';
      continue;
    }
    if (ch === ';') {
      statements.push(source.slice(start, i + 1).trim());
      start = i + 1;
    }
  }
  if (quote || blockComment) throw new Error('SQL incompleto.');
  if (source.slice(start).trim()) statements.push(source.slice(start).trim());
  return statements;
}
/** @param {string} source */
export function prepareRestore(source) {
  const statements = splitSql(source);
  /** @param {string} s */
  const clean = (s) => s.replace(/^\s*(?:--[^\n]*\n\s*)*/, '').trim();
  if (statements.some((s) => /^CREATE\s+(?:TEMP\s+)?TRIGGER\b/i.test(clean(s))))
    throw new Error(
      'Este preparador no admite triggers; revisa el dump manualmente.',
    );
  const tables = statements.filter((s) => /^CREATE\s+TABLE\b/i.test(clean(s))),
    rest = statements.filter(
      (s) =>
        !/^CREATE\s+TABLE\b/i.test(clean(s)) &&
        !/^PRAGMA\s+defer_foreign_keys\b/i.test(clean(s)),
    );
  if (!tables.length)
    throw new Error('El backup debe incluir el esquema completo.');
  return (
    'PRAGMA defer_foreign_keys=TRUE;\n' + [...tables, ...rest].join('\n') + '\n'
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output || resolve(input) === resolve(output))
    throw new Error(
      'Indica backup SQL original y un archivo de restauración distinto.',
    );
  await writeFile(output, prepareRestore(await readFile(input, 'utf8')));
  console.log(
    'SQL preparado: tablas primero, datos después. Importa sólo en una base nueva y verifica foreign_key_check.',
  );
}
