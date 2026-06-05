export interface SilhouettePreset {
  name: string;
  label: string;
  path: string;
}

export const silhouettePresets: SilhouettePreset[] = [
  { name: 'standing-person', label: 'Standing person', path: 'M 0 -100 C 18 -100 30 -88 30 -70 C 30 -55 20 -45 10 -42 L 28 -36 L 44 -12 L 30 0 L 18 -18 L 18 86 L 4 100 L -4 100 L -18 86 L -18 -18 L -30 0 L -44 -12 L -28 -36 L -10 -42 C -20 -45 -30 -55 -30 -70 C -30 -88 -18 -100 0 -100 Z' },
  { name: 'head-profile', label: 'Head profile', path: 'M -36 -82 C -6 -112 48 -90 58 -48 C 78 -40 70 -20 56 -17 C 55 -2 44 4 48 18 C 34 30 22 31 10 26 L 14 56 C -8 78 -46 72 -58 48 L -50 14 C -78 -8 -74 -50 -36 -82 Z' },
  { name: 'cat-sitting', label: 'Cat sitting', path: 'M -55 80 C -88 42 -72 -22 -34 -34 L -44 -78 L -10 -50 C 0 -58 14 -58 25 -50 L 58 -78 L 48 -30 C 82 -6 82 50 45 82 C 64 72 82 78 86 96 L -82 96 C -76 78 -58 72 -40 82 C -52 50 -42 16 -12 12 C -10 45 -18 66 -55 80 Z' },
  { name: 'tree-outline', label: 'Tree outline', path: 'M 0 -108 L 28 -66 L 16 -66 L 52 -20 L 34 -20 L 76 38 L 28 38 L 28 96 L -28 96 L -28 38 L -76 38 L -34 -20 L -52 -20 L -16 -66 L -28 -66 Z' },
  { name: 'bird', label: 'Bird in flight', path: 'M -112 -8 C -76 -38 -34 -42 -4 -18 C 26 -44 72 -48 112 -20 C 78 -14 52 -2 35 18 C 20 35 -12 36 -28 18 C -48 -4 -76 -6 -112 -8 Z' },
];

export const defaultSilhouettePreset = 'standing-person';

export function getPresetPath(name: string): string | undefined {
  return silhouettePresets.find((preset) => preset.name === name)?.path;
}
