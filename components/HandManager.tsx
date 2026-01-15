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
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.addEventListener('loadeddata', predictWebcam);
          }
        } catch (err) {
          console.error("Camera error:", err);
          // You might want to notify parent about error here
        }
      };
      startCamera();
    } else {
      // Stop Camera
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
      // Reset hand state
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
    if (!isCameraOn) return; // Stop loop if turned off
    if (!handLandmarkerRef.current || !videoRef.current || !canvasRef.current) return;
    
    // Check if video is actually playing and has data
    if (videoRef.current.readyState < 2) {
       requestRef.current = requestAnimationFrame(predictWebcam);
       return;
    }

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

    // Logic to determine gestures (Same as before)
    if (results.landmarks && results.landmarks.length > 0) {
      const landmarks = results.landmarks[0];
      const wrist = landmarks[0];
      const middleKnuckle = landmarks[9];
      const handX = 1 - ((wrist.x + middleKnuckle.x) / 2); // Mirror X
      const handY = (wrist.y + middleKnuckle.y) / 2;

      const isFingerExtended = (tipIdx: number, pipIdx: number) => {
         const dTip = Math.hypot(landmarks[tipIdx].x - landmarks[0].x, landmarks[tipIdx].y - landmarks[0].y);
         const dPip = Math.hypot(landmarks[pipIdx].x - landmarks[0].x, landmarks[pipIdx].y - landmarks[0].y);
         return dTip > dPip;
      };

      const thumbOpen = isFingerExtended(4, 2);
      const indexOpen = isFingerExtended(8, 6);
      const middleOpen = isFingerExtended(12, 10);
      const ringOpen = isFingerExtended(16, 14);
      const pinkyOpen = isFingerExtended(20, 18);

      const openCount = [thumbOpen, indexOpen, middleOpen, ringOpen, pinkyOpen].filter(Boolean).length;
      const dPinch = Math.hypot(landmarks[8].x - landmarks[4].x, landmarks[8].y - landmarks[4].y);
      const isPinching = dPinch < 0.05;

      let gesture: GestureState['gesture'] = 'Unknown';
      
      if (openCount <= 1 && !isPinching) gesture = 'Closed_Fist';
      else if (openCount >= 4) gesture = 'Open_Palm';
      
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