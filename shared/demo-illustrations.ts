/** Public illustration IDs only; catalog/draft fixtures stay in the bootstrap. */
export const demoIllustrationIds = [
  'demo-poster-v1-01',
  'demo-poster-v1-02',
  'demo-poster-v1-03',
  'demo-poster-v1-04',
  'demo-poster-v1-05',
  'demo-poster-v1-06',
  'demo-poster-v1-07',
] as const;
export function isDemoIllustration(id: unknown): id is string {
  return (
    typeof id === 'string' && demoIllustrationIds.some((value) => value === id)
  );
}
