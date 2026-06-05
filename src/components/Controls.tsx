import { controlLimits, defaultParams } from '../lib/defaultParams';
import { silhouettePresets } from '../lib/silhouettes';
import type { MaskShape, TreeParams } from '../lib/types';

interface ControlsProps {
  params: TreeParams;
  onChange: (params: TreeParams) => void;
  onRandomizeSeed: () => void;
  onRegenerate: () => void;
  onReset: () => void;
  onExport: () => void;
}

type NumericKey = keyof typeof controlLimits;

function labelize(key: string): string { return key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase()); }

export function Controls({ params, onChange, onRandomizeSeed, onRegenerate, onReset, onExport }: ControlsProps) {
  const setParam = <K extends keyof TreeParams>(key: K, value: TreeParams[K]) => onChange({ ...params, [key]: value });
  const numberControl = (key: NumericKey) => {
    const limits = controlLimits[key]; const value = params[key];
    return (
      <label className="control" key={key}>
        <span>{labelize(key)} <strong>{typeof value === 'number' ? value.toFixed(limits.step < 1 ? 2 : 0) : value}</strong></span>
        <input type="range" min={limits.min} max={limits.max} step={limits.step} value={value} onChange={(event) => setParam(key, Number(event.target.value) as TreeParams[typeof key])} />
      </label>
    );
  };

  return (
    <aside className="controls-panel" aria-label="TreeFit controls">
      <div className="brand"><div><p className="eyebrow">Procedural CNC SVG</p><h1>TreeFit</h1></div><button type="button" onClick={onReset}>Reset</button></div>

      <section className="control-section">
        <h2>Seed</h2>
        <label className="control"><span>Seed text / number</span><input type="text" value={params.seed} onChange={(event) => setParam('seed', event.target.value)} /></label>
        <div className="button-row"><button type="button" onClick={onRandomizeSeed}>Randomize seed</button><button type="button" onClick={onRegenerate}>Regenerate</button></div>
      </section>

      <section className="control-section grid-controls">
        <h2>Mask</h2>
        <label className="control"><span>Mask Shape</span><select value={params.maskShape} onChange={(event) => setParam('maskShape', event.target.value as MaskShape)}><option value="circle">Circle</option><option value="star">Star</option><option value="heart">Heart</option><option value="silhouette">Silhouette</option></select></label>
        {(['canvasSize', 'maskRadius', 'maskMargin'] as NumericKey[]).map(numberControl)}
        <label><input type="checkbox" checked={params.showMask} onChange={(event) => setParam('showMask', event.target.checked)} /> Show Mask</label>
        {params.maskShape === 'star' && (<>{numberControl('starPoints')}{numberControl('starInnerRatio')}</>)}
        {params.maskShape === 'silhouette' && (<>
          <label className="control"><span>Preset</span><select value={params.silhouettePreset} onChange={(event) => setParam('silhouettePreset', event.target.value)}>{silhouettePresets.map((preset) => <option key={preset.name} value={preset.name}>{preset.name}</option>)}<option value="custom">Custom path</option></select></label>
          {params.silhouettePreset === 'custom' && <label className="control"><span>Custom SVG path</span><textarea rows={4} value={params.silhouettePath} onChange={(event) => setParam('silhouettePath', event.target.value)} /></label>}
        </>)}
      </section>

      <section className="control-section grid-controls"><h2>Growth</h2>{(['attractorCount', 'influenceRadius', 'killRadius', 'stepSize', 'jitter', 'trunkLength', 'rootBalance'] as NumericKey[]).map(numberControl)}</section>

      <section className="control-section grid-controls">
        <h2>Style & CNC constraints</h2>
        {(['trunkThickness', 'minThickness', 'curveSmoothness', 'minFeatureSize'] as NumericKey[]).map(numberControl)}
        <label><input type="checkbox" checked={params.showLeaves} onChange={(event) => setParam('showLeaves', event.target.checked)} /> Show Leaves</label>
        {numberControl('leafSize')}
      </section>

      <div className="button-row sticky-actions"><button type="button" className="primary" onClick={onExport}>Export SVG</button><button type="button" onClick={() => onChange(defaultParams)}>Defaults</button></div>
    </aside>
  );
}
