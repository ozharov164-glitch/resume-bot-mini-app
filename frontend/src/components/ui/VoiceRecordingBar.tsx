import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, type RefObject } from "react";

interface VoiceRecordingBarProps {
  visible: boolean;
  recordSeconds: number;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onStop: () => void;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VoiceRecordingBar({ visible, recordSeconds, canvasRef, onStop }: VoiceRecordingBarProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="voice-messenger-bar"
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
        >
          <div className="voice-messenger-bar__shine" aria-hidden />
          <div className="voice-messenger-bar__body">
            <div className="voice-rec-indicator" aria-hidden>
              <span className="voice-rec-indicator__ring" />
              <span className="voice-rec-indicator__ring voice-rec-indicator__ring--2" />
              <span className="voice-rec-indicator__dot" />
            </div>

            <div className="voice-messenger-wave-wrap">
              <canvas
                ref={canvasRef}
                width={280}
                height={44}
                className="voice-messenger-waveform"
                aria-hidden
              />
            </div>

            <div className="voice-messenger-meta">
              <span className="voice-messenger-timer">{formatTime(recordSeconds)}</span>
              <button
                type="button"
                className="voice-messenger-stop"
                onClick={onStop}
                aria-label="Остановить запись"
              >
                <span className="voice-messenger-stop__square" />
              </button>
            </div>
          </div>

          <p className="voice-messenger-hint">Говори — нажми квадрат, когда закончишь</p>
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
          className="voice-messenger-processing"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <div className="voice-processing-wave" aria-hidden>
            {Array.from({ length: 28 }, (_, i) => (
              <span
                key={i}
                className="voice-processing-wave__bar"
                style={{ animationDelay: `${(i % 7) * 0.08}s` }}
              />
            ))}
          </div>
          <div className="voice-processing-label">
            <span className="voice-processing-spinner" aria-hidden />
            <span>
              Распознаю речь
              <ProcessingDots />
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ProcessingDots() {
  return (
    <span className="voice-processing-dots" aria-hidden>
      <span>.</span>
      <span>.</span>
      <span>.</span>
    </span>
  );
}

/** Smooth symmetric Telegram-style waveform driven by AnalyserNode. */
export function useVoiceWaveform(canvasRef: RefObject<HTMLCanvasElement | null>) {
  const animRef = useRef<number>();
  const heightsRef = useRef<number[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const stop = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    heightsRef.current = [];
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const start = (stream: MediaStream) => {
    stop();
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;
    ctx.createMediaStreamSource(stream).connect(analyser);
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;

    const barCount = 36;
    const data = new Uint8Array(analyser.frequencyBinCount);
    heightsRef.current = new Array(barCount).fill(0.12);

    const draw = () => {
      const canvas = canvasRef.current;
      const analyserNode = analyserRef.current;
      if (!canvas || !analyserNode) return;

      analyserNode.getByteFrequencyData(data);
      const c = canvas.getContext("2d");
      if (!c) return;

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const barW = 3;
      const gap = 2.5;
      const half = barCount / 2;
      const step = Math.max(1, Math.floor(data.length / barCount));

      c.clearRect(0, 0, w, h);

      for (let i = 0; i < barCount; i++) {
        const raw = data[i * step] / 255;
        const target = Math.max(0.1, Math.pow(raw, 0.75));
        heightsRef.current[i] = heightsRef.current[i] * 0.62 + target * 0.38;
        const barH = heightsRef.current[i] * h * 0.88;
        const dist = i - half + 0.5;
        const x = cx + dist * (barW + gap) - barW / 2;
        const y = (h - barH) / 2;

        const grad = c.createLinearGradient(x, y, x, y + barH);
        grad.addColorStop(0, "#34d399");
        grad.addColorStop(0.5, "#10b981");
        grad.addColorStop(1, "#059669");
        c.fillStyle = grad;

        c.beginPath();
        if (c.roundRect) {
          c.roundRect(x, y, barW, Math.max(3, barH), 1.5);
        } else {
          c.rect(x, y, barW, Math.max(3, barH));
        }
        c.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
  };

  useEffect(() => () => stop(), []);

  return { start, stop };
}
