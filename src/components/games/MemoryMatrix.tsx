import { useState, useEffect } from 'react';
import { motion } from 'motion/react';

export default function MemoryMatrix({ onScore, isPlaying, level }: any) {
  const [gridSize, setGridSize] = useState(3); // 3x3 initially
  const [activeTiles, setActiveTiles] = useState<number[]>([]);
  const [userTiles, setUserTiles] = useState<number[]>([]);
  const [phase, setPhase] = useState<'memorize' | 'recall' | 'result'>('memorize');

  const generateRound = (currentGridSize: number) => {
    const totalTiles = currentGridSize * currentGridSize;
    const numActive = Math.min(Math.floor(totalTiles * 0.4) + Math.floor(level / 2), totalTiles - 1);
    
    const newActive = new Set<number>();
    while (newActive.size < numActive) {
      newActive.add(Math.floor(Math.random() * totalTiles));
    }
    
    setActiveTiles(Array.from(newActive));
    setUserTiles([]);
    setPhase('memorize');

    setTimeout(() => {
      setPhase('recall');
    }, 2000 + (level * 200)); // Show for 2+ seconds
  };

  useEffect(() => {
    if (isPlaying) {
      const size = Math.min(3 + Math.floor((level - 1) / 3), 6);
      setGridSize(size); // Max 6x6
      generateRound(size);
    }
  }, [isPlaying, level]);

  const handleTileClick = (index: number) => {
    if (phase !== 'recall') return;
    
    if (userTiles.includes(index)) return;

    const newUserTiles = [...userTiles, index];
    setUserTiles(newUserTiles);

    if (!activeTiles.includes(index)) {
      // Wrong tile
      setPhase('result');
      onScore(-10);
      setTimeout(() => generateRound(gridSize), 1000);
    } else if (newUserTiles.length === activeTiles.length) {
      // All correct
      setPhase('result');
      onScore(20 * level);
      setTimeout(() => generateRound(gridSize), 1000);
    }
  };

  if (!isPlaying) return null;

  return (
    <div className="w-full flex flex-col items-center">
      <p className="text-gray-500 dark:text-gray-400 font-medium mb-8 uppercase tracking-widest text-sm h-6 transition-colors duration-300">
        {phase === 'memorize' ? 'Memorize the pattern' : phase === 'recall' ? 'Recall the pattern' : ''}
      </p>

      <div 
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: gridSize * gridSize }).map((_, i) => {
          const isActive = phase === 'memorize' ? activeTiles.includes(i) : false;
          const isSelected = userTiles.includes(i);
          const isCorrect = isSelected && activeTiles.includes(i);
          const isWrong = isSelected && !activeTiles.includes(i);
          const missed = phase === 'result' && activeTiles.includes(i) && !isSelected;

          let bgColor = 'bg-gray-200 dark:bg-gray-700';
          if (isActive) bgColor = 'bg-orange-500';
          else if (isCorrect) bgColor = 'bg-green-500';
          else if (isWrong) bgColor = 'bg-red-500';
          else if (missed) bgColor = 'bg-orange-300 dark:bg-orange-700';

          return (
            <motion.button
              key={i}
              whileTap={phase === 'recall' ? { scale: 0.9 } : {}}
              onClick={() => handleTileClick(i)}
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl ${bgColor} transition-colors duration-200`}
              disabled={phase !== 'recall'}
            />
          );
        })}
      </div>
    </div>
  );
}
