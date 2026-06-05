import { describe, expect, it } from 'vitest';
import { defaultParams } from '../src/lib/defaultParams';
import { generateTree } from '../src/lib/generator';
import { createMask, HeartMask, StarMask } from '../src/lib/masks';
import { modelToSvgInner } from '../src/lib/renderSvg';
import { createSvgText } from '../src/lib/svgExport';
import type { TreeParams } from '../src/lib/types';

const fastParams: TreeParams = { ...defaultParams, attractorCount: 260 };
const signature = (params: TreeParams): string => generateTree(params).nodes.map((node) => `${node.kind}:${node.position.x.toFixed(2)},${node.position.y.toFixed(2)}`).join('|');

describe('TreeFit generator', () => {
  it('same seed and params produce identical trees', () => {
    expect(signature(fastParams)).toEqual(signature(fastParams));
  });

  it('different seed produces different tree', () => {
    expect(signature({ ...fastParams, seed: 'alpha' })).not.toEqual(signature({ ...fastParams, seed: 'beta' }));
  });

  it('all nodes are inside CircleMask', () => {
    const model = generateTree({ ...fastParams, maskShape: 'circle' });
    const mask = createMask(model.params);
    expect(model.nodes.every((node) => mask.contains(node.position))).toBe(true);
  });

  it('all nodes are inside StarMask', () => {
    const model = generateTree({ ...fastParams, maskShape: 'star' });
    const mask = createMask(model.params);
    expect(model.nodes.every((node) => mask.contains(node.position))).toBe(true);
  });

  it('all nodes are inside HeartMask', () => {
    const model = generateTree({ ...fastParams, maskShape: 'heart' });
    const mask = createMask(model.params);
    expect(model.nodes.every((node) => mask.contains(node.position))).toBe(true);
  });

  it('more attractors produce more nodes', () => {
    const low = generateTree({ ...defaultParams, attractorCount: 200 }).nodes.length;
    const high = generateTree({ ...defaultParams, attractorCount: 1500 }).nodes.length;
    expect(high).toBeGreaterThan(low);
  });

  it('extracts exactly one continuous trunk chain', () => {
    const model = generateTree(defaultParams);
    const trunkChains = model.chains.filter((chain) => chain.kind === 'trunk');
    const trunkNodes = model.nodes.filter((node) => node.kind === 'trunk');
    expect(trunkChains).toHaveLength(1);
    expect(trunkChains[0].nodeIds).toEqual(trunkNodes.map((node) => node.id));
  });

  it('SVG contains required group ids', () => {
    const svg = modelToSvgInner(generateTree(fastParams));
    for (const id of ['trunk', 'branches', 'roots', 'mask-outline', 'leaves', 'tree', 'joints']) expect(svg).toContain(`id="${id}"`);
  });

  it('renders a joint circle for every interior node', () => {
    const model = generateTree(fastParams);
    const svg = modelToSvgInner(model);
    const jointGroup = svg.match(/<g id="joints">([\s\S]*?)<\/g>/)?.[1] ?? '';
    const circles = [...jointGroup.matchAll(/<circle /g)];
    expect(circles).toHaveLength(model.nodes.filter((node) => node.childIds.length > 0).length);
  });

  it('no NaN in any generated node coordinate', () => {
    const model = generateTree(fastParams);
    expect(model.nodes.every((node) => Number.isFinite(node.position.x) && Number.isFinite(node.position.y))).toBe(true);
  });

  it('createSvgText returns valid SVG', () => {
    const text = createSvgText(generateTree(fastParams));
    expect(text.startsWith('<?xml')).toBe(true);
    expect(text).toContain('<svg');
    expect(text).toContain('viewBox');
    expect(text).toContain('TreeFit params');
    expect(text.trim().endsWith('</svg>')).toBe(true);
  });

  it('all rendered paths are closed (end with Z)', () => {
    const svg = modelToSvgInner(generateTree(fastParams));
    const paths = [...svg.matchAll(/<path d="([^"]+)"/g)].map((match) => match[1]);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.every((path) => path.startsWith('M ') && path.trim().endsWith('Z'))).toBe(true);
  });

  it('StarMask contains interior points and rejects exterior', () => {
    const mask = new StarMask(100, 5, 0.45);
    expect(mask.contains({ x: 0, y: 0 })).toBe(true);
    expect(mask.contains({ x: 180, y: 180 })).toBe(false);
  });

  it('HeartMask contains interior points and rejects exterior', () => {
    const mask = new HeartMask(100);
    expect(mask.contains({ x: 0, y: 0 })).toBe(true);
    expect(mask.contains({ x: 180, y: 180 })).toBe(false);
  });

  it('rootBalance=0 generates no root nodes', () => {
    const model = generateTree({ ...fastParams, rootBalance: 0 });
    expect(model.nodes.some((node) => node.kind === 'root')).toBe(false);
  });

  it('parent thickness >= child thickness at every fork', () => {
    const model = generateTree(fastParams);
    for (const node of model.nodes) {
      for (const childId of node.childIds) expect(node.thickness).toBeGreaterThanOrEqual(model.nodes[childId].thickness);
    }
  });
});
