import { site, cardPalette } from './site';
export type CardInfo = {
  title: string;
  grade: string;
  gym: string;
  revision?: number;
  url?: string;
  personal?: {
    name?: string;
    result?: string;
    attempts?: number;
    date?: string;
    notes?: string;
  };
};
export function renderCard(
  source: HTMLCanvasElement,
  info: CardInfo,
  destination?: HTMLCanvasElement,
): HTMLCanvasElement {
  const out = destination || document.createElement('canvas');
  out.width = 1280;
  const c = out.getContext('2d')!;
  const rows: { text: string; font: string; y: number }[] = [];
  let y = 578;
  const add = (text: string, size: number, bold = false) => {
    if (!text) return;
    const font = `${bold ? 'bold ' : ''}${size}px system-ui`;
    c.font = font;
    let line = '';
    for (const char of text) {
      if (char === '\n' || c.measureText(line + char).width > 1216) {
        rows.push({ text: line, font, y });
        y += size + 9;
        line = '';
      }
      if (char !== '\n') line += char;
    }
    rows.push({ text: line, font, y });
    y += size + 9;
  };
  add(`${info.title} · ${info.grade}`, 30, true);
  add(
    `${info.gym || site.brand.attribution}${info.revision ? ` · Revisión ${info.revision}` : ''}`,
    23,
  );
  if (info.personal) {
    const p = info.personal;
    add(
      [
        p.name,
        p.result,
        p.date,
        p.attempts === undefined
          ? ''
          : `${p.attempts} ${p.attempts === 1 ? 'intento' : 'intentos'}`,
      ]
        .filter(Boolean)
        .join(' · '),
      23,
    );
    add(p.notes || '', 22);
  }
  add(info.url || '', 18);
  out.height = Math.max(720, Math.ceil(y + 24));
  c.fillStyle = cardPalette().background;
  c.fillRect(0, 0, out.width, out.height);
  const scale = Math.min(1280 / source.width, 540 / source.height),
    w = source.width * scale,
    h = source.height * scale;
  c.drawImage(source, (1280 - w) / 2, (540 - h) / 2, w, h);
  c.fillStyle = cardPalette().text;
  for (const row of rows) {
    c.font = row.font;
    c.fillText(row.text, 32, row.y);
  }
  return out;
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
