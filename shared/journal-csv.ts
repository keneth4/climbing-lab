export function journalCsv(
  entries: {
    id?: string;
    routeId?: string;
    date: string;
    routeName: string;
    grade: string;
    revision: number;
    result: string;
    attempts: number;
    notes: string;
    deletedAt?: string | null;
    entryVersion?: number;
  }[],
): string {
  const cell = (v: unknown) => {
    let text = String(v ?? '');
    if (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const rows = [
    [
      'Fecha UTC',
      'Ruta',
      'Grado',
      'Revisión de ruta',
      'Resultado',
      'Intentos',
      'Notas',
      'Estado registro',
      'Versión registro',
    ],
    ...entries.map((e) => [
      e.date,
      e.routeName,
      e.grade,
      e.revision,
      e.result,
      e.attempts,
      e.notes,
      e.deletedAt ? 'retirado' : 'vigente',
      e.entryVersion || 1,
    ]),
  ];
  return '\uFEFF' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
}
