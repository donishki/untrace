// Each task owns a worker. Termination stops decode/encode and suppresses stale results.
export function processImage(task, file, options = {}, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return; }
    const worker = new Worker(new URL('./image-worker.js', import.meta.url), { type: 'module' });
    const finish = (callback, value) => {
      worker.terminate();
      signal?.removeEventListener('abort', cancel);
      callback(value);
    };
    const cancel = () => finish(reject, new DOMException('Cancelled', 'AbortError'));
    signal?.addEventListener('abort', cancel, { once: true });
    worker.onmessage = ({ data }) => data.error ? finish(reject, new Error(data.error)) : finish(resolve, data.value);
    worker.onerror = event => { event.preventDefault(); finish(reject, new Error(event.message || 'Image processing failed.')); };
    worker.postMessage({ task, file, options });
  });
}
