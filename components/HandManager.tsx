import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import { GestureState } from '../types';

interface HandManagerProps {
  onHandUpdate: (state: GestureState) => void;
  isCameraOn: boolean;
}

const HandManager: React.FC<HandManagerProps> = ({ onHandUpdate, isCameraOn }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastPredictionTime = useRef<number>(0);

  // Initialize MediaPipe (Load model once)
  useEffect(() => {
    const init = async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
      );
      
      handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1
      });
      setLoaded(true);
    };
    init();
  }, []);

  // Manage Camera Stream based on isCameraOn
  useEffect(() => {
    if (!loaded) return;

    if (isCameraOn) {
      const startCamera = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { ideal: 30 }
            } 
          });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.addEventListener('loadeddata', predictWebcam);
          }
        } catch (err) {
          console.error("Camera error:", err);
        }
      };
      startCamera();
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      onHandUpdate({
         gesture: 'Unknown',
         isPinching: false,
         handPosition: { x: 0.5, y: 0.5 }
      });
      const canvasCtx = canvasRef.current?.getContext('2d');
      if (canvasCtx && canvasRef.current) {
         canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isCameraOn, loaded]);

  // Prediction Loop
  const predictWebcam = () => {
    if (!isCameraOn) return; 
    if (!handLandmarkerRef.current || !videoRef.current || !canvasRef.current) return;
    
    if (videoRef.current.readyState < 2) {
       requestRef.current = requestAnimationFrame(predictWebcam);
       return;
    }

    const now = performance.now();
    if (now - lastPredictionTime.current < 50) {
        requestRef.current = requestAnimationFrame(predictWebcam);
        return;
    }
    lastPredictionTime.current = now;

    const startTimeMs = performance.now();
    const results = handLandmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);
    
    const canvasCtx = canvasRef.current.getContext('2d');
    if (canvasCtx) {
      canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
       if (results.landmarks) {
        const drawingUtils = new DrawingUtils(canvasCtx);
        for (const landmarks of results.landmarks) {
          drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 2 });
          drawingUtils.drawLandmarks(landmarks, { color: "#FF0000", lineWidth: 1 });
        }
      }
    }

    // Logic to determine gestures
    if (results.landmarks && results.landmarks.length > 0) {
      const landmarks = results.landmarks[0];
      const wrist = landmarks[0];
      const middleKnuckle = landmarks[9];
      const handX = 1 - ((wrist.x + middleKnuckle.x) / 2); // Mirror X
      const handY = (wrist.y + middleKnuckle.y) / 2;

      // 优化 1: 更严格的手指伸直检测
      // 使用指尖到手腕距离 vs PIP(第二关节)到手腕距离
      // 乘以 1.1 作为缓冲，防止半弯曲状态被判定为伸直
      const isFingerExtended = (tipIdx: number, pipIdx: number) => {
         const dTip = Math.hypot(landmarks[tipIdx].x - wrist.x, landmarks[tipIdx].y - wrist.y);
         const dPip = Math.hypot(landmarks[pipIdx].x - wrist.x, landmarks[pipIdx].y - wrist.y);
         return dTip > (dPip * 1.15); 
      };

      const thumbOpen = isFingerExtended(4, 2);
      const indexOpen = isFingerExtended(8, 6);
      const middleOpen = isFingerExtended(12, 10);
      const ringOpen = isFingerExtended(16, 14);
      const pinkyOpen = isFingerExtended(20, 18);

      // 计算除大拇指外伸直的手指数量
      const fingersOpenCount = [indexOpen, middleOpen, ringOpen, pinkyOpen].filter(Boolean).length;
      
      // 优化 2: 捏合检测 (Pinch) - 提高优先级
      // 食指尖(8) 与 拇指尖(4) 的距离
      const dPinch = Math.hypot(landmarks[8].x - landmarks[4].x, landmarks[8].y - landmarks[4].y);
      // 阈值设为 0.06，根据经验值微调
      const isPinching = dPinch < 0.06;

      let gesture: GestureState['gesture'] = 'Unknown';
      
      // 逻辑判定树 (互斥性增强)

      if (isPinching) {
        // 如果在捏合，强制不是 Closed_Fist。
        // 捏合时，手指可能弯曲，容易误判为拳头。
        // 这里我们不给 gesture 赋值 'Closed_Fist'，而是保持 Unknown 或其他
        // App.tsx 会根据 isPinching 状态进入 ZOOM 模式
        gesture = 'Unknown';
      } 
      else if (fingersOpenCount === 0 && !indexOpen && !isPinching) {
        // 握拳 (Closed Fist):
        // 1. 食指、中指、无名指、小指都必须弯曲 (fingersOpenCount === 0)
        // 2. 没有捏合 (!isPinching)
        // 3. 食指必须明确是弯曲的 (!indexOpen) - 双重保险
        gesture = 'Closed_Fist';
      }
      else if (fingersOpenCount >= 3) {
        // 张开手掌 (Open Palm):
        // 至少3根手指（不含大拇指）伸直。通常是4根。
        gesture = 'Open_Palm';
      }
      else if (indexOpen && !middleOpen && !ringOpen && !pinkyOpen) {
        // 向上指
        gesture = 'Pointing_Up';
      }
      
      onHandUpdate({
        gesture,
        isPinching,
        handPosition: { x: handX, y: handY }
      });
    }

    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  return (
    <div className={`absolute top-4 right-4 w-32 h-24 border border-white/20 rounded-lg overflow-hidden transition-opacity z-50 ${isCameraOn ? 'opacity-50 hover:opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <video ref={videoRef} className="w-full h-full object-cover transform -scale-x-100" autoPlay playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full transform -scale-x-100" width={128} height={96} />
    </div>
  );
};

export default HandManager;