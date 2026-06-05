import type { TreeModel } from '../lib/types';

interface StatusBarProps { model?: TreeModel; isGenerating: boolean; }

export function StatusBar({ model, isGenerating }: StatusBarProps) {
  return (
    <section className="status-bar" aria-live="polite">
      <div><span className="status-label">State</span><strong>{isGenerating ? 'Generating…' : 'Ready'}</strong></div>
      <div><span className="status-label">Nodes</span><strong>{model?.stats.nodeCount ?? '—'}</strong></div>
      <div><span className="status-label">Chains</span><strong>{model?.stats.chainCount ?? '—'}</strong></div>
      <div><span className="status-label">Paths</span><strong className={(model?.stats.estimatedPathCount ?? 0) > 900 ? 'danger' : ''}>{model?.stats.estimatedPathCount ?? '—'}</strong></div>
      <div><span className="status-label">Generation</span><strong>{model ? `${model.stats.generationMs.toFixed(1)} ms` : '—'}</strong></div>
      {model?.warnings.map((warning) => <p className="warning" key={warning}>{warning}</p>)}
    </section>
  );
}
