import { it, expect } from 'vitest';
import { prepareRestore } from '../scripts/restore-sql.mjs';
it('prepares referenced tables before data while preserving quoted SQL and original content', () => {
  const input =
    "PRAGMA defer_foreign_keys=TRUE; CREATE TABLE child(id INTEGER,parent INTEGER REFERENCES parent(id));INSERT INTO child VALUES(1,1);CREATE TABLE parent(id INTEGER PRIMARY KEY,name TEXT);INSERT INTO parent VALUES(1,'A; ''B''');";
  const prepared = prepareRestore(input);
  expect(prepared.indexOf('CREATE TABLE parent')).toBeLessThan(
    prepared.indexOf('INSERT INTO child'),
  );
  expect(prepared).toContain("'A; ''B'''");
  expect(prepared.split('PRAGMA defer_foreign_keys')).toHaveLength(2);
  expect(() =>
    prepareRestore('CREATE TRIGGER example BEGIN SELECT 1; END;'),
  ).toThrow();
});
