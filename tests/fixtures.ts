import { expect, type Page } from '@playwright/test';
export function gaussianFixture() {
  const props = [
    'x',
    'y',
    'z',
    'f_dc_0',
    'f_dc_1',
    'f_dc_2',
    'opacity',
    'scale_0',
    'scale_1',
    'scale_2',
    'rot_0',
    'rot_1',
    'rot_2',
    'rot_3',
  ];
  const header = Buffer.from(
    `ply\nformat binary_little_endian 1.0\nelement vertex 100\n${props.map((p) => `property float ${p}`).join('\n')}\nend_header\n`,
  );
  const body = Buffer.alloc(100 * props.length * 4);
  for (let i = 0; i < 100; i++) {
    [
      (i % 10) / 5 - 1,
      Math.floor(i / 10) / 5 - 1,
      0,
      1,
      0,
      0,
      5,
      -2.5,
      -2.5,
      -2.5,
      1,
      0,
      0,
      0,
    ].forEach((v, j) => body.writeFloatLE(v, (i * props.length + j) * 4));
  }
  return Buffer.concat([header, body]);
}

export async function editorStep(page: Page, step: number) {
  const button = page.getByRole('button', { name: new RegExp(`^${step}\\. `) });
  const compact = page.getByRole('combobox', {
    name: 'Paso del editor',
    exact: true,
  });
  // Layout switches between tabs and a select after viewport/container resize.
  await expect(button.or(compact)).toBeVisible();
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await button.isVisible()) {
      try {
        await button.click({ timeout: 3000 });
        return;
      } catch (error) {
        if (!(await compact.isVisible())) throw error;
      }
    }
    if (await compact.isVisible()) {
      try {
        await compact.selectOption(String(step), { timeout: 3000 });
        return;
      } catch (error) {
        if (!(await button.isVisible())) throw error;
      }
    }
  }
  throw new Error('No se estabilizó la navegación del editor');
}
