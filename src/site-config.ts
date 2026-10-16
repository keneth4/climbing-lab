export type SiteEditorial = {
  location?: { text: string; mapUrl?: string };
  hours?: string;
  services?: string[];
  contacts?: { label: string; url: string }[];
  hero?: { src: string; alt: string };
  seo?: { title?: string; description?: string };
};
export type GymSiteConfig = {
  version: 1 | 2;
  brand: {
    name: string;
    subtitle: string;
    attribution: string;
    defaultTheme: 'default' | 'warm';
  };
  content: {
    headline: string;
    description: string;
    exampleNotice: string;
    faq: { question: string; answer: string }[];
  };
  editorial?: SiteEditorial;
};
export const editorialAssets: ReadonlySet<string> = new Set(['/favicon.svg']);
export function normalizeSiteConfig(
  input: GymSiteConfig,
): GymSiteConfig & { version: 2; editorial: SiteEditorial } {
  const text = (v: unknown, max = 1000): string => {
    if (typeof v !== 'string' || !v.trim() || v.length > max)
      throw new Error('Texto editorial inválido.');
    return v;
  };
  if (![1, 2].includes(input.version))
    throw new Error('Versión editorial no compatible.');
  for (const v of [
    input.brand.name,
    input.brand.subtitle,
    input.brand.attribution,
    input.content.headline,
    input.content.description,
    input.content.exampleNotice,
  ])
    text(v);
  if (!['default', 'warm'].includes(input.brand.defaultTheme))
    throw new Error('Tema inválido.');
  for (const faq of input.content.faq) {
    text(faq.question);
    text(faq.answer);
  }
  const e = input.editorial ?? {};
  if (
    Object.keys(e).some(
      (k) =>
        !['location', 'hours', 'services', 'contacts', 'hero', 'seo'].includes(
          k,
        ),
    )
  )
    throw new Error('Campo editorial desconocido.');
  const url = (v: string, contact = false) => {
    const u = new URL(text(v));
    if (
      u.username ||
      u.password ||
      !(
        u.protocol === 'https:' ||
        (contact && ['tel:', 'mailto:'].includes(u.protocol))
      )
    )
      throw new Error('Enlace editorial inválido.');
    return v;
  };
  if (e.location) {
    text(e.location.text);
    if (e.location.mapUrl) url(e.location.mapUrl);
  }
  if (e.hours) text(e.hours);
  if (e.services) {
    if (!Array.isArray(e.services) || e.services.length > 30)
      throw new Error('Servicios inválidos.');
    e.services.forEach((v) => text(v));
  }
  if (e.contacts) {
    if (!Array.isArray(e.contacts) || e.contacts.length > 20)
      throw new Error('Contactos inválidos.');
    for (const c of e.contacts) {
      text(c.label, 80);
      url(c.url, true);
    }
  }
  if (e.hero) {
    if (!editorialAssets.has(e.hero.src))
      throw new Error('Asset editorial no registrado.');
    text(e.hero.alt, 200);
  }
  if (e.seo) {
    if (e.seo.title) text(e.seo.title, 100);
    if (e.seo.description) text(e.seo.description, 300);
  }
  return { ...input, version: 2, editorial: e };
}
