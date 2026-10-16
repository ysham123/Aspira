import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Hand, ScanFace, Sparkles } from 'lucide-react';

interface WebcamSensorOverlayProps {
  enabled: boolean;
  onToggle: () => void;
  bootState: 'sentinel' | 'amber_challenge' | 'intruder' | 'ignited';
  onHandMove?: (cursor: { x: number; y: number; active: boolean; pinching: boolean }) => void;
  onAirGestureTrigger?: (gesture: 'wake_all' | 'cycle_mode' | 'fusion_pulse') => void;
}

export const WebcamSensorOverlay: React.FC<WebcamSensorOverlayProps> = ({
  enabled,
  onToggle,
  bootState,
  onHandMove,
  onAirGestureTrigger,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraStatus, setCameraStatus] = useState<'off' | 'active' | 'denied'>('off');
  const [motionScore, setMotionScore] = useState(0);
  const [gestureLabel, setGestureLabel] = useState('OPTICAL LOCK NOMINAL');
  const lastGestureTime = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setCameraStatus('off');
      onHandMove?.({ x: 0.5, y: 0.5, active: false, pinching: false });
      return;
    }

    let stream: MediaStream | null = null;
    let rafId = 0;
    let prevFrame: Uint8ClampedArray | null = null;

    navigator.mediaDevices
      .getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: false,
      })
      .then((s) => {
        stream = s;
        setCameraStatus('active');
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }

        const offscreen = document.createElement('canvas');
        offscreen.width = 80;
        offscreen.height = 60;
        const offCtx = offscreen.getContext('2d', { willReadFrequently: true });

        const trackLoop = () => {
          rafId = requestAnimationFrame(trackLoop);
          const video = videoRef.current;
          const overlay = canvasRef.current;
          if (!video || !overlay || !offCtx || video.readyState < 2) return;

          offCtx.drawImage(video, 0, 0, 80, 60);
          const frame = offCtx.getImageData(0, 0, 80, 60).data;

          let sumX = 0;
          let sumY = 0;
          let changedPixels = 0;

          if (prevFrame) {
            for (let y = 0; y < 60; y++) {
              for (let x = 0; x < 80; x++) {
                const idx = (y * 80 + x) * 4;
                const diff =
                  Math.abs(frame[idx] - prevFrame[idx]) +
                  Math.abs(frame[idx + 1] - prevFrame[idx + 1]) +
                  Math.abs(frame[idx + 2] - prevFrame[idx + 2]);
                if (diff > 75) {
                  // Mirror X for natural hand tracking
                  sumX += 80 - x;
                  sumY += y;
                  changedPixels++;
                }
              }
            }
          }
          prevFrame = new Uint8ClampedArray(frame);

          const oCtx = overlay.getContext('2d');
          if (!oCtx) return;
          oCtx.clearRect(0, 0, overlay.width, overlay.height);

          // Draw Biometric Face-Lock Target Reticle in center
          const cx = overlay.width / 2;
          const cy = overlay.height / 2;
          const reticleColor =
            bootState === 'intruder'
              ? '#ff1e42'
              : bootState === 'amber_challenge'
              ? '#ffaa00'
              : '#00f0ff';

          oCtx.strokeStyle = reticleColor;
          oCtx.lineWidth = 1.5;
          oCtx.beginPath();
          oCtx.arc(cx, cy, 36, 0, Math.PI * 2);
          oCtx.stroke();

          // Corner brackets
          const b = 46;
          oCtx.beginPath();
          oCtx.moveTo(cx - b, cy - b + 12);
          oCtx.lineTo(cx - b, cy - b);
          oCtx.lineTo(cx - b + 12, cy - b);
          oCtx.moveTo(cx + b - 12, cy - b);
          oCtx.lineTo(cx + b, cy - b);
          oCtx.lineTo(cx + b, cy - b + 12);
          oCtx.moveTo(cx - b, cy + b - 12);
          oCtx.lineTo(cx - b, cy + b);
          oCtx.lineTo(cx - b + 12, cy + b);
          oCtx.moveTo(cx + b - 12, cy + b);
          oCtx.lineTo(cx + b, cy + b);
          oCtx.lineTo(cx + b, cy + b - 12);
          oCtx.stroke();

          // Optical Hand / Motion Vector Tracking
          const normMotion = Math.min(100, Math.round((changedPixels / 320) * 100));
          setMotionScore(normMotion);

          if (changedPixels > 22) {
            const normX = sumX / changedPixels / 80;
            const normY = sumY / changedPixels / 60;

            const hx = normX * overlay.width;
            const hy = normY * overlay.height;

            oCtx.strokeStyle = '#ff9e00';
            oCtx.lineWidth = 2;
            oCtx.beginPath();
            oCtx.arc(hx, hy, 14, 0, Math.PI * 2);
            oCtx.stroke();

            oCtx.beginPath();
            oCtx.moveTo(cx, cy);
            oCtx.lineTo(hx, hy);
            oCtx.stroke();

            onHandMove?.({ x: normX, y: normY, active: true, pinching: changedPixels > 190 });

            const now = performance.now();
            if (changedPixels > 260 && now - lastGestureTime.current > 2600) {
              lastGestureTime.current = now;
              if (normX < 0.32) {
                setGestureLabel('AIR SWIPE LEFT → CYCLE SPATIAL MODE');
                onAirGestureTrigger?.('cycle_mode');
              } else if (normX > 0.68) {
                setGestureLabel('AIR SWIPE RIGHT → FUSION PULSE');
                onAirGestureTrigger?.('fusion_pulse');
              } else if (normY < 0.3) {
                setGestureLabel('AIR RAISE → WAKE ALL PANTHEON CORES');
                onAirGestureTrigger?.('wake_all');
              }
            }
          } else {
            onHandMove?.({ x: 0.5, y: 0.5, active: false, pinching: false });
          }
        };

        trackLoop();
      })
      .catch(() => {
        setCameraStatus('denied');
      });

    return () => {
      cancelAnimationFrame(rafId);
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [enabled, bootState]);

  return (
    <div className="hud-panel relative rounded-lg border border-cyan-500/30 bg-[#040d1a]/85 p-2.5 backdrop-blur-md">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-cyan-300 uppercase">
          <ScanFace className="w-3.5 h-3.5 text-cyan-400" />
          <span>Optical Visor & Hand Rig</span>
        </div>
        <button
          onClick={onToggle}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase transition cursor-pointer border ${
            enabled
              ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/60'
              : 'bg-slate-900/80 text-slate-400 border-slate-700 hover:border-cyan-500/40'
          }`}
        >
          {enabled ? <Camera className="w-3 h-3" /> : <CameraOff className="w-3 h-3" />}
          {enabled ? 'LIVE CAM' : 'ENABLE CAM'}
        </button>
      </div>

      {enabled && cameraStatus === 'active' ? (
        <div className="relative w-full h-32 rounded overflow-hidden border border-cyan-500/40 bg-black">
          <video
            ref={videoRef}
            muted
            playsInline
            className="w-full h-full object-cover scale-x-[-1] opacity-75 contrast-125"
          />
          <canvas
            ref={canvasRef}
            width={240}
            height={128}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
          <div className="absolute bottom-1 left-1.5 right-1.5 flex items-center justify-between text-[9px] font-mono text-cyan-200 bg-black/65 px-1.5 py-0.5 rounded">
            <span className="truncate">{gestureLabel}</span>
            <span className="text-amber-300">VEC:{motionScore}%</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-24 rounded border border-dashed border-cyan-500/25 bg-[#020813]/70 px-3 text-center">
          <div className="flex items-center gap-2 text-xs text-cyan-300/80 font-mono mb-1">
            <Hand className="w-4 h-4 text-cyan-400" />
            <span>{cameraStatus === 'denied' ? 'Camera Permission Blocked' : 'Tri-Modal Gesture Rig Standby'}</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-tight">
            Click <span className="text-cyan-300">ENABLE CAM</span> for live biometric face-lock & mid-air hand swipe gestures, or use Voice + Mouse anytime.
          </p>
          <div className="mt-1.5 flex gap-1.5">
            <button
              onClick={() => onAirGestureTrigger?.('cycle_mode')}
              className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-[9px] font-mono text-cyan-300 hover:bg-cyan-500/25 cursor-pointer"
            >
              <Sparkles className="w-2.5 h-2.5 inline mr-1" />
              Sim Air-Swipe
            </button>
            <button
              onClick={() => onAirGestureTrigger?.('wake_all')}
              className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[9px] font-mono text-amber-300 hover:bg-amber-500/25 cursor-pointer"
            >
              Sim Hand-Throw
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
