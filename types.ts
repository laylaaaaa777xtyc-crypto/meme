export enum AppMode {
  TREE   = 'TREE',
  LOVE   = 'LOVE',
  CAREER = 'CAREER',
  HEALTH = 'HEALTH',
}

export interface GestureState {
  gesture: 'Open_Palm' | 'Pointing_Up' | 'Closed_Fist' | 'Unknown';
  handPosition: { x: number; y: number };
}

export interface FortuneCard {
  type: 'love' | 'career' | 'health';
  text: string;
}

export interface DriftWish {
  id: string;
  text: string;
  hearts: number;
  x: number;        // 0-1, 水平位置
  duration: number; // 动画时长（秒）
}

export interface ApiWish {
  id: string;
  text: string;
  hearts: number;
  createdAt: number;
}
