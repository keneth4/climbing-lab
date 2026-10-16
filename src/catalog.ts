import type { Route } from './domain';
import { normalize, gradeScale, gradeRank } from './pilot';
export type CatalogFilters = {
  query: string;
  grade: string;
  sector: string;
  zone: string;
  scale: string;
  min: string;
  max: string;
  order: string;
  retired: boolean;
};
export function filterCatalog(routes: Route[], f: CatalogFilters): Route[] {
  return routes
    .filter(
      (r) =>
        (r.status === 'activa' || (f.retired && r.status === 'retirada')) &&
        (!f.grade || r.grade === f.grade) &&
        (!f.sector || r.sector === f.sector) &&
        (!f.zone || r.sectionId === f.zone) &&
        (!f.scale || (r.gradeScale || gradeScale(r.grade)) === f.scale) &&
        (!f.min ||
          (gradeRank(r.grade, f.scale) ?? -Infinity) >=
            (gradeRank(f.min, f.scale) ?? Infinity)) &&
        (!f.max ||
          (gradeRank(r.grade, f.scale) ?? Infinity) <=
            (gradeRank(f.max, f.scale) ?? -Infinity)) &&
        normalize(`${r.name} ${r.sector}`).includes(normalize(f.query)),
    )
    .sort((a, b) =>
      f.order === 'nombre'
        ? a.name.localeCompare(b.name)
        : (b.updatedAt || '').localeCompare(a.updatedAt || ''),
    );
}
