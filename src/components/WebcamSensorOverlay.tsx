import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Hand, ScanFace, Sparkles } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';

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
  const [gestureLabel, setGestureLabel] = useState('Optical Presence Nominal');
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

          // Refined 1px Hairline Face/Presence Reticle
          const cx = overlay.width / 2;
          const cy = overlay.height / 2;
          const reticleColor =
            bootState === 'intruder'
              ? '#F43F5E'
              : bootState === 'amber_challenge'
              ? '#F59E0B'
              : '#6E8EFB';

          oCtx.strokeStyle = reticleColor;
          oCtx.lineWidth = 1.25;
          oCtx.beginPath();
          oCtx.arc(cx, cy, 32, 0, Math.PI * 2);
          oCtx.stroke();

          const normMotion = Math.min(100, Math.round((changedPixels / 320) * 100));
          setMotionScore(normMotion);

          if (changedPixels > 22) {
            const normX = sumX / changedPixels / 80;
            const normY = sumY / changedPixels / 60;

            const hx = normX * overlay.width;
            const hy = normY * overlay.height;

            oCtx.strokeStyle = '#D97757';
            oCtx.lineWidth = 1.5;
            oCtx.beginPath();
            oCtx.arc(hx, hy, 12, 0, Math.PI * 2);
            oCtx.stroke();

            onHandMove?.({ x: normX, y: normY, active: true, pinching: changedPixels > 190 });

            const now = performance.now();
            if (changedPixels > 260 && now - lastGestureTime.current > 2600) {
              lastGestureTime.current = now;
              if (normX < 0.32) {
                setGestureLabel('Swipe Left · Cycle View');
                onAirGestureTrigger?.('cycle_mode');
              } else if (normX > 0.68) {
                setGestureLabel('Swipe Right · Fusion Run');
                onAirGestureTrigger?.('fusion_pulse');
              } else if (normY < 0.3) {
                setGestureLabel('Raise · Wake Ensemble');
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
    <div className="relative flex items-center gap-1.5">
      {/* Compact Dock Pill */}
      <button
        type="button"
        onClick={() => {
          soundEngine.playGlassTick();
          onToggle();
        }}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition cursor-pointer ${
          enabled
            ? 'bg-[#6E8EFB]/20 text-white border-[#6E8EFB]/50'
            : 'aspira-card-interactive text-slate-300'
        }`}
      >
        {enabled ? (
          <Camera className="w-3.5 h-3.5 text-[#6E8EFB]" />
        ) : (
          <CameraOff className="w-3.5 h-3.5 text-slate-400" />
        )}
        <span>{enabled ? 'Vision Cam On' : 'Vision Cam'}</span>
      </button>

      {/* Quick Simulated Air-Gesture Pill */}
      <button
        type="button"
        title="Simulate Mid-Air Hand Swipe to Cycle View"
        onClick={() => {
          soundEngine.playGlassTick(1.1);
          onAirGestureTrigger?.('cycle_mode');
        }}
        className="flex items-center gap-1 px-2.5 py-2 rounded-xl aspira-card-interactive text-[11px] text-slate-300 hover:text-white cursor-pointer"
      >
        <Hand className="w-3.5 h-3.5 text-[#D97757]" />
        <span className="hidden sm:inline">Gesture</span>
      </button>

      {/* Floating Picture-in-Picture (PiP) Glass Card when Camera is Enabled */}
      {enabled && (
        <div className="fixed bottom-28 right-5 z-30 w-64 rounded-2xl aspira-glass-elevated p-2.5 shadow-2xl">
          <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1.5 px-1">
            <span className="flex items-center gap-1.5 font-medium text-white">
              <ScanFace className="w-3.5 h-3.5 text-[#6E8EFB]" />
              Optical Companion
            </span>
            <span className="font-mono-tech text-[10px] text-slate-400">
              {cameraStatus === 'active' ? `${motionScore}% Motion` : 'Permission Needed'}
            </span>
          </div>

          {cameraStatus === 'active' ? (
            <div className="relative w-full h-32 rounded-xl overflow-hidden bg-black border border-white/[0.08]">
              <video
                ref={videoRef}
                muted
                playsInline
                className="w-full h-full object-cover scale-x-[-1] opacity-85"
              />
              <canvas
                ref={canvasRef}
                width={240}
                height={128}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
              <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between text-[10px] text-slate-200 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-lg">
                <span className="truncate">{gestureLabel}</span>
                <Sparkles className="w-3 h-3 text-[#6E8EFB] shrink-0" />
              </div>
            </div>
          ) : (
            <div className="h-24 rounded-xl bg-black/40 border border-white/[0.06] flex items-center justify-center text-[11px] text-slate-400 px-3 text-center">
              Allow camera access for live face presence & mid-air swipe gestures.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
