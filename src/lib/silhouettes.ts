export interface SilhouettePreset { name: string; path: string; }

export const silhouettePresets: SilhouettePreset[] = [
  { name: 'Standing person', path: 'M 0 -360 L 45 -300 L 65 -210 L 42 -70 L 88 300 L 38 340 L 0 90 L -38 340 L -88 300 L -42 -70 L -65 -210 L -45 -300 Z' },
  { name: 'Sitting person', path: 'M 0 -350 L 58 -300 L 76 -185 L 28 -90 L 145 50 L 118 108 L 25 22 L -45 205 L -110 185 L -58 10 L -118 70 L -155 25 L -58 -92 L -76 -185 L -58 -300 Z' },
  { name: 'Head profile', path: 'M -65 -330 C 70 -360 160 -245 118 -125 C 180 -95 150 -54 105 -55 C 86 35 45 118 75 210 C 5 245 -95 230 -142 172 C -96 78 -145 15 -130 -85 C -155 -188 -115 -292 -65 -330 Z' },
  { name: 'Cat', path: 'M -175 -155 L -115 -310 L -45 -195 C -10 -215 40 -215 75 -195 L 145 -310 L 205 -155 C 248 -75 240 78 172 178 C 90 302 -98 302 -180 178 C -248 78 -238 -75 -175 -155 Z' },
  { name: 'Dog', path: 'M -175 -250 C -90 -335 88 -335 175 -250 L 250 -295 C 285 -188 240 -115 185 -70 C 195 92 122 245 0 268 C -122 245 -195 92 -185 -70 C -240 -115 -285 -188 -250 -295 Z' },
];

export function getSilhouettePath(name: string, customPath: string): string {
  if (name === 'custom') return customPath;
  return silhouettePresets.find((preset) => preset.name === name)?.path ?? silhouettePresets[0].path;
}
