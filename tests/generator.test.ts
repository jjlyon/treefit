import { describe, expect, it } from 'vitest';
import { defaultParams } from '../src/lib/defaultParams';
import { generateTree } from '../src/lib/generator';
import { CircleMask, HeartMask, SilhouetteMask, StarMask, createMask } from '../src/lib/masks';
import { modelToSvg } from '../src/lib/renderSvg';
import { createSvgText } from '../src/lib/svgExport';
import { taperSegment } from '../src/lib/taperOutline';
import type { TreeNode } from '../src/lib/types';

function comparableNodes(nodes: TreeNode[]) {
  return nodes.map(({ id, kind, position, parentId, childIds, depth, thickness }) => ({ id, kind, position, parentId, childIds, depth, thickness }));
}

function allSegments(model = generateTree(defaultParams)) {
  return model.chains.flatMap((chain) => chain.segments);
}

describe('TreeFit v2 generator', () => {
  it('same seed and params produce identical nodes and thicknesses', () => {
    expect(comparableNodes(generateTree(defaultParams).nodes)).toEqual(comparableNodes(generateTree(defaultParams).nodes));
  });

  it('different seed changes tree nodes', () => {
    expect(comparableNodes(generateTree(defaultParams).nodes)).not.toEqual(comparableNodes(generateTree({ ...defaultParams, seed: 'different-seed' }).nodes));
  });

  it('all generated nodes are inside every mask shape', () => {
    const variants = [
      { ...defaultParams, maskShape: 'circle' as const },
      { ...defaultParams, maskShape: 'star' as const },
      { ...defaultParams, maskShape: 'heart' as const },
      { ...defaultParams, maskShape: 'silhouette' as const },
    ];
    for (const params of variants) {
      const model = generateTree({ ...params, attractorCount: 250 });
      const mask = createMask(params);
      for (const node of model.nodes) expect(mask.contains(node.position)).toBe(true);
    }
  });

  it('attractor density increase generally increases node count', () => {
    const low = generateTree({ ...defaultParams, attractorCount: 250, seed: 'density-test' });
    const high = generateTree({ ...defaultParams, attractorCount: 1000, seed: 'density-test' });
    expect(high.stats.nodeCount).toBeGreaterThan(low.stats.nodeCount);
  });

  it('generated SVG contains named groups', () => {
    const svg = modelToSvg(generateTree(defaultParams));
    for (const group of ['mask-outline', 'trunk', 'branches', 'roots', 'leaves']) expect(svg).toContain(`id="${group}"`);
  });

  it('no output path contains NaN coordinates', () => {
    const svg = modelToSvg(generateTree({ ...defaultParams, attractorCount: 1000, rootBalance: 0.5 }));
    expect(svg).not.toMatch(/NaN|Infinity/);
    for (const segment of allSegments(generateTree(defaultParams))) {
      for (const point of [segment.start, segment.c1, segment.c2, segment.end]) {
        expect(Number.isNaN(point.x)).toBe(false);
        expect(Number.isNaN(point.y)).toBe(false);
      }
    }
  });

  it('export function returns valid SVG text', () => {
    const svg = createSvgText(generateTree(defaultParams));
    expect(svg).toMatch(/^<\?xml/);
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox=');
    expect(svg).toContain('TreeFit parameters');
    expect(svg.trim().endsWith('</svg>')).toBe(true);
  });

  it('tapered paths are closed with M and Z', () => {
    const model = generateTree(defaultParams);
    for (const segment of allSegments(model)) {
      const d = taperSegment(segment.start, segment.c1, segment.c2, segment.end, segment.startThickness, segment.endThickness, model.params.minFeatureSize).trim();
      expect(d.startsWith('M ')).toBe(true);
      expect(d.endsWith('Z')).toBe(true);
    }
  });

  it('mask shapes contain interior points and reject exterior points', () => {
    const masks = [new CircleMask(100), new StarMask(100, 5, 0.45), new HeartMask(100), new SilhouetteMask(100, defaultParams.silhouettePath)];
    for (const mask of masks) {
      expect(mask.contains({ x: 0, y: 0 })).toBe(true);
      expect(mask.contains({ x: 1000, y: 1000 })).toBe(false);
    }
  });

  it('root balance 0 produces no root nodes', () => {
    const model = generateTree({ ...defaultParams, rootBalance: 0 });
    expect(model.nodes.some((node) => node.kind === 'root')).toBe(false);
  });
});
