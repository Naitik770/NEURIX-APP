import { useState, useEffect } from 'react';
import { motion } from 'motion/react';

export default function ReactionTime({ onScore, isPlaying, level }: { onScore: (points: number) => void, isPlaying: boolean, level: number }) {
  const [isReady, setIsReady] = useState(false);
  const [startTime, setStartTime] = useState(0);

  useEffect(() => {
    if (isPlaying) {
      const timeout = setTimeout(() => {
        setIsReady(true);
        setStartTime(Date.now());
      }, Math.random() * 2000 + 1000);
      return () => clearTimeout(timeout);
    }
  }, [isPlaying]);

  const handleClick = () => {
    if (isReady) {
      const reactionTime = Date.now() - startTime;
      onScore(Math.max(0, 100 - reactionTime / 10));
      setIsReady(false);
      setTimeout(() => {
        setIsReady(true);
        setStartTime(Date.now());
      }, Math.random() * 2000 + 1000);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`w-48 h-48 rounded-full ${isReady ? 'bg-orange-500' : 'bg-gray-400'}`}
      disabled={!isPlaying}
    >
      {isReady ? 'CLICK!' : 'Wait...'}
    </button>
  );
}
