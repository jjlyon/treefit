import { useMemo, useState } from 'react';
import { Controls } from './components/Controls';
import { StatusBar } from './components/StatusBar';
import { SvgPreview } from './components/SvgPreview';
import { useTreeGeneration } from './hooks/useTreeGeneration';
import { defaultParams } from './lib/defaultParams';
import { downloadSvg } from './lib/svgExport';
import type { TreeParams } from './lib/types';

function randomSeed(): string {
  return `treefit-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeParams(params: TreeParams): TreeParams {
  const radius = Math.min(params.radius, params.canvasSize / 2 - 8);
  const margin = Math.min(params.margin, Math.max(0, radius - 8));
  return { ...params, radius, margin };
}

export default function App() {
  const [params, setParams] = useState<TreeParams>(defaultParams);
  const [version, setVersion] = useState(0);
  const safeParams = useMemo(() => normalizeParams(params), [params]);
  const { model, isGenerating } = useTreeGeneration(safeParams, version);

  return (
    <main className="app-shell">
      <Controls
        params={safeParams}
        onChange={setParams}
        onRandomizeSeed={() => setParams((current) => ({ ...current, seed: randomSeed() }))}
        onRegenerate={() => setVersion((current) => current + 1)}
        onReset={() => setParams(defaultParams)}
        onExport={() => model && downloadSvg(model)}
      />
      <section className="preview-column">
        <SvgPreview model={model} isGenerating={isGenerating} />
        <StatusBar model={model} isGenerating={isGenerating} />
      </section>
    </main>
  );
}
