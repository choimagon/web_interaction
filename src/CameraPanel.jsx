import { useEffect, useRef, useState } from 'react';
import { HAND_CONNECTIONS, readHandGesture } from './handGestures.js';
import { openCamera, supportsWorkerTracking } from './cameraSupport.js';
import { createLegacyHandTracker } from './legacyHandTracker.js';
import handWorkerUrl from './handTracking.worker.js?worker&url';

const labels = {
  camera: '카메라 연결 중…',
  model: '손 인식 준비 중…',
  searching: '카메라에 손을 보여 주세요',
  point: '검지로 그리는 중',
  palm: '포인터를 가운데로 이동했어요',
  idle: '검지만 펴면 그릴 수 있어요',
  paused: '손 인식 일시 정지',
};

function cameraError(error) {
  if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError' || error.name === 'SecurityError') return '카메라 권한을 허용한 뒤 캠을 다시 켜 주세요.';
  if (error.name === 'NotFoundError') return '연결된 카메라가 없습니다. 카메라를 연결한 뒤 다시 켜 주세요.';
  if (error.name === 'NotReadableError') return '카메라를 열 수 없습니다. 다른 앱에서 사용 중인지 확인해 주세요.';
  return error.message || '카메라를 시작하지 못했습니다. 캠을 다시 켜 주세요.';
}

export default function CameraPanel({ engineRef, onError }) {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const [phase, setPhase] = useState('camera');

  useEffect(() => {
    const video = videoRef.current;
    const overlay = overlayRef.current;
    const ctx = overlay.getContext('2d');
    let active = true;
    let stream;
    let worker;
    let legacyTracker;
    let legacyStarting = false;
    let frame;
    let loadTimeout;
    let ready = false;
    let busy = false;
    let lastFrameTime = -1;
    let lastCapture = 0;
    let lastResult = 0;
    let previousGesture = 'none';
    let gestureFrames = 0;
    let smoothPoint = null;

    function stopDrawing() {
      engineRef.current?.stopHandPointer();
      smoothPoint = null;
      previousGesture = 'none';
      gestureFrames = 0;
      ctx.clearRect(0, 0, overlay.width, overlay.height);
    }

    function cleanup() {
      active = false;
      clearTimeout(loadTimeout);
      cancelAnimationFrame(frame);
      worker?.terminate();
      legacyTracker?.close();
      stream?.getTracks().forEach((track) => track.stop());
      video.pause();
      video.srcObject = null;
      stopDrawing();
    }

    function fail(message) {
      if (!active) return;
      cleanup();
      onError(message);
    }

    function drawHand(landmarks, gesture) {
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      if (!landmarks) return;
      const color = gesture === 'point' ? '#b6f9d6' : gesture === 'palm' ? '#b4cdff' : '#ffffffa0';
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const [a, b] of HAND_CONNECTIONS) {
        ctx.moveTo(landmarks[a].x * overlay.width, landmarks[a].y * overlay.height);
        ctx.lineTo(landmarks[b].x * overlay.width, landmarks[b].y * overlay.height);
      }
      ctx.stroke();
      landmarks.forEach((point, index) => {
        ctx.beginPath();
        ctx.arc(point.x * overlay.width, point.y * overlay.height, index === 8 ? 5 : 2.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    function handleResult(data) {
      busy = false;
      if (document.hidden || performance.now() - data.timestamp > 500) {
        stopDrawing();
        return;
      }
      lastResult = performance.now();
      const result = readHandGesture(data.landmarks, video.videoWidth / video.videoHeight);
      drawHand(data.landmarks, result.gesture);
      gestureFrames = result.gesture === previousGesture ? gestureFrames + 1 : 1;
      previousGesture = result.gesture;

      if (result.gesture === 'point') {
        // Respond immediately; use less smoothing during intentional movement.
        const distance = smoothPoint ? Math.hypot(result.x - smoothPoint.x, result.y - smoothPoint.y) : 1;
        const blend = distance > 0.025 ? 0.9 : 0.65;
        smoothPoint = smoothPoint ? {
          x: smoothPoint.x + (result.x - smoothPoint.x) * blend,
          y: smoothPoint.y + (result.y - smoothPoint.y) * blend,
        } : { x: result.x, y: result.y };
        engineRef.current?.moveHandPointer(smoothPoint.x, smoothPoint.y, true);
        setPhase('point');
      } else {
        engineRef.current?.stopHandPointer();
        smoothPoint = null;
        if (result.gesture === 'palm' && gestureFrames >= 2) {
          engineRef.current?.moveHandPointer(0.5, 0.5, false);
          setPhase('palm');
        } else if (result.gesture !== 'palm') {
          setPhase(result.gesture === 'none' ? 'searching' : 'idle');
        }
      }
    }

    async function capture(timestamp) {
      if (!active) return;
      frame = requestAnimationFrame(capture);
      // One frame in flight. Never queue old camera frames behind inference.
      if (document.hidden || !ready) return;
      if (lastResult && timestamp - lastResult > 500) {
        stopDrawing();
        setPhase('searching');
      }
      if (busy || video.readyState < 2 || video.currentTime === lastFrameTime || timestamp - lastCapture < 31) return;
      busy = true;
      lastCapture = timestamp;
      lastFrameTime = video.currentTime;
      try {
        if (legacyTracker) {
          await legacyTracker.send(video, timestamp);
          busy = false;
          return;
        }
        const bitmap = await createImageBitmap(video);
        if (!active) { bitmap.close(); return; }
        worker.postMessage({ type: 'frame', bitmap, timestamp }, [bitmap]);
      } catch {
        fail('손 인식 중 오류가 발생했습니다. 캠을 다시 켜 주세요.');
      }
    }

    function visibilityChange() {
      stopDrawing();
      setPhase(document.hidden ? 'paused' : 'searching');
    }
    document.addEventListener('visibilitychange', visibilityChange);

    function markReady(mode) {
      if (!active) return;
      clearTimeout(loadTimeout);
      video.dataset.tracker = mode;
      ready = true;
      busy = false;
      setPhase('searching');
    }

    async function startLegacyTracker() {
      if (!active || legacyStarting) return;
      legacyStarting = true;
      ready = false;
      busy = false;
      worker?.terminate();
      worker = null;
      stopDrawing();
      setPhase('model');
      clearTimeout(loadTimeout);
      loadTimeout = setTimeout(() => fail('손 인식 준비 시간이 초과되었습니다. 캠을 다시 켜 주세요.'), 45000);
      try {
        if (!active) return;
        const assetRoot = new URL(`${import.meta.env.BASE_URL}mediapipe/hands/`, window.location.href).href;
        legacyTracker = createLegacyHandTracker(assetRoot, handleResult);
        await legacyTracker.initialize();
        markReady('legacy-lite');
      } catch {
        fail('이 기기에서 손 인식을 시작하지 못했습니다. 카메라 지원 및 그래픽 가속 설정을 확인해 주세요.');
      }
    }

    async function start() {
      try {
        if (!window.WebAssembly) throw new Error('이 기기에서는 손 인식에 필요한 WebAssembly를 지원하지 않습니다.');
        stream = await openCamera();
        if (!active) { stream.getTracks().forEach((track) => track.stop()); return; }
        stream.getVideoTracks()[0].addEventListener('ended', () => fail('카메라 연결이 끊겼습니다. 연결 후 캠을 다시 켜 주세요.'), { once: true });
        video.srcObject = stream;
        await video.play();
        if (!active) return;
        overlay.width = video.videoWidth;
        overlay.height = video.videoHeight;
        setPhase('model');
        if (supportsWorkerTracking()) {
          try {
            worker = new Worker(handWorkerUrl, { type: 'module' });
            worker.onerror = (event) => { event.preventDefault(); startLegacyTracker(); };
            worker.onmessage = ({ data }) => {
              if (!active || legacyStarting) return;
              if (data.type === 'ready') markReady(`worker-${(data.delegate || 'CPU').toLowerCase()}`);
              else if (data.type === 'result') handleResult(data);
              else if (data.type === 'error') startLegacyTracker();
            };
            worker.postMessage({ type: 'init', modelUrl: new URL(`${import.meta.env.BASE_URL}mediapipe/hand_landmarker.task`, window.location.href).href });
            loadTimeout = setTimeout(startLegacyTracker, 15000);
          } catch { startLegacyTracker(); }
        } else startLegacyTracker();
        frame = requestAnimationFrame(capture);
      } catch (error) {
        fail(cameraError(error));
      }
    }
    start();
    return () => {
      document.removeEventListener('visibilitychange', visibilityChange);
      cleanup();
    };
  }, [engineRef, onError]);

  return (
    <aside className={`camera-panel camera-panel--${phase}`} aria-label="손 인식 카메라">
      <div className="camera-view">
        <video ref={videoRef} autoPlay playsInline muted aria-label="카메라 미리보기" />
        <canvas ref={overlayRef} className="hand-overlay" aria-hidden="true" />
        <span className="camera-live"><span />CAM ON</span>
        {(phase === 'camera' || phase === 'model') && <div className="camera-loading"><span className="camera-spinner" /></div>}
      </div>
      <div className="camera-caption">
        <p className="camera-status" role="status" aria-live="polite"><span />{labels[phase]}</p>
        <p className="camera-hint">검지만 펴기 · 그리기<span>손바닥 펴기 · 가운데로</span></p>
      </div>
    </aside>
  );
}
