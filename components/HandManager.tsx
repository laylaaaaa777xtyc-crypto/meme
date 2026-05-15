import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import { GestureState } from '../types';

interface HandManagerProps {
  onHandUpdate: (state: GestureState) => void;
  onGestureTrigger: (gesture: GestureState['gesture']) => void;
  isCameraOn: boolean;
  isMobile?: boolean;
}

const TRIGGER_HOLD_MS = 1200; // 手势稳定 1.2s 才触发

const HandManager: React.FC<HandManagerProps> = ({ onHandUpdate, onGestureTrigger, isCameraOn, isMobile = false }) => {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handLandmarkerRef     = useRef<HandLandmarker | null>(null);
  const requestRef            = useRef<number | null>(null);
  const streamRef             = useRef<MediaStream | null>(null);
  const lastPredictionTime    = useRef<number>(0);
  const gestureHoldStart      = useRef<number>(0);
  const lastStableGesture     = useRef<GestureState['gesture']>('Unknown');
  const triggeredGestures     = useRef<Set<GestureState['gesture']>>(new Set());
  const [modelLoaded, setModelLoaded] = useState(false);

  useEffect(() => {
    if (!isCameraOn || handLandmarkerRef.current) return;
    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
        );
        const tryCreate = async (delegate: 'GPU' | 'CPU') =>
          HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
              delegate,
            },
            runningMode: 'VIDEO',
            numHands: 1,
          });
        try {
          handLandmarkerRef.current = await tryCreate(isMobile ? 'CPU' : 'GPU');
        } catch {
          handLandmarkerRef.current = await tryCreate('CPU');
        }
        setModelLoaded(true);
      } catch (e) {
        console.error('HandLandmarker init error:', e);
      }
    };
    init();
  }, [isCameraOn, isMobile]);

  useEffect(() => {
    if (isCameraOn) {
      const startCamera = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: isMobile
              ? { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 360 } }
              : { width: 640, height: 480, frameRate: { ideal: 30 } },
          });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.addEventListener('loadeddata', predictWebcam);
          }
        } catch (err) {
          console.error('Camera error:', err);
        }
      };
      startCamera();
    } else {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.removeEventListener('loadeddata', predictWebcam);
      }
      if (requestRef.current) { cancelAnimationFrame(requestRef.current); requestRef.current = null; }
      lastStableGesture.current = 'Unknown';
      triggeredGestures.current.clear();
      onHandUpdate({ gesture: 'Unknown', handPosition: { x: 0.5, y: 0.5 } });
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isCameraOn]);

  const predictWebcam = () => {
    if (!isCameraOn) return;
    if (!videoRef.current || !canvasRef.current) return;
    if (!handLandmarkerRef.current) { requestRef.current = requestAnimationFrame(predictWebcam); return; }
    if (videoRef.current.readyState < 2) { requestRef.current = requestAnimationFrame(predictWebcam); return; }

    const now = performance.now();
    if (now - lastPredictionTime.current < 40) { requestRef.current = requestAnimationFrame(predictWebcam); return; }
    lastPredictionTime.current = now;

    const results = handLandmarkerRef.current.detectForVideo(videoRef.current, now);

    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      if (results.landmarks) {
        const du = new DrawingUtils(ctx);
        for (const lm of results.landmarks) {
          du.drawConnectors(lm, HandLandmarker.HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
          du.drawLandmarks(lm, { color: '#FF0000', lineWidth: 1 });
        }
      }
    }

    let gesture: GestureState['gesture'] = 'Unknown';
    let handPos = { x: 0.5, y: 0.5 };

    if (results.landmarks?.length) {
      const lm = results.landmarks[0];
      const wrist = lm[0];
      const mid9  = lm[9];
      handPos = { x: 1 - (wrist.x + mid9.x) / 2, y: (wrist.y + mid9.y) / 2 };

      const ext = (tip: number, pip: number) => {
        const dTip = Math.hypot(lm[tip].x - wrist.x, lm[tip].y - wrist.y);
        const dPip = Math.hypot(lm[pip].x - wrist.x, lm[pip].y - wrist.y);
        return dTip > dPip * 1.15;
      };

      const idx    = ext(8, 6);
      const mid    = ext(12, 10);
      const ring   = ext(16, 14);
      const pinky  = ext(20, 18);
      const count  = [idx, mid, ring, pinky].filter(Boolean).length;

      if (count === 0) gesture = 'Closed_Fist';
      else if (count >= 3) gesture = 'Open_Palm';
      else if (idx && !mid && !ring && !pinky) gesture = 'Pointing_Up';
    }

    onHandUpdate({ gesture, handPosition: handPos });

    // 手势锁定计时：稳定 1.2s 触发一次
    if (gesture !== 'Unknown' && gesture === lastStableGesture.current) {
      if (!triggeredGestures.current.has(gesture) && now - gestureHoldStart.current >= TRIGGER_HOLD_MS) {
        triggeredGestures.current.add(gesture);
        onGestureTrigger(gesture);
      }
    } else {
      lastStableGesture.current = gesture;
      gestureHoldStart.current  = now;
      triggeredGestures.current.clear();
    }

    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  return (
    <div className={`absolute top-4 right-4 w-32 h-24 border border-white/20 rounded-lg overflow-hidden transition-opacity z-50 ${isCameraOn ? 'opacity-50 hover:opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <video ref={videoRef} className="w-full h-full object-cover -scale-x-100" autoPlay playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full -scale-x-100" width={128} height={96} />
      {isCameraOn && !modelLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-[10px] text-white">AI 加载中…</div>
      )}
    </div>
  );
};

export default HandManager;
