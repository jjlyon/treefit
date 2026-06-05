import { generateTree } from '../lib/generator';
import type { TreeParams } from '../lib/types';

export interface TreeWorkerRequest {
  requestId: number;
  params: TreeParams;
}

self.onmessage = (event: MessageEvent<TreeWorkerRequest>) => {
  const { requestId, params } = event.data;
  const model = generateTree(params);
  self.postMessage({ requestId, model });
};
