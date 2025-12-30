import { FruitType, DifficultyConfig } from './types';

export const FRUIT_TYPES = [
  FruitType.APPLE,
  FruitType.PEAR,
  FruitType.ORANGE,
  FruitType.LEMON,
  FruitType.BANANA,
  FruitType.WATERMELON,
  FruitType.GRAPE,
  FruitType.STRAWBERRY,
  FruitType.PINEAPPLE,
  FruitType.MANGO,
  FruitType.PEACH,
  FruitType.CHERRY,
  FruitType.KIWI,
  FruitType.COCONUT,
  FruitType.MELON,
  FruitType.AVOCADO,
];

export const BOMB_TYPE = FruitType.BOMB;

// Game Physics
export const GRAVITY = 0.4; // Base gravity reference (unused in difficulty)
export const DRAG = 0.99;
export const FRUIT_RADIUS = 35;
export const SLICE_LIFETIME = 250; // ms
export const SLICE_MIN_VELOCITY = 10; // pixels per frame

// Colors for particles based on fruit
export const FRUIT_COLORS: Record<string, string> = {
  '🍎': '#ff4d4d',
  '🍐': '#99cc00',
  '🍊': '#ffad33',
  '🍋': '#ffff66',
  '🍌': '#ffe135',
  '🍉': '#ff6666',
  '🍇': '#9933ff',
  '🍓': '#ff0066',
  '🍍': '#ffff00',
  '🥭': '#ffcc00',
  '🍑': '#ff9966',
  '🍒': '#cc0000',
  '🥝': '#66cc00',
  '🥥': '#e6e6e6',
  '🍈': '#99ff99',
  '🥑': '#ccff66',
  '💣': '#333333',
};

export const INITIAL_DIFFICULTY: DifficultyConfig = {
  gravity: 0.15, // Lower gravity for floaty, long jumps
  minSpeed: 14,  // Reduced launch speed
  maxSpeed: 19,
  spawnRate: 1400, // Slower spawn rate
  bombChance: 0.1,
};

export const HARD_DIFFICULTY: DifficultyConfig = {
  gravity: 0.22,
  minSpeed: 18,
  maxSpeed: 24,
  spawnRate: 900,
  bombChance: 0.2,
};

export const WINNING_QUOTES = [
  "Sharp blade, sharper mind!",
  "A glorious harvest!",
  "Your reflexes are legendary!",
  "The fruits fear your name!",
  "Precision and power in perfect harmony!",
  "True mastery achieved!",
  "You flow like water, slice like steel."
];

export const LOSING_QUOTES = [
  "Mind the explosives, young grasshopper.",
  "Chaos is the enemy of the ninja.",
  "Focus on the fruit, ignore the distractions.",
  "A dull blade cuts nothing but hope. Try again.",
  "Victory requires patience, not just speed.",
  "The bomb is not a fruit. Remember this.",
  "Fall down seven times, stand up eight."
];