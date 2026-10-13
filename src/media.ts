export type CardInfo = {
  title: string;
  grade: string;
  gym: string;
  personal?: { name: string; result: string; attempts: number };
};
export function renderCard(
  source: HTMLCanvasElement,
  info: CardInfo,
  destination?: HTMLCanvasElement,
): HTMLCanvasElement {
  const out = destination || document.createElement('canvas');
  if (out.width !== 1280) out.width = 1280;
  if (out.height !== 720) out.height = 720;
  const c = out.getContext('2d')!;
  c.fillStyle = '#172c3e';
  c.fillRect(0, 0, out.width, out.height);
  const scale = Math.min(1280 / source.width, 540 / source.height);
  const w = source.width * scale,
    h = source.height * scale;
  c.drawImage(source, (1280 - w) / 2, (540 - h) / 2, w, h);
  c.fillStyle = 'white';
  c.font = 'bold 30px system-ui';
  c.fillText(`${info.title} · ${info.grade}`.slice(0, 85), 32, 583, 1216);
  c.font = '23px system-ui';
  c.fillText(`${info.gym} · Creativivid.com`.slice(0, 100), 32, 625, 1216);
  if (info.personal)
    c.fillText(
      `${info.personal.name} · ${info.personal.result} · ${info.personal.attempts} intentos`.slice(
        0,
        120,
      ),
      32,
      671,
      1216,
    );
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
