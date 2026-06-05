import { describe, expect, it } from 'vitest';
import { defaultParams } from '../src/lib/defaultParams';
import { generateTree } from '../src/lib/generator';
import { CircleMask } from '../src/lib/masks';
import { modelToSvg } from '../src/lib/renderSvg';
import { createSvgText } from '../src/lib/svgExport';
import type { BranchSegment } from '../src/lib/types';

function comparableSegments(segments: BranchSegment[]) {
  return segments.map(({ id, kind, start, c1, c2, end, startThickness, endThickness, depth, parentId, childrenIds }) => ({
    id,
    kind,
    start,
    c1,
    c2,
    end,
    startThickness,
    endThickness,
    depth,
    parentId,
    childrenIds,
  }));
}

describe('TreeFit generator', () => {
  it('same seed and params produce identical segment lists', () => {
    const first = generateTree(defaultParams);
    const second = generateTree(defaultParams);
    expect(comparableSegments(first.segments)).toEqual(comparableSegments(second.segments));
  });

  it('different seed changes segment list', () => {
    const first = generateTree(defaultParams);
    const second = generateTree({ ...defaultParams, seed: 'different-seed' });
    expect(comparableSegments(first.segments)).not.toEqual(comparableSegments(second.segments));
  });

  it('all generated endpoints are inside CircleMask', () => {
    const params = { ...defaultParams, branchDensity: 0.9, rootDensity: 0.9 };
    const model = generateTree(params);
    const mask = new CircleMask(model.params.radius);
    for (const segment of model.segments) {
      expect(mask.contains(segment.start)).toBe(true);
      expect(mask.contains(segment.end)).toBe(true);
      expect(mask.contains(segment.c1)).toBe(true);
      expect(mask.contains(segment.c2)).toBe(true);
    }
  });

  it('density increase generally increases segment count', () => {
    const low = generateTree({ ...defaultParams, branchDensity: 0.1, rootDensity: 0.1, seed: 'density-test' });
    const high = generateTree({ ...defaultParams, branchDensity: 0.9, rootDensity: 0.9, seed: 'density-test' });
    expect(high.stats.segmentCount).toBeGreaterThan(low.stats.segmentCount);
  });

  it('generated SVG contains named groups', () => {
    const svg = modelToSvg(generateTree(defaultParams));
    for (const group of ['mask', 'trunk', 'branches', 'roots', 'bark_detail', 'leaves']) {
      expect(svg).toContain(`id="${group}"`);
    }
  });

  it('no generated segment has NaN coordinates', () => {
    const model = generateTree({ ...defaultParams, branchDensity: 1, rootDensity: 1 });
    for (const segment of model.segments) {
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
});
