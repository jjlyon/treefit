import { generateTree } from '../lib/generator';
import type { TreeParams } from '../lib/types';

interface TreeWorkerRequest {
  requestId: number;
  params: TreeParams;
}

self.addEventListener('message', (event: MessageEvent<TreeWorkerRequest>) => {
  const model = generateTree(event.data.params);
  self.postMessage({ requestId: event.data.requestId, model });
});
