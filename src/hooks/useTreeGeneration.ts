import { useEffect, useRef, useState } from 'react';
import { generateTree } from '../lib/generator';
import type { TreeModel, TreeParams } from '../lib/types';

interface WorkerResponse {
  requestId: number;
  model: TreeModel;
}

export function useTreeGeneration(params: TreeParams, version: number): { model?: TreeModel; isGenerating: boolean } {
  const [model, setModel] = useState<TreeModel>();
  const [isGenerating, setIsGenerating] = useState(true);
  const requestIdRef = useRef(0);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (typeof Worker !== 'undefined' && !workerRef.current) {
      workerRef.current = new Worker(new URL('../workers/treeWorker.ts', import.meta.url), { type: 'module' });
    }
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsGenerating(true);
    const timer = window.setTimeout(() => {
      const worker = workerRef.current;
      if (worker) {
        const handleMessage = (event: MessageEvent<WorkerResponse>): void => {
          if (event.data.requestId === requestIdRef.current) {
            setModel(event.data.model);
            setIsGenerating(false);
          }
          worker.removeEventListener('message', handleMessage);
        };
        worker.addEventListener('message', handleMessage);
        worker.postMessage({ requestId, params });
      } else {
        window.setTimeout(() => {
          if (requestId === requestIdRef.current) {
            setModel(generateTree(params));
            setIsGenerating(false);
          }
        }, 0);
      }
    }, 140);
    return () => window.clearTimeout(timer);
  }, [params, version]);

  return { model, isGenerating };
}
