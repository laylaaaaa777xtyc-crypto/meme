import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import { GestureState } from '../types';

interface HandManagerProps {
  onHandUpdate: (state: GestureState) => void;
  isCameraOn: boolean;
  isMobile?: boolean;
}

const HandManager: React.FC<HandManagerProps> = ({ onHandUpdate, isCameraOn, isMobile = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastPredictionTime = useRef<number>(0);
  const [modelLoaded, setModelLoaded] = useState(false);

  // Initialize MediaPipe lazily — only when camera is first turned on
  useEffect(() => {
    if (!isCameraOn || handLandmarkerRef.current) return;
    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        const tryCreate = async (delegate: "GPU" | "CPU") =>
          HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
              delegate,
            },
            runningMode: "VIDEO",
            numHands: 1,
          });

        try {
          handLandmarkerRef.current = await tryCreate(isMobile ? "CPU" : "GPU");
        } catch {
          handLandmarkerRef.current = await tryCreate("CPU");
        }
        setModelLoaded(true);
      } catch (e) {
        console.error("Error loading MediaPipe model:", e);
      }
    };
    init();
  }, [isCameraOn]);

  // Manage Camera Stream based on isCameraOn
  // IMPROVED: Do NOT wait for modelLoaded here. Open camera immediately when user requests.
  useEffect(() => {
    if (isCameraOn) {
      const startCamera = async () => {
        try {
          // Use standard resolution for faster startup
          const stream = await navigator.mediaDevices.getUserMedia({
            video: isMobile
              ? { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 360 } }
              : { width: 640, height: 480, frameRate: { ideal: 30 } },
          });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            // The 'loadeddata' event will trigger the prediction loop
            // The prediction loop will simply do nothing until the model is ready
            videoRef.current.addEventListener('loadeddata', predictWebcam);
          }
        } catch (err) {
          console.error("Camera error:", err);
        }
      };
      startCamera();
    } else {
      // Cleanup logic
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.removeEventListener('loadeddata', predictWebcam);
      }
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
      
      // Reset state
      onHandUpdate({
         gesture: 'Unknown',
         isPinching: false,
         handPosition: { x: 0.5, y: 0.5 }
      });
      
      // Clear canvas
      const canvasCtx = canvasRef.current?.getContext('2d');
      if (canvasCtx && canvasRef.current) {
         canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }

    return () => {
      // Cleanup on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isCameraOn]); // Dependency is ONLY isCameraOn, not modelLoaded

  // Prediction Loop
  const predictWebcam = () => {
    if (!isCameraOn) return; 
    if (!videoRef.current || !canvasRef.current) return;
    
    // If model isn't loaded yet, keep looping but don't process. 
    // This allows the camera to be visible while the "brain" loads.
    if (!handLandmarkerRef.current) {
      requestRef.current = requestAnimationFrame(predictWebcam);
      return;
    }

    // Ensure video is playing and has data
    if (videoRef.current.readyState < 2) {
       requestRef.current = requestAnimationFrame(predictWebcam);
       return;
    }

    const now = performance.now();
    if (now - lastPredictionTime.current < 40) { // Approx 25fps cap for performance
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

      // Finger Extension Logic
      const isFingerExtended = (tipIdx: number, pipIdx: number) => {
         const dTip = Math.hypot(landmarks[tipIdx].x - wrist.x, landmarks[tipIdx].y - wrist.y);
         const dPip = Math.hypot(landmarks[pipIdx].x - wrist.x, landmarks[pipIdx].y - wrist.y);
         return dTip > (dPip * 1.15); 
      };

      const indexOpen = isFingerExtended(8, 6);
      const middleOpen = isFingerExtended(12, 10);
      const ringOpen = isFingerExtended(16, 14);
      const pinkyOpen = isFingerExtended(20, 18);

      const fingersOpenCount = [indexOpen, middleOpen, ringOpen, pinkyOpen].filter(Boolean).length;
      
      // Pinch Detection
      const dPinch = Math.hypot(landmarks[8].x - landmarks[4].x, landmarks[8].y - landmarks[4].y);
      const isPinching = dPinch < 0.06;

      let gesture: GestureState['gesture'] = 'Unknown';
      
      if (isPinching) {
        gesture = 'Unknown';
      } 
      else if (fingersOpenCount === 0 && !indexOpen && !isPinching) {
        gesture = 'Closed_Fist';
      }
      else if (fingersOpenCount >= 3) {
        gesture = 'Open_Palm';
      }
      else if (indexOpen && !middleOpen && !ringOpen && !pinkyOpen) {
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
      {/* Loading Indicator for Model */}
      {isCameraOn && !modelLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-[10px] text-white">
          AI Loading...
        </div>
      )}
    </div>
  );
};

export default HandManager;