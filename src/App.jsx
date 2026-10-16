import { useEffect, useRef, useState } from 'react';
import { motion, MotionConfig } from 'motion/react';
import SmokeEngine from './SmokeEngine.js';

const palettes = [
  { id: 'red', label: '빨간색 계열', color: 'linear-gradient(135deg, #ff496c, #ffa375)' },
  { id: 'blue', label: '파란색 계열', color: 'linear-gradient(135deg, #436bff, #7adeff)' },
  { id: 'yellow', label: '노란색 계열', color: 'linear-gradient(135deg, #ffc943, #fff2a0)' },
  { id: 'green', label: '초록색 계열', color: 'linear-gradient(135deg, #28ba82, #a6f0a2)' },
];

function Icon({ name, size = 19 }) {
  const paths = {
    expand: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />,
    collapse: <path d="M3 8h5V3m8 0v5h5M8 21v-5H3m18 0h-5v5" />,
    reset: <><path d="M3 10a9 9 0 1 1 2 8" /><path d="M3 4v6h6" /></>,
    play: <path d="m9 5 10 7-10 7V5Z" />,
    pause: <path d="M9 5v14M15 5v14" />,
    brush: <><path d="m14 5 5 5M7 12l9-9 5 5-9 9" /><path d="M12 17c0 4-5 4-8 4 1-1 1-2 1-4a3.5 3.5 0 0 1 7 0Z" /></>,
    check: <path d="m7 12 3 3 7-7" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function RangeControl({ label, icon, value, onChange }) {
  return (
    <label className="range-control">
      <span className="range-label"><span className="range-name"><Icon name={icon} size={13} />{label}</span><output>{value}</output></span>
      <input type="range" aria-label={label} min="20" max="100" value={value} onChange={(event) => onChange(Number(event.target.value))} style={{ '--range-progress': `${(value - 20) / 80 * 100}%` }} />
    </label>
  );
}

export default function App() {
  const canvasRef = useRef(null);
  const cursorRef = useRef(null);
  const engineRef = useRef(null);
  const [palette, setPalette] = useState('red');
  const [size, setSize] = useState(60);
  const [auto, setAuto] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const engine = new SmokeEngine(canvasRef.current, cursorRef.current);
    engineRef.current = engine;
    return () => { engine.destroy(); engineRef.current = null; };
  }, []);

  useEffect(() => {
    if (engineRef.current) Object.assign(engineRef.current, { palette, size, auto });
  }, [palette, size, auto]);

  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else setStatus('이 브라우저에서는 전체 화면을 지원하지 않습니다.');
    } catch { setStatus('전체 화면으로 전환할 수 없습니다.'); }
  }

  function reset() {
    engineRef.current?.clear();
    setAuto(false);
    setStatus('캔버스를 비웠습니다.');
  }

  return (
    <MotionConfig reducedMotion="user">
      <main className="playground relative isolate w-full overflow-hidden text-white">
        <div className="galaxy-background" aria-hidden="true" />
        <canvas ref={canvasRef} className="smoke-canvas" tabIndex={0} role="button" aria-label="컬러 연기 캔버스. 마우스를 움직이거나 터치해서 그리세요. Enter와 스페이스로도 그릴 수 있습니다." />
        <div ref={cursorRef} className="canvas-cursor" aria-hidden="true"><span /></div>
        <div className="control-area">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="toolbar" role="group" aria-label="캔버스 설정">
            <div className="palette-group" role="group" aria-label="색상 팔레트">
              {palettes.map((item) => (
                <motion.button key={item.id} whileTap={{ scale: 0.92 }} onClick={() => setPalette(item.id)} className={`swatch ${palette === item.id ? 'is-selected' : ''}`} aria-label={item.label} aria-pressed={palette === item.id} title={item.label}>
                  <span className="swatch-color" style={{ background: item.color }} />
                  {palette === item.id && <span className="swatch-check"><Icon name="check" size={13} /></span>}
                </motion.button>
              ))}
            </div>
            <div className="slider-group">
              <RangeControl label="굵기" icon="brush" value={size} onChange={setSize} />
            </div>
            <div className="action-group">
              <motion.button whileTap={{ scale: 0.92 }} className={`tool-button auto-button ${auto ? 'is-active' : ''}`} onClick={() => setAuto((value) => !value)} aria-label={auto ? '자동 재생 끄기' : '자동 재생 켜기'} aria-pressed={auto} title="자동 재생"><Icon name={auto ? 'pause' : 'play'} /><span>자동</span></motion.button>
              <motion.button whileTap={{ scale: 0.92 }} className="tool-button" onClick={reset} aria-label="캔버스 초기화" title="초기화"><Icon name="reset" /></motion.button>
              <motion.button whileTap={{ scale: 0.92 }} className="tool-button" onClick={toggleFullscreen} aria-label={fullscreen ? '전체 화면 닫기' : '전체 화면으로 보기'} title="전체 화면"><Icon name={fullscreen ? 'collapse' : 'expand'} /></motion.button>
            </div>
          </motion.div>
        </div>
        <div className="sr-only" role="status" aria-live="polite">{status}</div>
      </main>
    </MotionConfig>
  );
}
