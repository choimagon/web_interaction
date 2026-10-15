import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'motion/react';
import SmokeEngine from './SmokeEngine.js';

const palettes = [
  { id: 'rainbow', label: '랜덤 무지개', color: 'conic-gradient(#bfa2ff, #7e9dff, #8ae5df, #e7eea3, #ffb897, #f394ce, #bfa2ff)' },
  { id: 'aurora', label: '오로라', color: 'linear-gradient(135deg, #6d66ff, #d5a6ff)' },
  { id: 'ocean', label: '오션', color: 'linear-gradient(135deg, #4f9dff, #9cf2cf)' },
  { id: 'sunset', label: '선셋', color: 'linear-gradient(135deg, #ff8bb7, #ffd2a0)' },
];

function Icon({ name, size = 18, ...props }) {
  const paths = {
    expand: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />,
    collapse: <path d="M3 8h5V3m8 0v5h5M8 21v-5H3m18 0h-5v5" />,
    reset: <><path d="M3 10a9 9 0 1 1 2 8" /><path d="M3 4v6h6" /></>,
    play: <path d="m9 5 10 7-10 7V5Z" />,
    pause: <><path d="M9 5v14M15 5v14" /></>,
    arrow: <><path d="M5 19 19 5M5 5h14v14" /></>,
    mouse: <><rect x="6.5" y="2" width="11" height="19" rx="5.5" /><path d="M12 6v4" /></>,
    sparkle: <><path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3L12 3Z" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 1.8-2.5 1.6-2.5 3.5M12 16.5v.1" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}

function PrismMark() {
  return (
    <svg className="prism-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <defs><linearGradient id="brand-gradient" x1="5" y1="5" x2="35" y2="35" gradientUnits="userSpaceOnUse"><stop stopColor="#b8a1ff" /><stop offset="0.48" stopColor="#f2a9ce" /><stop offset="1" stopColor="#b9edca" /></linearGradient></defs>
      <g stroke="url(#brand-gradient)" strokeWidth="3.5" strokeLinecap="round"><path d="M20 5v30M5 20h30M9.4 9.4l21.2 21.2M9.4 30.6 30.6 9.4" /></g>
    </svg>
  );
}

const reveal = { duration: 0.85, ease: [0.22, 1, 0.36, 1] };

export default function App() {
  const canvasRef = useRef(null);
  const cursorRef = useRef(null);
  const engineRef = useRef(null);
  const activityTimer = useRef(null);
  const toastTimer = useRef(null);
  const [palette, setPalette] = useState('rainbow');
  const [size, setSize] = useState(60);
  const [auto, setAuto] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState('');
  const reducedMotion = useReducedMotion();
  const selectedPalette = palettes.find((item) => item.id === palette);

  const onActivity = useCallback((active) => {
    clearTimeout(activityTimer.current);
    if (active) setDrawing(true);
    else activityTimer.current = setTimeout(() => setDrawing(false), 900);
  }, []);

  useEffect(() => {
    const engine = new SmokeEngine(canvasRef.current, cursorRef.current, onActivity);
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
      clearTimeout(activityTimer.current);
      clearTimeout(toastTimer.current);
    };
  }, [onActivity]);

  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.palette = palette;
    engineRef.current.size = size;
    engineRef.current.auto = auto;
  }, [palette, size, auto]);

  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    const close = (event) => {
      if (event.key === 'Escape') setHelp(false);
    };
    document.addEventListener('fullscreenchange', update);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('fullscreenchange', update);
      document.removeEventListener('keydown', close);
    };
  }, []);

  function notify(message) {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else notify('이 브라우저에서는 전체 화면을 지원하지 않아요.');
    } catch {
      notify('전체 화면으로 전환할 수 없어요.');
    }
  }

  function reset() {
    engineRef.current?.clear();
    setAuto(false);
    setDrawing(false);
    notify('다시, 당신만의 색으로 채워보세요.');
  }

  function previewSmoke() {
    const engine = engineRef.current;
    if (!engine) return;
    const mobile = engine.width < 760;
    engine.emit(engine.width * (mobile ? 0.53 : 0.7), engine.height * (mobile ? 0.6 : 0.49), true);
  }

  return (
    <MotionConfig reducedMotion="user">
      <main className="playground relative isolate h-dvh min-h-[480px] w-full overflow-hidden bg-[#08090e] text-[#f3f1f5]">
        <div className="ambient-light pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="grain pointer-events-none absolute inset-0" aria-hidden="true" />
        <canvas
          ref={canvasRef}
          className="smoke-canvas absolute inset-0 h-full w-full touch-none"
          tabIndex={0}
          role="button"
          aria-label="컬러 연기 만들기. 마우스를 올리거나 움직이면 연기가 피어납니다. 모바일에서는 손가락으로 터치하세요. 키보드에서는 Enter 또는 스페이스를 누르세요."
        />
        <div ref={cursorRef} className="canvas-cursor pointer-events-none fixed z-40" aria-hidden="true"><span /></div>

        <motion.header initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={reveal} className="site-header pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between">
          <a href="#" onClick={(event) => { event.preventDefault(); reset(); }} className="brand pointer-events-auto inline-flex items-center space-x-2.5" aria-label="prism, 캔버스 초기화">
            <PrismMark />
            <span>prism<span className="brand-period">.</span></span>
          </a>
          <div className="header-center flex items-center space-x-2.5 text-[10px] tracking-[0.22em] text-white/40"><span className="tiny-cross">+</span> A LITTLE DIGITAL DAYDREAM <span className="tiny-cross">+</span></div>
          <div className="pointer-events-auto flex items-center space-x-5">
            <div className="live-badge flex items-center space-x-2 text-[10px] tracking-[0.14em]"><span className="live-dot" />LIVE CANVAS</div>
            <span className="header-divider h-4 w-px bg-white/10" />
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.92 }} onClick={toggleFullscreen} className="icon-button" aria-label={fullscreen ? '전체 화면 닫기' : '전체 화면으로 보기'} title={fullscreen ? '전체 화면 닫기' : '전체 화면으로 보기'}><Icon name={fullscreen ? 'collapse' : 'expand'} size={17} /></motion.button>
          </div>
        </motion.header>

        <section className="hero pointer-events-none absolute z-[2]" aria-labelledby="hero-title">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: drawing ? 0.16 : 1, y: 0 }} transition={{ ...reveal, delay: 0.1 }}>
            <div className="eyebrow mb-7 flex items-center space-x-3 text-[10px] tracking-[0.21em] text-white/50"><span className="eyebrow-line" />LET YOUR CURIOSITY FLOW</div>
            <h1 id="hero-title" className="hero-title"><span className="block">Let it</span><span className="flow-word block">flow<span className="title-dot">.</span></span></h1>
            <p className="hero-description mt-8 text-[13px] leading-[1.95] text-[#92919e]">마우스를 움직이거나, 가볍게 터치해 보세요.<br />손끝에서 피어나는, 당신만의 색.</p>
            <button onClick={previewSmoke} className="explore-hint pointer-events-auto mt-9 inline-flex items-center space-x-3" aria-label="연기 효과 미리 보기"><span className="mouse-icon"><Icon name="mouse" size={17} /></span><span>MOVE TO EXPLORE</span><Icon name="arrow" size={13} /></button>
          </motion.div>
        </section>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: drawing ? 0.1 : 1 }} transition={{ ...reveal, delay: 0.5 }} className="art-annotation pointer-events-none absolute flex items-center space-x-3" aria-hidden="true">
          <span className="annotation-line" /><div><span className="block text-[9px] tracking-[0.24em] text-white/30">EXPERIMENT 001</span><span className="mt-1 block text-[11px] tracking-[0.04em] text-white/55">A touch of the unexpected.</span></div>
        </motion.div>

        <motion.div style={{ x: '-50%' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ...reveal, delay: 0.35 }} className="control-area absolute z-10">
          <div className="control-caption mb-3 flex items-center justify-center space-x-2 text-[10px] tracking-[0.035em] text-white/35"><Icon name="sparkle" size={12} /><AnimatePresence mode="wait" initial={false}><motion.span key={palette} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: 0.15 }}>{palette === 'rainbow' ? '색이 피어나고, 자유롭게 흐르는 순간' : `${selectedPalette.label} 빛으로 물드는 순간`}</motion.span></AnimatePresence></div>
          <div className="toolbar flex items-center" role="group" aria-label="연기 설정">
            <div className="palette-group flex items-center space-x-3">
              <span className="control-label">COLOR</span>
              <div className="flex items-center space-x-2" role="group" aria-label="색상 팔레트">
                {palettes.map((item) => (
                  <motion.button key={item.id} whileHover={{ scale: 1.14 }} whileTap={{ scale: 0.91 }} onClick={() => setPalette(item.id)} className={`swatch relative shrink-0 rounded-full ${palette === item.id ? 'is-selected' : ''}`} style={{ '--swatch': item.color }} aria-label={item.label} aria-pressed={palette === item.id} title={item.label}>
                    <span className="swatch-color block rounded-full" style={{ background: item.color }} />
                    {palette === item.id && <motion.span layoutId="palette-ring" className="swatch-ring absolute rounded-full" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
                  </motion.button>
                ))}
              </div>
            </div>
            <span className="toolbar-divider" />
            <label className="size-group flex items-center space-x-3"><span className="control-label">SIZE</span><input aria-label="연기 크기" type="range" min="20" max="100" value={size} onChange={(event) => setSize(Number(event.target.value))} style={{ '--range-progress': `${(size - 20) / 80 * 100}%` }} /></label>
            <span className="toolbar-divider" />
            <motion.button whileTap={{ scale: 0.94 }} className={`auto-button flex items-center justify-center space-x-2 ${auto ? 'is-active' : ''}`} onClick={() => setAuto((value) => !value)} aria-label={auto ? '자동 연기 끄기' : '자동 연기 켜기'} aria-pressed={auto} title={auto ? '자동 연기 끄기' : '자동 연기 켜기'}><Icon name={auto ? 'pause' : 'play'} size={15} /><span>자동 재생</span></motion.button>
            <span className="toolbar-divider last-divider" />
            <motion.button whileHover={{ rotate: -35 }} whileTap={{ scale: 0.88 }} className="reset-button icon-button" onClick={reset} aria-label="캔버스 초기화" title="캔버스 초기화"><Icon name="reset" size={17} /></motion.button>
          </div>
        </motion.div>

        <footer className="site-footer pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center justify-between">
          <div className="flex items-center space-x-2.5"><span className="footer-dot" /><span className="footer-copy">NO RULES. JUST FLOW.</span></div>
          <span className="footer-middle">조금의 움직임, 무한한 색.</span>
          <button className="help-button pointer-events-auto flex items-center space-x-2" onClick={() => setHelp(true)} aria-label="사용 방법 보기"><span>HOW TO PLAY</span><Icon name="help" size={15} /></button>
        </footer>

        <div className="toast-container pointer-events-none absolute inset-x-0 z-30 flex justify-center" role="status" aria-live="polite">
          <AnimatePresence>{toast && <motion.div key={toast} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="toast">{toast}</motion.div>}</AnimatePresence>
        </div>

        <AnimatePresence>
          {help && <HelpDialog onClose={() => setHelp(false)} reducedMotion={reducedMotion} />}
        </AnimatePresence>
      </main>
    </MotionConfig>
  );
}

function HelpDialog({ onClose, reducedMotion }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    dialogRef.current?.focus();
    return () => previousFocus?.focus();
  }, []);

  function trapFocus(event) {
    if (event.key !== 'Tab') return;
    const buttons = dialogRef.current.querySelectorAll('button');
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="help-backdrop absolute inset-0 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <motion.section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="help-title" onKeyDown={trapFocus} onClick={(event) => event.stopPropagation()} initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.96, y: reducedMotion ? 0 : 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: reducedMotion ? 1 : 0.97 }} className="help-dialog relative w-full max-w-[390px] rounded-3xl p-8">
        <button className="icon-button absolute right-5 top-5" onClick={onClose} aria-label="사용 방법 닫기"><Icon name="close" /></button>
        <PrismMark />
        <p className="mt-6 text-[9px] tracking-[0.24em] text-white/40">A MOMENT TO PLAY</p>
        <h2 id="help-title" className="mt-2 text-3xl font-medium tracking-[-0.04em]">당신의 움직임이, 색으로.</h2>
        <div className="mt-6 space-y-5 text-[13px] leading-7 text-white/55">
          <p><span className="text-white/90">마우스를 올리고 자유롭게 움직여</span> 보세요.<br />머무는 곳에서도 색이 피어나요. 모바일에서는 손가락으로 터치해 보세요.</p>
          <p>컬러와 연기 크기를 바꾸거나, <span className="text-white/90">자동 재생</span>을 켜고 잠시 색의 흐름을 감상해도 좋아요.</p>
          <p className="text-[11px] text-white/35">키보드로도 즐길 수 있어요. 캔버스에 포커스를 두고 Enter 또는 스페이스를 눌러보세요.</p>
        </div>
        <button onClick={onClose} className="mt-7 flex w-full items-center justify-between rounded-xl bg-[#e3ddf2] px-5 py-3.5 text-[12px] font-medium text-[#17121f]">색을 피우러 가기<Icon name="arrow" size={16} /></button>
      </motion.section>
    </motion.div>
  );
}
