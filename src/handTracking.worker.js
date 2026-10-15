import { HandLandmarker } from '@mediapipe/tasks-vision';
import wasmLoaderUrl from '@mediapipe/tasks-vision/vision_wasm_module_internal.js?url';
import wasmBinaryUrl from '@mediapipe/tasks-vision/vision_wasm_module_internal.wasm?url';

let detector;

// A failed GPU initialization may retry the same cached ES module on CPU.
// Restore its factory on every import, including the retry.
self.import = async (url) => {
  const module = await import(/* @vite-ignore */ url);
  self.ModuleFactory = module.default;
};

self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      const fileset = {
        wasmLoaderPath: new URL(wasmLoaderUrl, self.location.origin).href,
        wasmBinaryPath: new URL(wasmBinaryUrl, self.location.origin).href,
      };
      const options = {
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
      };
      let delegate = 'GPU';
      try {
        detector = await HandLandmarker.createFromOptions(fileset, {
          ...options,
          baseOptions: { modelAssetPath: data.modelUrl, delegate },
          canvas: new OffscreenCanvas(1, 1),
        });
      } catch {
        delegate = 'CPU';
        detector = await HandLandmarker.createFromOptions(fileset, {
          ...options,
          baseOptions: { modelAssetPath: data.modelUrl, delegate },
          canvas: new OffscreenCanvas(1, 1),
        });
      }
      self.postMessage({ type: 'ready', delegate });
    } catch {
      self.postMessage({ type: 'error' });
    }
    return;
  }
  if (data.type === 'frame') {
    try {
      const result = detector.detectForVideo(data.bitmap, data.timestamp);
      self.postMessage({ type: 'result', landmarks: result.landmarks[0] ?? null, timestamp: data.timestamp });
    } catch {
      self.postMessage({ type: 'error' });
    } finally {
      data.bitmap.close();
    }
  }
};
