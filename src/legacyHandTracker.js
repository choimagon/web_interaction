let scriptPromise;
let initialization = Promise.resolve();

function loadHands(assetRoot) {
  if (window.Hands) return Promise.resolve(window.Hands);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `${assetRoot}hands.js`;
      script.onload = () => window.Hands ? resolve(window.Hands) : reject(new Error('MediaPipe Hands unavailable'));
      script.onerror = () => { script.remove(); reject(new Error('MediaPipe Hands load failed')); };
      document.head.appendChild(script);
    }).catch((error) => { scriptPromise = null; throw error; });
  }
  return scriptPromise;
}

export function createLegacyHandTracker(assetRoot, onResult) {
  let hands;
  let closed = false;
  let frameTimestamp = 0;
  let pending = Promise.resolve();

  return {
    initialize() {
      // Legacy MediaPipe uses global loader functions. Serialize initialization
      // when a camera is switched off and on while the scripts are loading.
      const startup = initialization.catch(() => {}).then(async () => {
        const Hands = await loadHands(assetRoot);
        if (closed) return;
        hands = new Hands({ locateFile: (file) => `${assetRoot}${file}` });
        hands.setOptions({
          selfieMode: false,
          maxNumHands: 1,
          modelComplexity: 0,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });
        hands.onResults((result) => {
          if (!closed) onResult({ landmarks: result.multiHandLandmarks?.[0] ?? null, timestamp: frameTimestamp });
        });
        await hands.initialize();
      });
      initialization = startup;
      pending = startup;
      return startup;
    },
    send(video, timestamp) {
      if (closed) return Promise.resolve();
      frameTimestamp = timestamp;
      pending = hands.send({ image: video });
      return pending;
    },
    close() {
      if (closed) return;
      closed = true;
      // Do not delete a graph while its asynchronous send/init still uses it.
      pending.catch(() => {}).then(() => hands?.close()).catch(() => {});
    },
  };
}
