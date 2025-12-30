
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { HandLandmarker } from "@mediapipe/tasks-vision";
import { initializeHandLandmarker } from '../services/visionService';
import { AudioService } from '../services/audioService';
import { 
  FruitType, Entity, TrailPoint, Particle, GameStats, FloatingText, Point, Vector 
} from '../types';
import { 
  FRUIT_TYPES, BOMB_TYPE, GRAVITY, INITIAL_DIFFICULTY, 
  FRUIT_RADIUS, SLICE_LIFETIME, FRUIT_COLORS, HARD_DIFFICULTY,
  WINNING_QUOTES, LOSING_QUOTES
} from '../constants';
import { Trophy, Play, RotateCcw, Loader2, Zap, Apple, Bomb, CameraOff } from 'lucide-react';

const GameCanvas: React.FC = () => {
  // Refs for game loop to avoid re-renders
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const requestRef = useRef<number>(0);
  const scoreRef = useRef<number>(0);
  const livesRef = useRef<number>(1);
  const lastTimeRef = useRef<number>(0); // For Delta Time
  const spawnTimerRef = useRef<number>(0);
  const entitiesRef = useRef<Entity[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const trailRef = useRef<TrailPoint[]>([]);
  const lastHandPosRef = useRef<{x: number, y: number} | null>(null);
  const lastSliceSoundTime = useRef<number>(0);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const shakeIntensityRef = useRef<number>(0); // Screen shake
  const statsRef = useRef<GameStats>({
    score: 0, highScore: 0, combos: 0, fruitsSliced: 0, bombsHit: 0, accuracy: 0, maxCombo: 0
  });
  
  // React State for UI
  const [gameState, setGameState] = useState<'LOADING' | 'MENU' | 'PLAYING' | 'GAMEOVER'>('LOADING');
  const [finalStats, setFinalStats] = useState<GameStats | null>(null);
  const [gameOverQuote, setGameOverQuote] = useState<string>('');
  const [videoStarted, setVideoStarted] = useState(false);
  const [currentCombo, setCurrentCombo] = useState(0);
  const [cameraError, setCameraError] = useState(false);
  const [retryTrigger, setRetryTrigger] = useState(0);
  
  // Live stats for the HUD panel
  const [hudStats, setHudStats] = useState({ score: 0, fruits: 0, maxCombo: 0 });
  
  const comboTimerRef = useRef<number>(0);

  // Setup Camera and Vision
  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      setCameraError(false);
      try {
        // High Performance constraints
        try {
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 1280 }, 
                    height: { ideal: 720 },
                    frameRate: { ideal: 60, min: 30 }
                } 
            });
        } catch (e) {
            console.warn("High quality camera failed, trying fallback...", e);
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }

        if (videoRef.current && stream) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadeddata = () => {
            setVideoStarted(true);
            initializeVision();
          };
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        setCameraError(true);
        setGameState('LOADING');
      }
    };

    const initializeVision = async () => {
      try {
        const landmarker = await initializeHandLandmarker();
        handLandmarkerRef.current = landmarker;
        setGameState('MENU');
      } catch (e) {
        console.error("Failed to load vision model", e);
      }
    };

    startCamera();
    
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (stream) {
          stream.getTracks().forEach(track => track.stop());
      }
      cancelAnimationFrame(requestRef.current);
    };
  }, [retryTrigger]);

  // --- Logic Helpers ---

  const spawnEntity = (width: number, height: number, difficulty: typeof INITIAL_DIFFICULTY) => {
    const isBomb = Math.random() < difficulty.bombChance;
    const type = isBomb ? BOMB_TYPE : FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
    
    const x = Math.random() * (width - 200) + 100;
    const y = height + 50;
    
    // Scale physics relative to screen height (baseline 1080p)
    const scaleFactor = height / 1080; 

    const targetX = width / 2 + (Math.random() * 300 - 150);
    // Increased flight time estimation to match the lower gravity and higher velocity
    const flightTime = 200 + Math.random() * 60; 
    
    const vx = ((targetX - x) / flightTime) * (1 + Math.random() * 0.2);
    const vy = -(Math.random() * (difficulty.maxSpeed - difficulty.minSpeed) + difficulty.minSpeed) * scaleFactor;

    entitiesRef.current.push({
      id: Math.random().toString(36).substr(2, 9),
      type,
      x,
      y,
      vx,
      vy,
      rotation: 0,
      rotationSpeed: (Math.random() - 0.5) * 0.15,
      radius: FRUIT_RADIUS * scaleFactor, 
      isSliced: false,
      scale: 1,
      opacity: 1,
      flash: 0
    });
  };

  const spawnFloatingText = (x: number, y: number, text: string, color: string) => {
    floatingTextsRef.current.push({
      id: Math.random().toString(),
      text,
      x,
      y,
      vx: (Math.random() - 0.5) * 2,
      vy: -3 - Math.random() * 2,
      life: 1.0,
      color,
      scale: 1
    });
  };

  const createExplosion = (
      x: number, y: number, color: string, isBomb: boolean, 
      directionAngle?: number, forceMagnitude?: number
  ) => {
    const particleCount = isBomb ? 50 : 25;
    
    for (let i = 0; i < particleCount; i++) {
      // Directional bias if slice info is provided
      let angle;
      if (!isBomb && directionAngle !== undefined) {
         // Cone spread around the slice direction
         const spread = 0.8; // ~45 degrees spread
         angle = directionAngle + (Math.random() - 0.5) * spread;
      } else {
         angle = Math.random() * Math.PI * 2;
      }

      // Base speed + force influence
      const baseSpeed = isBomb ? 30 : 15;
      const extraSpeed = forceMagnitude ? Math.min(forceMagnitude, 40) * 0.4 : 0;
      const speed = Math.random() * (baseSpeed + extraSpeed);
      
      const isStuck = !isBomb && Math.random() < 0.2; // 20% chance for juice to hit "lens"

      particlesRef.current.push({
        id: Math.random().toString(),
        type: isBomb ? 'SPARK' : 'JUICE',
        x: x,
        y: y,
        vx: isStuck ? 0 : Math.cos(angle) * speed,
        vy: isStuck ? 0 : Math.sin(angle) * speed,
        color: isBomb ? '#ffaa00' : color,
        life: isStuck ? 2.0 : 1.0, // Stuck particles last longer
        decay: isStuck ? 0.005 : (0.02 + Math.random() * 0.03),
        size: Math.random() * (isBomb ? 10 : 8) + 3,
        gravity: isStuck ? 0.05 : (isBomb ? 0.2 : 0.5), // Stuck particles drip slowly
        rotation: Math.random() * Math.PI,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        stuck: isStuck,
        scale: 1
      });
    }

    // Add core flash particle
    particlesRef.current.push({
      id: 'core-' + Math.random(),
      type: 'CORE',
      x,
      y,
      vx: 0,
      vy: 0,
      color: '#ffffff',
      life: 1.0,
      decay: 0.15,
      size: 80,
      gravity: 0,
      rotation: 0,
      rotationSpeed: 0,
      stuck: false,
      scale: 1
    });
  };

  const checkCollisions = (width: number, height: number, dt: number) => {
    if (trailRef.current.length < 2) return;

    const p1 = trailRef.current[trailRef.current.length - 2];
    const p2 = trailRef.current[trailRef.current.length - 1];

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy); // This is effectively pixels/frame velocity
    
    // Don't slice if moving too slow
    if (dist < 5) return;

    let scoreChanged = false;
    
    // Arrays to batch updates
    const entitiesToRemove: string[] = [];
    const entitiesToAdd: Entity[] = [];

    entitiesRef.current.forEach(entity => {
      // Ignore already sliced/fragments to avoid double cuts (simpler logic)
      if (entity.isSliced) return;

      const l2 = dist * dist;
      if (l2 === 0) return;
      
      let t = ((entity.x - p1.x) * dx + (entity.y - p1.y) * dy) / l2;
      t = Math.max(0, Math.min(1, t));
      
      const projX = p1.x + t * dx;
      const projY = p1.y + t * dy;
      
      const distToSegment = Math.hypot(entity.x - projX, entity.y - projY);

      if (distToSegment < entity.radius * 1.0) {
        
        // Bomb Logic
        if (entity.type === BOMB_TYPE) {
          AudioService.playBomb();
          createExplosion(entity.x, entity.y, '#fff', true);
          shakeIntensityRef.current = 45;
          livesRef.current = 0;
          statsRef.current.bombsHit++;
          entity.isSliced = true; // Just mark sliced to fade it, or remove it
          entity.flash = 1.0;
        } 
        // Fruit Logic
        else {
          AudioService.playSplat();
          const color = FRUIT_COLORS[entity.type];
          
          // Physics Calculations
          const sliceAngle = Math.atan2(dy, dx);
          
          // 1. Calculate Torque based on offset
          // Cross product (2D) of slice vector vs vector to entity center
          // Vector to center: (entity.x - p1.x, entity.y - p1.y)
          const v2x = entity.x - p1.x;
          const v2y = entity.y - p1.y;
          // Z-component of cross product (v1.x*v2.y - v1.y*v2.x)
          const crossZ = dx * v2y - dy * v2x;
          // Perp distance is crossZ / |v1|, but we use it for torque directly
          // Normalized offset (-1 to 1 relative to radius roughly)
          const offsetFactor = Math.max(-1, Math.min(1, crossZ / (dist * entity.radius)));
          
          createExplosion(entity.x, entity.y, color, false, sliceAngle, dist);
          
          scoreRef.current += 10;
          statsRef.current.score += 10;
          statsRef.current.fruitsSliced++;
          scoreChanged = true;
          
          spawnFloatingText(entity.x, entity.y - 50, "+10", "#fff");

          // Create 2 Fragments
          const createFragment = (side: number) => {
             // Side is 1 or -1
             const sepVelocity = 1.5; // separation speed
             const forwardImpulse = 0.2; // how much of the slice speed is transferred
             
             // Calculate perpendicular vector for separation
             const perpAngle = sliceAngle + Math.PI/2;
             
             const vxSep = Math.cos(perpAngle) * sepVelocity * side;
             const vySep = Math.sin(perpAngle) * sepVelocity * side;
             
             const vxImpulse = dx * forwardImpulse;
             const vyImpulse = dy * forwardImpulse;
             
             // Torque: A cut on the right (side 1) rotates clockwise? 
             // Physics check: Force applied at offset.
             // If I hit the top of a ball moving right: Ball spins clockwise.
             // Heuristic: Spin depends on offset and swipe speed.
             const spin = (offsetFactor * dist * 0.002) + (side * 0.05);

             const frag: Entity = {
                 ...entity,
                 id: entity.id + (side === 1 ? '-A' : '-B'),
                 isSliced: true,
                 isFragment: true,
                 sliceAngleRelative: sliceAngle - entity.rotation,
                 sliceSide: side,
                 vx: entity.vx + vxImpulse + vxSep,
                 vy: entity.vy + vyImpulse + vySep,
                 rotationSpeed: entity.rotationSpeed + spin,
                 // Reset flash for fragments
                 flash: 1.0 
             };
             return frag;
          };

          entitiesToAdd.push(createFragment(1));
          entitiesToAdd.push(createFragment(-1));
          entitiesToRemove.push(entity.id);

          // Combo System
          const now = Date.now();
          if (now - comboTimerRef.current < 400) {
            setCurrentCombo(prev => {
              const newCombo = prev + 1;
              statsRef.current.maxCombo = Math.max(statsRef.current.maxCombo, newCombo);
              if (newCombo > 1) {
                 AudioService.playCombo(newCombo);
                 const bonus = newCombo * 5;
                 scoreRef.current += bonus; 
                 statsRef.current.score += bonus;
                 shakeIntensityRef.current = Math.min(newCombo * 3, 15);
                 spawnFloatingText(entity.x, entity.y - 100, `${newCombo}x COMBO!`, "#ffff00");
              }
              return newCombo;
            });
          } else {
            setCurrentCombo(1);
          }
          comboTimerRef.current = now;
        }
      }
    });

    // Apply batch updates
    if (entitiesToRemove.length > 0) {
        entitiesRef.current = entitiesRef.current
            .filter(e => !entitiesToRemove.includes(e.id))
            .concat(entitiesToAdd);
    }

    if (scoreChanged) {
        setHudStats({
            score: scoreRef.current,
            fruits: statsRef.current.fruitsSliced,
            maxCombo: statsRef.current.maxCombo
        });
    }
  };

  const update = (dt: number, width: number, height: number) => {
    if (livesRef.current <= 0 && gameState === 'PLAYING') {
      if (shakeIntensityRef.current < 1) {
          endGame();
      }
    }

    if (shakeIntensityRef.current > 0) {
        // Smooth decay dependent on dt
        shakeIntensityRef.current *= Math.pow(0.9, dt * 60); 
        if (shakeIntensityRef.current < 0.5) shakeIntensityRef.current = 0;
    }

    const difficulty = scoreRef.current > 250 ? HARD_DIFFICULTY : INITIAL_DIFFICULTY;
    const timeScale = dt * 60; // Normalize physics to 60fps baseline

    spawnTimerRef.current += dt * 1000;
    if (spawnTimerRef.current > difficulty.spawnRate) {
      spawnEntity(width, height, difficulty);
      spawnTimerRef.current = 0;
    }

    // Entities
    entitiesRef.current.forEach(entity => {
      entity.x += entity.vx * timeScale;
      entity.y += entity.vy * timeScale;
      entity.vy += difficulty.gravity * timeScale;
      entity.rotation += entity.rotationSpeed * timeScale;

      if (entity.isSliced) {
         // Fragments fade out faster
         entity.opacity -= (entity.isFragment ? 0.03 : 0.02) * timeScale;
         if (!entity.isFragment) entity.scale += 0.01 * timeScale; // Only scale whole sliced items (bomb)
      }

      if (entity.flash > 0) {
          entity.flash -= 0.1 * timeScale;
      }
    });
    entitiesRef.current = entitiesRef.current.filter(e => e.opacity > 0 && e.y < height + 300);

    // Particles
    particlesRef.current.forEach(p => {
      if (p.stuck) {
        // Lens particles drift down slowly
        p.y += p.gravity * timeScale;
        p.life -= p.decay * timeScale;
        p.scale = 1 + Math.sin(Date.now() / 100) * 0.1; // Pulse effect
      } else {
        p.x += p.vx * timeScale;
        p.y += p.vy * timeScale;
        p.vy += p.gravity * timeScale;
        p.life -= p.decay * timeScale;
        p.vx *= 0.95;
        p.vy *= 0.95;
        p.rotation += p.rotationSpeed * timeScale;
      }
    });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);

    // Floating Text
    floatingTextsRef.current.forEach(ft => {
        ft.x += ft.vx * timeScale;
        ft.y += ft.vy * timeScale;
        ft.life -= 0.02 * timeScale;
        ft.scale += 0.01 * timeScale;
    });
    floatingTextsRef.current = floatingTextsRef.current.filter(ft => ft.life > 0);

    // Trail
    const now = Date.now();
    trailRef.current = trailRef.current.filter(p => now - p.timestamp < SLICE_LIFETIME);
  };

  const draw = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // 1. Shake Camera
    ctx.save();
    if (shakeIntensityRef.current > 0) {
        const dx = (Math.random() - 0.5) * shakeIntensityRef.current;
        const dy = (Math.random() - 0.5) * shakeIntensityRef.current;
        ctx.translate(dx, dy);
    }

    ctx.clearRect(-50, -50, width + 100, height + 100);

    // 2. Video Background
    if (videoRef.current && videoStarted) {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-width, 0);
      
      const vWidth = videoRef.current.videoWidth;
      const vHeight = videoRef.current.videoHeight;
      const scale = Math.max(width / vWidth, height / vHeight);
      const scaledW = vWidth * scale;
      const scaledH = vHeight * scale;
      const dx = (width - scaledW) / 2;
      const dy = (height - scaledH) / 2;

      ctx.globalAlpha = 0.5; 
      ctx.drawImage(videoRef.current, dx, dy, scaledW, scaledH);
      
      const gradient = ctx.createRadialGradient(width/2, height/2, height/3, width/2, height/2, height);
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      
      ctx.restore();
    }

    // 3. Particles
    particlesRef.current.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      if (!p.stuck) ctx.rotate(p.rotation);
      
      ctx.scale(p.scale, p.scale);

      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      
      if (p.type === 'CORE') {
         ctx.globalCompositeOperation = 'lighter';
         ctx.beginPath();
         ctx.arc(0, 0, p.size * p.life, 0, Math.PI * 2);
         ctx.fill();
      } else {
         // Juice Splats
         ctx.beginPath();
         if (p.stuck) {
             // Deform stuck particles to look like drips
             ctx.ellipse(0, 0, p.size, p.size * 1.5, 0, 0, Math.PI * 2);
         } else {
             ctx.arc(0, 0, p.size, 0, Math.PI * 2);
         }
         ctx.fill();
      }
      ctx.restore();
    });
    ctx.globalAlpha = 1;

    // 4. Entities
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    entitiesRef.current.forEach(entity => {
      ctx.save();
      ctx.translate(entity.x, entity.y);
      ctx.rotate(entity.rotation);
      ctx.scale(entity.scale, entity.scale);
      
      ctx.globalAlpha = entity.opacity;
      
      // Clipping logic for fragments
      if (entity.isFragment && entity.sliceAngleRelative !== undefined && entity.sliceSide !== undefined) {
         ctx.beginPath();
         // Create a semi-circle clip path
         // We orient the cut line horizontally for math simplicity then rotate context
         // But here, sliceAngleRelative is the angle of the cut line on the fruit
         // We want to keep the side defined by sliceSide
         // Side 1: [Angle, Angle + PI], Side -1: [Angle + PI, Angle + 2PI]
         
         const startAngle = entity.sliceAngleRelative + (entity.sliceSide === 1 ? 0 : Math.PI);
         ctx.arc(0, 0, entity.radius + 5, startAngle, startAngle + Math.PI);
         ctx.closePath();
         ctx.clip();
      }

      const fontSize = entity.radius * 2.5;
      ctx.font = `${fontSize}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 15;
      ctx.fillText(entity.type, 0, 0);
      ctx.shadowBlur = 0;
      
      // Draw flat surface for cut? (Optional, adds detail)
      if (entity.isFragment && entity.sliceAngleRelative !== undefined) {
          // Draw a line along the cut to make it look sealed
          ctx.strokeStyle = 'rgba(255,255,255,0.3)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(
              Math.cos(entity.sliceAngleRelative) * -entity.radius,
              Math.sin(entity.sliceAngleRelative) * -entity.radius
          );
          ctx.lineTo(
              Math.cos(entity.sliceAngleRelative) * entity.radius,
              Math.sin(entity.sliceAngleRelative) * entity.radius
          );
          ctx.stroke();
      }
      
      if (entity.flash > 0) {
          ctx.globalCompositeOperation = 'source-atop';
          ctx.fillStyle = `rgba(255, 255, 255, ${entity.flash})`;
          ctx.beginPath();
          ctx.arc(0, 0, entity.radius, 0, Math.PI*2);
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
      }

      ctx.restore();
    });

    // 5. Floating Text (Score/Combo)
    floatingTextsRef.current.forEach(ft => {
        ctx.save();
        ctx.translate(ft.x, ft.y);
        ctx.scale(ft.scale, ft.scale);
        ctx.globalAlpha = ft.life;
        
        ctx.font = "bold 40px 'Permanent Marker', cursive";
        ctx.fillStyle = ft.color;
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.strokeText(ft.text, 0, 0);
        ctx.fillText(ft.text, 0, 0);
        
        ctx.restore();
    });

    // 6. Blade Trail (Drawn last to be on top)
    if (trailRef.current.length > 2) {
      // Outer Glow
      ctx.shadowBlur = 25;
      ctx.shadowColor = '#00ffff'; // Cyan Neon
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Core Blade
      for (let i = 0; i < trailRef.current.length - 1; i++) {
          const p1 = trailRef.current[i];
          const p2 = trailRef.current[i+1];
          const progress = i / trailRef.current.length;
          
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          
          // Varying width
          ctx.lineWidth = progress * 10;
          ctx.strokeStyle = `rgba(255, 255, 255, ${progress})`;
          ctx.stroke();
          
          // Second pass for colored edge
          ctx.globalCompositeOperation = 'lighter';
          ctx.lineWidth = progress * 20;
          ctx.strokeStyle = `rgba(0, 255, 255, ${progress * 0.5})`;
          ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
      }
      ctx.shadowBlur = 0;
    }

    ctx.restore(); // Restore camera shake
  };

  const detectHand = (width: number, height: number) => {
    if (!handLandmarkerRef.current || !videoRef.current || !videoStarted) return;
    
    const now = performance.now();
    // No throttle here - run as fast as possible for high refresh monitors
    const result = handLandmarkerRef.current.detectForVideo(videoRef.current, now);

    if (result.landmarks && result.landmarks.length > 0) {
      const hand = result.landmarks[0];
      const indexTip = hand[8]; // Index finger tip
      
      const vWidth = videoRef.current.videoWidth;
      const vHeight = videoRef.current.videoHeight;
      const scale = Math.max(width / vWidth, height / vHeight);
      const scaledW = vWidth * scale;
      const scaledH = vHeight * scale;
      const dx = (width - scaledW) / 2;

      const rawX = width - (dx + indexTip.x * scaledW);
      const rawY = (height - scaledH) / 2 + indexTip.y * scaledH;

      let newX = rawX;
      let newY = rawY;

      if (lastHandPosRef.current) {
         // Smoother interpolation for 120hz
         const alpha = 0.5; 
         newX = lastHandPosRef.current.x + (rawX - lastHandPosRef.current.x) * alpha;
         newY = lastHandPosRef.current.y + (rawY - lastHandPosRef.current.y) * alpha;

         const dist = Math.hypot(newX - lastHandPosRef.current.x, newY - lastHandPosRef.current.y);
         if (dist > 10 && now - lastSliceSoundTime.current > 100) {
             AudioService.playSlice();
             lastSliceSoundTime.current = now;
         }
      }

      lastHandPosRef.current = { x: newX, y: newY };
      trailRef.current.push({ x: newX, y: newY, timestamp: Date.now() });
    } else {
        if (trailRef.current.length === 0) {
            lastHandPosRef.current = null;
        }
    }
  };

  const startGame = () => {
    AudioService.init();
    AudioService.playStart();
    
    scoreRef.current = 0;
    livesRef.current = 1;
    entitiesRef.current = [];
    particlesRef.current = [];
    floatingTextsRef.current = [];
    trailRef.current = [];
    lastHandPosRef.current = null;
    statsRef.current = { score: 0, highScore: 0, combos: 0, fruitsSliced: 0, bombsHit: 0, accuracy: 0, maxCombo: 0 };
    setHudStats({ score: 0, fruits: 0, maxCombo: 0 });
    shakeIntensityRef.current = 0;
    setGameState('PLAYING');
    setFinalStats(null);
    setGameOverQuote('');
    lastTimeRef.current = performance.now();
  };

  const endGame = () => {
    setGameState('GAMEOVER');
    setFinalStats({ ...statsRef.current });
    
    const score = statsRef.current.score;
    const quotes = score > 50 ? WINNING_QUOTES : LOSING_QUOTES;
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    setGameOverQuote(randomQuote);
  };

  // Main Loop - Fully Unlocked
  const renderFrame = useCallback(() => {
    const now = performance.now();
    // Calculate True Delta Time in seconds
    const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1); 
    lastTimeRef.current = now;

    const canvas = canvasRef.current;
    if (canvas) {
        const ctx = canvas.getContext('2d', { alpha: false });
        if (ctx) {
            const width = canvas.width;
            const height = canvas.height;

            if (gameState === 'PLAYING') {
              detectHand(width, height);
              checkCollisions(width, height, dt);
              update(dt, width, height);
            } else if (gameState === 'MENU' || gameState === 'GAMEOVER') {
              detectHand(width, height);
              if (particlesRef.current.length > 0 || floatingTextsRef.current.length > 0) {
                  update(dt, width, height); 
              }
            }

            draw(ctx, width, height);
        }
    }

    requestRef.current = requestAnimationFrame(renderFrame);
  }, [gameState, videoStarted]);

  useEffect(() => {
    lastTimeRef.current = performance.now();
    requestRef.current = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(requestRef.current);
  }, [renderFrame]);

  return (
    <div className="relative w-full h-screen bg-neutral-900 overflow-hidden flex flex-col items-center justify-center select-none">
      {/* Video Element (Hidden, used for processing) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute top-0 left-0 opacity-0 pointer-events-none"
        style={{ width: '1280px', height: '720px' }} 
      />

      {/* Main Game Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full object-cover block"
      />

      {/* UI Overlay */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        
        {/* HUD */}
        {gameState === 'PLAYING' && (
          <div className="absolute top-4 left-4 right-4 flex justify-between items-start text-white p-4">
            
            {/* Live Score Panel */}
            <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-xl p-4 min-w-[200px] shadow-[0_0_20px_rgba(0,0,0,0.5)] transform transition-transform hover:scale-105">
                <div className="flex flex-col gap-2">
                    <div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Current Score</span>
                    <div className="text-4xl font-marker text-yellow-400 leading-none drop-shadow-md">{hudStats.score}</div>
                    </div>
                    <div className="h-px bg-white/20 w-full my-1"></div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-300 font-semibold flex items-center gap-2">
                            <Apple className="w-4 h-4 text-green-400" /> Sliced
                        </span>
                        <span className="text-white font-bold font-mono text-lg">{hudStats.fruits}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-300 font-semibold flex items-center gap-2">
                             <Zap className="w-4 h-4 text-purple-400" /> Max Combo
                        </span>
                        <span className="text-white font-bold font-mono text-lg">{hudStats.maxCombo}</span>
                    </div>
                </div>
            </div>
            
            {/* Combo Indicator Center (Extra Flair) */}
            {currentCombo > 1 && (
               <div className="absolute top-24 left-1/2 transform -translate-x-1/2 text-center animate-bounce z-10 transition-all duration-100">
                  <div className="text-7xl font-marker text-transparent bg-clip-text bg-gradient-to-b from-purple-300 to-purple-600 drop-shadow-[0_0_25px_rgba(168,85,247,1)] stroke-white stroke-2">
                    {currentCombo}x
                  </div>
                  <div className="text-2xl font-bold text-purple-100 tracking-widest uppercase drop-shadow-lg">Combo!</div>
               </div>
            )}

            {/* Bomb Warning / Lives Replacement */}
            <div className="flex flex-col items-end">
                <div className="bg-red-500/20 backdrop-blur-md border border-red-500/50 rounded-lg px-4 py-2 flex items-center gap-2 animate-pulse">
                    <Bomb className="w-6 h-6 text-red-500" />
                    <span className="font-bold text-red-200 tracking-wider">AVOID BOMBS</span>
                </div>
            </div>
          </div>
        )}

        {/* LOADING Screen */}
        {gameState === 'LOADING' && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white backdrop-blur-sm">
            <Loader2 className="w-16 h-16 animate-spin text-green-500 mb-4" />
            <h1 className="text-3xl font-bold font-marker tracking-wider">PREPARING DOJO...</h1>
            <p className="mt-2 text-gray-400">Loading Vision Models & Camera</p>
          </div>
        )}

        {/* CAMERA ERROR Screen */}
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white backdrop-blur-sm z-50 pointer-events-auto">
            <div className="bg-neutral-800 p-8 rounded-xl border border-red-500 max-w-md text-center shadow-2xl">
                <CameraOff className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2 text-red-400">Camera Access Required</h2>
                <p className="text-gray-300 mb-6 leading-relaxed">
                    Zen Slice requires camera access to track your hand movements. 
                    <br/><br/>
                    <span className="text-sm text-gray-400">Please enable camera permissions in your browser address bar and try again.</span>
                </p>
                <button 
                  onClick={() => setRetryTrigger(prev => prev + 1)}
                  className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-all transform hover:scale-105 shadow-lg"
                >
                  Retry Access
                </button>
            </div>
          </div>
        )}

        {/* MENU Screen */}
        {gameState === 'MENU' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto">
            <div className="bg-neutral-800/90 p-12 rounded-2xl border-2 border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)] text-center max-w-lg">
              <h1 className="text-6xl font-marker text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600 mb-6 drop-shadow-sm">
                ZEN SLICE
              </h1>
              <p className="text-gray-300 mb-8 text-lg">
                Use your hand to slice fruits.<br/>
                Avoid the bombs.<br/>
                Become the master.
              </p>
              <button 
                onClick={startGame}
                className="group relative px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-bold text-xl rounded-full transition-all hover:scale-105 active:scale-95 shadow-lg flex items-center gap-3 mx-auto"
              >
                <Play className="w-6 h-6 fill-current" />
                START TRAINING
              </button>
            </div>
          </div>
        )}

        {/* GAME OVER Screen */}
        {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/80 backdrop-blur-md pointer-events-auto">
            <div className="bg-neutral-900 p-8 rounded-xl border border-red-500 shadow-2xl text-center max-w-xl w-full mx-4">
              <h2 className="text-5xl font-marker text-red-500 mb-2">GAME OVER</h2>
              <div className="grid grid-cols-2 gap-4 my-6 text-left bg-neutral-800 p-4 rounded-lg">
                <div className="flex flex-col items-center p-2">
                    <span className="text-gray-400 text-xs uppercase tracking-widest">Final Score</span>
                    <span className="text-3xl font-bold text-white">{finalStats?.score}</span>
                </div>
                <div className="flex flex-col items-center p-2">
                    <span className="text-gray-400 text-xs uppercase tracking-widest">Max Combo</span>
                    <span className="text-3xl font-bold text-purple-400">{finalStats?.maxCombo}</span>
                </div>
                <div className="flex flex-col items-center p-2 border-t border-neutral-700">
                    <span className="text-gray-400 text-xs uppercase tracking-widest">Fruits</span>
                    <span className="text-xl font-bold text-green-400">{finalStats?.fruitsSliced}</span>
                </div>
                <div className="flex flex-col items-center p-2 border-t border-neutral-700">
                    <span className="text-gray-400 text-xs uppercase tracking-widest">Bombs</span>
                    <span className="text-xl font-bold text-red-400">{finalStats?.bombsHit}</span>
                </div>
              </div>

              {/* Game Over Quote */}
              <div className="mb-8 min-h-[80px] flex items-center justify-center">
                 <div className="bg-white/5 border border-white/10 p-6 rounded-lg max-w-md w-full">
                    <p className="text-xl text-yellow-400 font-marker text-center italic tracking-wide">
                      "{gameOverQuote}"
                    </p>
                 </div>
              </div>

              <div className="flex gap-4 justify-center">
                <button 
                  onClick={startGame}
                  className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-all flex items-center gap-2"
                >
                  <RotateCcw className="w-5 h-5" />
                  TRY AGAIN
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
      
      {/* Mobile warning */}
      <div className="absolute bottom-4 text-xs text-gray-500 md:hidden">
        Best played on desktop with a webcam.
      </div>
    </div>
  );
};

export default GameCanvas;
