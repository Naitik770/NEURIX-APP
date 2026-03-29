import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Target, User } from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

export default function SpatialReasoning({ onScore, isPlaying, level }: { onScore: (points: number) => void, isPlaying: boolean, level: number }) {
  const [gridSize, setGridSize] = useState(4);
  const [target, setTarget] = useState<Point>({ x: 0, y: 0 });
  const [player, setPlayer] = useState<Point>({ x: 0, y: 0 });
  const [walls, setWalls] = useState<Point[]>([]);
  const [moves, setMoves] = useState(0);

  const isReachable = (start: Point, end: Point, size: number, currentWalls: Point[]) => {
    const queue: Point[] = [start];
    const visited = new Set([`${start.x},${start.y}`]);
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.x === end.x && current.y === end.y) return true;
      
      const neighbors = [
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1 },
        { x: current.x, y: current.y - 1 },
      ];
      
      for (const next of neighbors) {
        if (
          next.x >= 0 && next.x < size &&
          next.y >= 0 && next.y < size &&
          !visited.has(`${next.x},${next.y}`) &&
          !currentWalls.some(w => w.x === next.x && w.y === next.y)
        ) {
          visited.add(`${next.x},${next.y}`);
          queue.push(next);
        }
      }
    }
    return false;
  };

  const generateLevel = useCallback(() => {
    const size = Math.min(8, 4 + Math.floor(level / 5));
    setGridSize(size);
    
    let newTarget: Point;
    const newPlayer = { x: 0, y: 0 };
    let newWalls: Point[] = [];
    let attempts = 0;
    let solvable = false;

    while (!solvable && attempts < 50) {
      attempts++;
      newTarget = {
        x: Math.floor(Math.random() * size),
        y: Math.floor(Math.random() * size)
      };
      
      if (newTarget.x === 0 && newTarget.y === 0) {
        newTarget.x = size - 1;
        newTarget.y = size - 1;
      }

      newWalls = [];
      const wallCount = Math.floor((size * size) * 0.2);
      
      for (let i = 0; i < wallCount; i++) {
        const wall = {
          x: Math.floor(Math.random() * size),
          y: Math.floor(Math.random() * size)
        };
        
        const isReserved = (wall.x === newPlayer.x && wall.y === newPlayer.y) ||
                           (wall.x === newTarget.x && wall.y === newTarget.y) ||
                           newWalls.some(w => w.x === wall.x && w.y === wall.y);
        
        if (!isReserved) {
          newWalls.push(wall);
        }
      }

      if (isReachable(newPlayer, newTarget, size, newWalls)) {
        solvable = true;
        setTarget(newTarget);
        setPlayer(newPlayer);
        setWalls(newWalls);
      }
    }

    setMoves(0);
  }, [level]);

  useEffect(() => {
    if (isPlaying) {
      generateLevel();
    }
  }, [isPlaying, generateLevel]);

  const movePlayer = useCallback((dx: number, dy: number) => {
    if (!isPlaying) return;
    
    const newX = player.x + dx;
    const newY = player.y + dy;

    // Boundary check
    if (newX < 0 || newX >= gridSize || newY < 0 || newY >= gridSize) return;

    // Wall check
    if (walls.some(w => w.x === newX && w.y === newY)) return;

    setPlayer({ x: newX, y: newY });
    setMoves(prev => prev + 1);

    // Check if reached target
    if (newX === target.x && newY === target.y) {
      // Bonus for efficiency
      const minMoves = Math.abs(target.x - 0) + Math.abs(target.y - 0);
      const efficiencyBonus = Math.max(0, 10 - (moves - minMoves));
      onScore(20 + efficiencyBonus);
      setTimeout(generateLevel, 100); // Small delay for animation
    }
  }, [isPlaying, player, gridSize, walls, target, moves, onScore, generateLevel]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying) return;
      switch (e.key) {
        case 'ArrowUp': 
          e.preventDefault();
          movePlayer(0, -1); 
          break;
        case 'ArrowDown': 
          e.preventDefault();
          movePlayer(0, 1); 
          break;
        case 'ArrowLeft': 
          e.preventDefault();
          movePlayer(-1, 0); 
          break;
        case 'ArrowRight': 
          e.preventDefault();
          movePlayer(1, 0); 
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, movePlayer]);

  return (
    <div className="flex flex-col items-center gap-4 sm:gap-8 w-full">
      <div 
        className="grid gap-1 p-2 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 w-full"
        style={{ 
          gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
          maxWidth: 'min(85vw, 400px, 45vh)',
          aspectRatio: '1/1'
        }}
      >
        {Array.from({ length: gridSize * gridSize }).map((_, i) => {
          const x = i % gridSize;
          const y = Math.floor(i / gridSize);
          const isPlayer = x === player.x && y === player.y;
          const isTarget = x === target.x && y === target.y;
          const isWall = walls.some(w => w.x === x && w.y === y);

          return (
            <div 
              key={`${x}-${y}`} 
              className={`relative rounded-lg flex items-center justify-center transition-colors duration-200 ${
                isWall ? 'bg-gray-300 dark:bg-gray-600' : 'bg-gray-50 dark:bg-gray-700/50'
              }`}
            >
              {isTarget && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="text-orange-500"
                >
                  <Target className="w-2/3 h-2/3 mx-auto" />
                </motion.div>
              )}
              {isPlayer && (
                <motion.div
                  layoutId="player"
                  className="absolute inset-1 bg-orange-500 rounded-md flex items-center justify-center text-white shadow-lg z-10"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                >
                  <User className="w-3/4 h-3/4" />
                </motion.div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div />
        <ControlButton onClick={() => movePlayer(0, -1)} icon={ChevronUp} />
        <div />
        <ControlButton onClick={() => movePlayer(-1, 0)} icon={ChevronLeft} />
        <div className="w-12 h-12 sm:w-14 sm:h-14" />
        <ControlButton onClick={() => movePlayer(1, 0)} icon={ChevronRight} />
        <div />
        <ControlButton onClick={() => movePlayer(0, 1)} icon={ChevronDown} />
        <div />
      </div>
      
      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-widest">
        Use arrows or buttons to navigate
      </p>
    </div>
  );
}

function ControlButton({ onClick, icon: Icon }: { onClick: () => void, icon: any }) {
  return (
    <button
      onClick={onClick}
      className="w-12 h-12 sm:w-14 sm:h-14 bg-white dark:bg-gray-800 rounded-2xl shadow-md flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-all border border-gray-100 dark:border-gray-700"
    >
      <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-gray-600 dark:text-gray-300" />
    </button>
  );
}
