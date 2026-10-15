import { normalizeSiteConfig, type GymSiteConfig } from './site-config';
export type { GymSiteConfig } from './site-config';
export const site = normalizeSiteConfig({
  version: 2,
  brand: {
    name: 'Climbing Lab',
    subtitle: 'Gimnasio de ejemplo',
    attribution: 'Climbing Lab · gimnasio de ejemplo',
    defaultTheme: 'default',
  },
  content: {
    headline: 'Encuentra tu siguiente reto.',
    description:
      'Explora rutas por grado y sector, reconoce sus agarres y lleva un registro privado de tu progreso.',
    exampleNotice:
      'Sitio ilustrativo de un gimnasio ficticio. No ofrece reservas ni información de un establecimiento real.',
    faq: [
      {
        question: '¿Necesito una cuenta para ver las rutas?',
        answer:
          'No. Puedes consultar el catálogo, las reglas, la beta opcional y los enlaces sin iniciar sesión. Para guardar actividad, proyectos o reportes necesitas una cuenta.',
      },
      {
        question: '¿Tengo que cargar el visor 3D?',
        answer:
          'No. La ficha conserva nombre, grado, sector y reglas. Cuando hay una imagen publicada puedes reconocer la ruta antes de explorar en 3D.',
      },
      {
        question: '¿Quién puede ver mi actividad?',
        answer:
          'Tu bitácora es privada. Al descargar una tarjeta eliges si incluye nombre, fecha, intentos y notas; esos campos empiezan desactivados.',
      },
      {
        question: '¿Qué hago si encuentro un agarre suelto?',
        answer:
          'En un gimnasio real, avisa directamente al staff y sigue sus indicaciones. El reporte en el sitio no sustituye ese aviso.',
      },
      {
        question: '¿Dónde está el gimnasio y cuáles son sus horarios?',
        answer:
          'Este gimnasio es ficticio. Dirección, horarios, precios y contacto se publicarán únicamente con información confirmada de un establecimiento real.',
      },
    ],
  },
} satisfies GymSiteConfig);
export const filterKeys = [
  'buscar',
  'grado',
  'sector',
  'zona',
  'escala',
  'desde',
  'hasta',
  'orden',
  'retiradas',
];
export function viewFromUrl(url: URL): string {
  if (url.pathname.startsWith('/auth/')) return 'Cuenta';
  if (url.searchParams.has('ruta')) return 'Catálogo';
  const view = url.searchParams.get('vista');
  if (view)
    return view === 'Rutas'
      ? 'Catálogo'
      : view === 'Mi escalada'
        ? 'Bitácora'
        : view;
  return filterKeys.some((k) => url.searchParams.has(k))
    ? 'Catálogo'
    : 'Inicio';
}
export function pageTitle(view: string, route?: string): string {
  const friendly: Record<string, string> = {
    Bitácora: 'Mi actividad',
    Cuenta: 'Cuenta y privacidad',
  };
  view = friendly[view] || view;
  return `${view === 'Catálogo' ? route || 'Rutas' : view === 'Staff' ? 'Panel del staff' : view === 'Bitácora' ? 'Mi actividad' : view === 'Cuenta' ? 'Cuenta y privacidad' : view} · ${site.brand.name} — ${site.brand.subtitle.toLowerCase()}`;
}
export function cardPalette() {
  const style = getComputedStyle(document.documentElement);
  return {
    background: style.getPropertyValue('--ink').trim() || '#172c3e',
    text: '#ffffff',
  };
}
