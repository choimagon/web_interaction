export function supportsWorkerTracking() {
  if (!window.Worker || !window.OffscreenCanvas || !window.createImageBitmap || !window.WebAssembly) return false;
  // The modern module runtime requires SIMD. Tizen 5.x uses the legacy
  // runtime, which selects its non-SIMD WASM binary automatically.
  try {
    return WebAssembly.validate(new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0,
      10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
    ]));
  } catch { return false; }
}

export async function openCamera() {
  if (navigator.mediaDevices?.getUserMedia) {
    try {
      // A USB webcam need not advertise a front-facing camera. Let the
      // monitor's default video input supply the stream.
      return await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { width: { ideal: 480 }, height: { ideal: 360 }, frameRate: { ideal: 30, max: 30 } },
      });
    } catch (error) {
      if (error.name !== 'OverconstrainedError' && error.name !== 'ConstraintNotSatisfiedError' && error.name !== 'TypeError') throw error;
      return navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    }
  }
  const legacy = navigator.getUserMedia || navigator.webkitGetUserMedia;
  if (legacy) {
    return new Promise((resolve, reject) => legacy.call(navigator, { audio: false, video: true }, resolve, reject));
  }
  if (window.isSecureContext === false) throw new Error('카메라를 사용하려면 HTTPS 주소로 열어 주세요.');
  throw new Error('이 기기에서는 카메라에 접근할 수 없습니다. USB 카메라 연결과 기기의 카메라 지원을 확인해 주세요.');
}
