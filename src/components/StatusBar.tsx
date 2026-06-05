import type { TreeModel } from '../lib/types';

interface StatusBarProps {
  model?: TreeModel;
  isGenerating: boolean;
}

export function StatusBar({ model, isGenerating }: StatusBarProps) {
  return <footer className="status-bar">
    <span className="chip">State: {isGenerating ? 'Generating' : 'Ready'}</span>
    <span className="chip">Nodes: {model?.stats.nodeCount ?? '—'}</span>
    <span className="chip">Chains: {model?.stats.chainCount ?? '—'}</span>
    <span className="chip">Paths: {model?.stats.estimatedPathCount ?? '—'}</span>
    <span className="chip">Time: {model ? `${model.stats.generationMs.toFixed(1)}ms` : '—'}</span>
    {model?.warnings.map((warning) => <span className="warning" key={warning}>{warning}</span>)}
  </footer>;
}
