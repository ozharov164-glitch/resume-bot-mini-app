import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

interface VoiceRecordingBarProps {
  visible: boolean;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onStop: () => void;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VoiceRecordingBar({ visible, canvasRef, onStop }: VoiceRecordingBarProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!visible) {
      setElapsed(0);
      return;
    }

    setElapsed(0);
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="vr-bar"
          initial={{ opacity: 0, scaleY: 0.85 }}
          animate={{ opacity: 1, scaleY: 1 }}
          exit={{ opacity: 0, scaleY: 0.85 }}
          transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
          style={{ originY: 0.5 }}
        >
          <span className="vr-dot" aria-hidden />

          <div className="vr-wave-wrap">
            <canvas
              ref={canvasRef}
              width={240}
              height={32}
              className="vr-waveform"
              aria-hidden
            />
          </div>

          <span className="vr-timer">{formatTime(elapsed)}</span>

          <button
            type="button"
            className="vr-stop"
            onClick={onStop}
            aria-label="Остановить запись"
          >
            <span className="vr-stop__icon" aria-hidden />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface VoiceTranscribingBarProps {
  visible: boolean;
}

export function VoiceTranscribingBar({ visible }: VoiceTranscribingBarProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="vr-processing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <span className="vr-processing__spinner" aria-hidden />
          <span className="vr-processing__label">
            Распознаю речь
            <span className="vr-processing__dots" aria-hidden>
              <span>.</span><span>.</span><span>.</span>
            </span>
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Smooth symmetric Telegram-style waveform driven by AnalyserNode. */
export function useVoiceWaveform(canvasRef: RefObject<HTMLCanvasElement | null>) {
  const animRef = useRef<number>();
  const heightsRef = useRef<number[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const stop = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    heightsRef.current = [];
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }, [canvasRef]);

  const start = useCallback((stream: MediaStream) => {
    stop();
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;
    ctx.createMediaStreamSource(stream).connect(analyser);
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;

    const barCount = 30;
    const data = new Uint8Array(analyser.frequencyBinCount);
    heightsRef.current = new Array(barCount).fill(0.1);

    const draw = () => {
      const canvas = canvasRef.current;
      const analyserNode = analyserRef.current;
      if (!canvas || !analyserNode) return;

      analyserNode.getByteFrequencyData(data);
      const c = canvas.getContext("2d");
      if (!c) return;

      const w = canvas.width;
      const h = canvas.height;
      const barW = 2.5;
      const gap = 2;
      const totalW = barCount * (barW + gap) - gap;
      const startX = (w - totalW) / 2;
      const step = Math.max(1, Math.floor(data.length / barCount));

      c.clearRect(0, 0, w, h);

      for (let i = 0; i < barCount; i++) {
        const raw = data[i * step] / 255;
        const target = Math.max(0.08, Math.pow(raw, 0.7));
        heightsRef.current[i] = heightsRef.current[i] * 0.65 + target * 0.35;
        const barH = Math.max(3, heightsRef.current[i] * h * 0.9);
        const x = startX + i * (barW + gap);
        const y = (h - barH) / 2;

        c.fillStyle = "#10b981";
        c.beginPath();
        if (c.roundRect) {
          c.roundRect(x, y, barW, barH, 1.5);
        } else {
          c.rect(x, y, barW, barH);
        }
        c.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
  }, [canvasRef, stop]);

  useEffect(() => () => stop(), [stop]);

  return { start, stop };
}
