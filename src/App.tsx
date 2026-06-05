import { useCallback, useMemo, useState } from 'react';
import { Controls } from './components/Controls';
import { StatusBar } from './components/StatusBar';
import { SvgPreview } from './components/SvgPreview';
import { defaultParams } from './lib/defaultParams';
import { clamp } from './lib/geometry';
import { downloadSvg } from './lib/svgExport';
import type { TreeParams } from './lib/types';
import { useTreeGeneration } from './hooks/useTreeGeneration';

function normalizeParams(next: TreeParams): TreeParams {
  const maxRadius = next.canvasSize / 2 - 8;
  const maskRadius = clamp(next.maskRadius, 16, maxRadius);
  return { ...next, maskRadius, maskMargin: clamp(next.maskMargin, 0, Math.max(0, maskRadius - 8)) };
}

export default function App() {
  const [params, setParams] = useState<TreeParams>(defaultParams);
  const [version, setVersion] = useState(0);
  const normalized = useMemo(() => normalizeParams(params), [params]);
  const { model, isGenerating } = useTreeGeneration(normalized, version);
  const handleChange = useCallback((next: TreeParams) => setParams(normalizeParams(next)), []);
  const handleRandomizeSeed = useCallback(() => {
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    setParams((current) => ({ ...current, seed: `treefit-${bytes[0].toString(36)}` }));
  }, []);
  const handleRegenerate = useCallback(() => setVersion((current) => current + 1), []);
  const handleReset = useCallback(() => setParams(defaultParams), []);
  const handleExport = useCallback(() => { if (model) downloadSvg(model); }, [model]);

  return <main className="app-shell">
    <Controls params={normalized} onChange={handleChange} onRandomizeSeed={handleRandomizeSeed} onRegenerate={handleRegenerate} onReset={handleReset} onExport={handleExport} />
    <div className="preview-column">
      <SvgPreview model={model} isGenerating={isGenerating} />
      <StatusBar model={model} isGenerating={isGenerating} />
    </div>
  </main>;
}
