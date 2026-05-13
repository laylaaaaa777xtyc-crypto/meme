export enum AppMode {
  TREE = 'TREE',       // Fist: Coalesce into tree
  CLOUD = 'CLOUD',     // Open Hand: Explode into particles
  ZOOM = 'ZOOM'        // Pinch: Inspect photo
}

export interface HandVector {
  x: number;
  y: number;
  z: number;
}

export interface GestureState {
  gesture: 'Closed_Fist' | 'Open_Palm' | 'Pointing_Up' | 'Unknown';
  isPinching: boolean;
  handPosition: { x: number; y: number }; // Normalized 0-1
}

export interface PhotoData {
  id: string;
  url: string;
  aspectRatio: number;
}

export interface WishOrb {
  id: string;
  x: number;   // normalized 0–1 (left → right)
  y: number;   // normalized 0–1 (top → bottom)
  wish: string;
  lightMessage: string;
}