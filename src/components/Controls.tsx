import { controlLimits } from '../lib/defaultParams';
import { getPresetPath, silhouettePresets } from '../lib/silhouettes';
import type { TreeParams } from '../lib/types';

type NumericParam = keyof typeof controlLimits;

interface ControlsProps {
  params: TreeParams;
  onChange: (params: TreeParams) => void;
  onRandomizeSeed: () => void;
  onRegenerate: () => void;
  onReset: () => void;
  onExport: () => void;
}

const labels: Record<NumericParam, string> = {
  canvasSize: 'Canvas size',
  maskRadius: 'Mask radius',
  maskMargin: 'Mask margin',
  starPoints: 'Star points',
  starInnerRatio: 'Inner ratio',
  attractorCount: 'Attractors',
  influenceRadius: 'Influence radius',
  killRadius: 'Kill radius',
  stepSize: 'Step size',
  jitter: 'Jitter',
  trunkLength: 'Trunk length',
  rootBalance: 'Root balance',
  trunkThickness: 'Trunk thickness',
  minThickness: 'Min thickness',
  curveSmoothness: 'Curve smoothness',
  leafSize: 'Leaf size',
  minFeatureSize: 'Min feature size',
};

export function Controls({ params, onChange, onRandomizeSeed, onRegenerate, onReset, onExport }: ControlsProps) {
  const update = <K extends keyof TreeParams>(key: K, value: TreeParams[K]): void => onChange({ ...params, [key]: value });
  const numberControl = (key: NumericParam) => {
    const limit = controlLimits[key];
    return <label className="control" key={key}>
      <span>{labels[key]} <strong>{params[key]}</strong></span>
      <input type="range" min={limit.min} max={limit.max} step={limit.step} value={params[key]} onChange={(event) => update(key, Number(event.currentTarget.value) as TreeParams[typeof key])} />
    </label>;
  };
  const presetOptions = [...silhouettePresets, { name: 'custom', label: 'Custom path', path: '' }];
  return <aside className="controls-panel">
    <div className="brand">
      <div><p>TreeFit</p><span>Procedural tree-of-life SVGs</span></div>
      <button type="button" onClick={onReset}>Reset</button>
    </div>

    <section className="control-section">
      <h2>Seed</h2>
      <label className="control text-control"><span>Seed</span><input value={params.seed} onChange={(event) => update('seed', event.currentTarget.value)} /></label>
      <div className="button-row"><button type="button" onClick={onRandomizeSeed}>Randomize</button><button type="button" onClick={onRegenerate}>Regenerate</button></div>
    </section>

    <section className="control-section">
      <h2>Mask</h2>
      <label className="control"><span>Shape</span><select value={params.maskShape} onChange={(event) => update('maskShape', event.currentTarget.value as TreeParams['maskShape'])}><option value="circle">Circle</option><option value="star">Star</option><option value="heart">Heart</option><option value="silhouette">Silhouette</option></select></label>
      {numberControl('canvasSize')}{numberControl('maskRadius')}{numberControl('maskMargin')}
      <label className="check-control"><input type="checkbox" checked={params.showMask} onChange={(event) => update('showMask', event.currentTarget.checked)} /> Show mask guide</label>
      {params.maskShape === 'star' ? <>{numberControl('starPoints')}{numberControl('starInnerRatio')}</> : null}
      {params.maskShape === 'silhouette' ? <>
        <label className="control"><span>Preset</span><select value={params.silhouettePreset} onChange={(event) => {
          const name = event.currentTarget.value;
          onChange({ ...params, silhouettePreset: name, silhouettePath: name === 'custom' ? params.silhouettePath : getPresetPath(name) ?? '' });
        }}>{presetOptions.map((preset) => <option value={preset.name} key={preset.name}>{preset.label}</option>)}</select></label>
        {params.silhouettePreset === 'custom' ? <label className="control text-control"><span>SVG path</span><textarea value={params.silhouettePath} onChange={(event) => update('silhouettePath', event.currentTarget.value)} rows={4} /></label> : null}
      </> : null}
    </section>

    <section className="control-section"><h2>Growth</h2>{(['attractorCount', 'influenceRadius', 'killRadius', 'stepSize', 'jitter', 'trunkLength', 'rootBalance'] as const).map(numberControl)}</section>
    <section className="control-section"><h2>Style</h2>{(['trunkThickness', 'minThickness', 'curveSmoothness', 'minFeatureSize'] as const).map(numberControl)}<label className="check-control"><input type="checkbox" checked={params.showLeaves} onChange={(event) => update('showLeaves', event.currentTarget.checked)} /> Show leaves</label>{params.showLeaves ? numberControl('leafSize') : null}</section>

    <div className="sticky-actions"><button type="button" className="primary" onClick={onExport}>Export SVG</button><button type="button" onClick={onReset}>Defaults</button></div>
  </aside>;
}
