import type { TreeModel } from '../lib/types';
import { modelToSvgInner, viewBoxForParams } from '../lib/renderSvg';

interface SvgPreviewProps {
  model?: TreeModel;
  isGenerating: boolean;
}

export function SvgPreview({ model, isGenerating }: SvgPreviewProps) {
  if (!model) {
    return <div className="preview-empty">Preparing generator…</div>;
  }

  return (
    <div className="preview-card">
      {isGenerating && <div className="generating-badge">Generating…</div>}
      <svg
        className="tree-svg"
        viewBox={viewBoxForParams(model.params)}
        width={model.params.canvasSize}
        height={model.params.canvasSize}
        role="img"
        aria-label="Generated TreeFit tree of life SVG preview"
        dangerouslySetInnerHTML={{ __html: modelToSvgInner(model) }}
      />
    </div>
  );
}
