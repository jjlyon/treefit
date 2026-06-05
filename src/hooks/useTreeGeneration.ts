import { useEffect, useRef, useState } from 'react';
import { generateTree } from '../lib/generator';
import type { TreeModel, TreeParams } from '../lib/types';

interface GenerationState {
  model?: TreeModel;
  isGenerating: boolean;
}

export function useTreeGeneration(params: TreeParams, version: number): GenerationState {
  const [state, setState] = useState<GenerationState>({ isGenerating: true });
  const requestRef = useRef(0);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    requestRef.current += 1;
    const requestId = requestRef.current;
    setState((current) => ({ ...current, isGenerating: true }));

    const timer = window.setTimeout(() => {
      if (!workerRef.current && typeof Worker !== 'undefined') {
        workerRef.current = new Worker(new URL('../workers/treeWorker.ts', import.meta.url), { type: 'module' });
      }

      const worker = workerRef.current;
      if (!worker) {
        window.setTimeout(() => {
          if (requestRef.current !== requestId) return;
          const model = generateTree(params);
          if (requestRef.current === requestId) setState({ model, isGenerating: false });
        }, 0);
        return;
      }

      worker.onmessage = (event: MessageEvent<{ requestId: number; model: TreeModel }>) => {
        if (event.data.requestId !== requestRef.current) return;
        setState({ model: event.data.model, isGenerating: false });
      };
      worker.onerror = () => {
        if (requestRef.current !== requestId) return;
        const model = generateTree(params);
        setState({ model, isGenerating: false });
      };
      worker.postMessage({ requestId, params });
    }, 140);

    return () => window.clearTimeout(timer);
  }, [params, version]);

  useEffect(() => () => workerRef.current?.terminate(), []);

  return state;
}
