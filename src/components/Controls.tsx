import { controlLimits, defaultParams } from '../lib/defaultParams';
import type { GenerationMode, RenderMode, TreeParams } from '../lib/types';

interface ControlsProps {
  params: TreeParams;
  onChange: (params: TreeParams) => void;
  onRandomizeSeed: () => void;
  onRegenerate: () => void;
  onReset: () => void;
  onExport: () => void;
}

type NumericKey = keyof typeof controlLimits;

function labelize(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
}

export function Controls({ params, onChange, onRandomizeSeed, onRegenerate, onReset, onExport }: ControlsProps) {
  const setParam = <K extends keyof TreeParams>(key: K, value: TreeParams[K]) => onChange({ ...params, [key]: value });
  const numberControl = (key: NumericKey) => {
    const limits = controlLimits[key];
    const value = params[key];
    return (
      <label className="control" key={key}>
        <span>{labelize(key)} <strong>{typeof value === 'number' ? value.toFixed(limits.step < 1 ? 2 : 0) : value}</strong></span>
        <input type="range" min={limits.min} max={limits.max} step={limits.step} value={value} onChange={(event) => setParam(key, Number(event.target.value) as TreeParams[typeof key])} />
      </label>
    );
  };

  return (
    <aside className="controls-panel" aria-label="TreeFit controls">
      <div className="brand">
        <div>
          <p className="eyebrow">Procedural CNC SVG</p>
          <h1>TreeFit</h1>
        </div>
        <button type="button" onClick={onReset}>Reset</button>
      </div>

      <section className="control-section">
        <h2>Seed</h2>
        <label className="control">
          <span>Seed text / number</span>
          <input type="text" value={params.seed} onChange={(event) => setParam('seed', event.target.value)} />
        </label>
        <div className="button-row">
          <button type="button" onClick={onRandomizeSeed}>Randomize seed</button>
          <button type="button" onClick={onRegenerate}>Regenerate</button>
        </div>
      </section>

      <section className="control-section grid-controls">
        <h2>Shape & growth</h2>
        {(['canvasSize', 'radius', 'branchDensity', 'rootDensity', 'maxBranchDepth', 'maxRootDepth', 'branchRootBalance'] as NumericKey[]).map(numberControl)}
      </section>

      <section className="control-section grid-controls">
        <h2>Style & CNC constraints</h2>
        {(['trunkThickness', 'minThickness', 'curvature', 'jitter', 'margin', 'minFeatureSize', 'simplifyTolerance'] as NumericKey[]).map(numberControl)}
        <label className="control">
          <span>Render mode</span>
          <select value={params.renderMode} onChange={(event) => setParam('renderMode', event.target.value as RenderMode)}>
            <option value="stroke">Stroke</option>
            <option value="outline">Outline (stroke fallback)</option>
          </select>
        </label>
        <label className="control">
          <span>Generation mode</span>
          <select value={params.generationMode} onChange={(event) => setParam('generationMode', event.target.value as GenerationMode)}>
            <option value="structured">Structured (default)</option>
            <option value="wild">Wild</option>
          </select>
        </label>
      </section>

      <section className="control-section toggles">
        <h2>Layers</h2>
        {(['showMask', 'showRoots', 'showBarkDetail', 'showLeaves'] as const).map((key) => (
          <label key={key}>
            <input type="checkbox" checked={params[key]} onChange={(event) => setParam(key, event.target.checked)} />
            {labelize(key)}
          </label>
        ))}
      </section>

      <div className="button-row sticky-actions">
        <button type="button" className="primary" onClick={onExport}>Export SVG</button>
        <button type="button" onClick={() => onChange(defaultParams)}>Defaults</button>
      </div>
    </aside>
  );
}
