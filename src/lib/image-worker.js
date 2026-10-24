import { extractMetadata } from './metadata.js';
import { cleanImage } from './clean.js';

self.onmessage = async ({ data: { task, file, options } }) => {
  try {
    if (task === 'scan') {
      self.postMessage({ value: await extractMetadata(file) });
      return;
    }
    const result = await cleanImage(file, options);
    URL.revokeObjectURL(result.url);
    delete result.url;
    if (!result.fallback) result.metadata = await extractMetadata(result.blob);
    self.postMessage({ value: result });
  } catch (error) {
    self.postMessage({ error: error.message || 'Image processing failed.' });
  }
};
