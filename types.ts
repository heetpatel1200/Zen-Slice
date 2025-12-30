
export interface Point {
  x: number;
  y: number;
}

export interface TrailPoint extends Point {
  timestamp: number;
}

export interface Vector {
  x: number;
  y: number;
}

export enum FruitType {
  APPLE = '🍎',
  PEAR = '🍐',
  ORANGE = '🍊',
  LEMON = '🍋',
  BANANA = '🍌',
  WATERMELON = '🍉',
  GRAPE = '🍇',
  STRAWBERRY = '🍓',
  PINEAPPLE = '🍍',
  MANGO = '🥭',
  PEACH = '🍑',
  CHERRY = '🍒',
  KIWI = '🥝',
  COCONUT = '🥥',
  MELON = '🍈',
  AVOCADO = '🥑',
  BOMB = '💣'
}

export interface Entity {
  id: string;
  type: FruitType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  radius: number;
  isSliced: boolean;
  scale: number;
  opacity: number;
  flash: number; // For hit effect
  // Fragment Props
  isFragment?: boolean;
  sliceAngleRelative?: number; 
  sliceSide?: number; // 1 or -1
}

export type ParticleType = 'JUICE' | 'SPARK' | 'CORE';

export interface Particle {
  id: string;
  type: ParticleType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number; // 0 to 1
  decay: number;
  size: number;
  gravity: number;
  // New visual props
  rotation: number;
  rotationSpeed: number;
  stuck: boolean; // If true, sticks to screen (lens effect)
  scale: number;
}

export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  scale: number;
}

export interface GameStats {
  score: number;
  highScore: number;
  combos: number;
  fruitsSliced: number;
  bombsHit: number;
  accuracy: number; // calculated field
  maxCombo: number;
}

export interface DifficultyConfig {
  gravity: number;
  minSpeed: number;
  maxSpeed: number;
  spawnRate: number; // ms between spawns
  bombChance: number;
}