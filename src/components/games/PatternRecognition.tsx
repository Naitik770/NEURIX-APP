import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export default function PatternRecognition({ onScore, isPlaying, level }: { onScore: (points: number) => void, isPlaying: boolean, level: number }) {
  const [pattern, setPattern] = useState<number[]>([]);
  const [userPattern, setUserPattern] = useState<number[]>([]);
  const [isShowingPattern, setIsShowingPattern] = useState(false);
  const [activeSquare, setActiveSquare] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);

  const generatePattern = useCallback(() => {
    const length = Math.min(8, 3 + Math.floor(level / 5));
    return Array.from({ length }, () => Math.floor(Math.random() * 9));
  }, [level]);

  const showPattern = useCallback(async (newPattern: number[]) => {
    setIsShowingPattern(true);
    setUserPattern([]);
    
    for (const squareIndex of newPattern) {
      setActiveSquare(squareIndex);
      await new Promise(resolve => setTimeout(resolve, 600));
      setActiveSquare(null);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    setIsShowingPattern(false);
  }, []);

  const startNewRound = useCallback(() => {
    const newPattern = generatePattern();
    setPattern(newPattern);
    showPattern(newPattern);
  }, [generatePattern, showPattern]);

  useEffect(() => {
    if (isPlaying) {
      startNewRound();
    } else {
      setPattern([]);
      setUserPattern([]);
      setIsShowingPattern(false);
      setActiveSquare(null);
    }
  }, [isPlaying, startNewRound]);

  const handleSquareClick = (index: number) => {
    if (!isPlaying || isShowingPattern || feedback) return;

    const newUserPattern = [...userPattern, index];
    setUserPattern(newUserPattern);
    setActiveSquare(index);
    setTimeout(() => setActiveSquare(null), 200);

    if (index !== pattern[userPattern.length]) {
      setFeedback('incorrect');
      setTimeout(() => {
        setFeedback(null);
        showPattern(pattern); // Re-show the same pattern on failure
      }, 1000);
      return;
    }

    if (newUserPattern.length === pattern.length) {
      setFeedback('correct');
      onScore(25 * level);
      setTimeout(() => {
        setFeedback(null);
        startNewRound();
      }, 1000);
    }
  };

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center h-8">
        <AnimatePresence mode="wait">
          {isShowingPattern ? (
            <motion.p key="watch" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-orange-500 font-bold">Watch the pattern...</motion.p>
          ) : feedback === 'correct' ? (
            <motion.p key="correct" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-green-500 font-bold">Perfect!</motion.p>
          ) : feedback === 'incorrect' ? (
            <motion.p key="incorrect" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-red-500 font-bold">Try again!</motion.p>
          ) : (
            <motion.p key="repeat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-gray-500 font-medium">Repeat the pattern</motion.p>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-3 gap-3 p-4 bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700">
        {Array.from({ length: 9 }).map((_, i) => (
          <motion.button
            key={i}
            whileTap={!isShowingPattern ? { scale: 0.9 } : {}}
            onClick={() => handleSquareClick(i)}
            className={`w-20 h-20 rounded-2xl transition-all duration-200 ${
              activeSquare === i ? 'bg-orange-500 shadow-lg shadow-orange-500/50 scale-105' : 
              'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
            } ${feedback === 'incorrect' && userPattern[userPattern.length - 1] === i ? 'bg-red-500' : ''}`}
            disabled={!isPlaying || isShowingPattern}
          />
        ))}
      </div>

      <div className="flex gap-1">
        {pattern.map((_, i) => (
          <div 
            key={i} 
            className={`w-2 h-2 rounded-full transition-colors ${
              i < userPattern.length ? 'bg-orange-500' : 'bg-gray-200 dark:bg-gray-700'
            }`} 
          />
        ))}
      </div>
    </div>
  );
}
