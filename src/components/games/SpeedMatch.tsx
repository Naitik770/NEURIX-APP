import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Star, Circle, Square, Triangle, Hexagon, Heart } from 'lucide-react';

const SHAPES = [Star, Circle, Square, Triangle, Hexagon, Heart];
const COLORS = ['text-blue-500', 'text-red-500', 'text-green-500', 'text-yellow-500', 'text-purple-500', 'text-orange-500'];

export default function SpeedMatch({ onScore, isPlaying, level }: any) {
  const [prevShape, setPrevShape] = useState<any>(null);
  const [currShape, setCurrShape] = useState<any>(null);
  const [prevColor, setPrevColor] = useState<string>('');
  const [currColor, setCurrColor] = useState<string>('');
  const [isMatch, setIsMatch] = useState(false);
  const [firstTurn, setFirstTurn] = useState(true);

  const generateRound = (previous: any, prevCol: string) => {
    const match = Math.random() > 0.5 && !firstTurn;
    setIsMatch(match);
    
    if (match && previous) {
      setCurrShape(() => previous);
      setCurrColor(prevCol);
    } else {
      let nextShape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
      let nextColor = COLORS[Math.floor(Math.random() * Math.min(level, COLORS.length))];
      
      while (previous && nextShape === previous && nextColor === prevCol) {
        nextShape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
        nextColor = COLORS[Math.floor(Math.random() * Math.min(level, COLORS.length))];
      }
      setCurrShape(() => nextShape);
      setCurrColor(nextColor);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      const initialShape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
      const initialColor = COLORS[0];
      setCurrShape(() => initialShape);
      setCurrColor(initialColor);
      setFirstTurn(true);
    }
  }, [isPlaying]);

  const handleAnswer = (answer: boolean) => {
    if (firstTurn) {
      setFirstTurn(false);
      setPrevShape(() => currShape);
      setPrevColor(currColor);
      generateRound(currShape, currColor);
      return;
    }

    if (answer === isMatch) {
      onScore(10 * level);
    } else {
      onScore(-5);
    }
    setPrevShape(() => currShape);
    setPrevColor(currColor);
    generateRound(currShape, currColor);
  };

  if (!isPlaying) return null;

  const ShapeIcon = currShape;

  return (
    <div className="w-full flex flex-col items-center">
      <p className="text-gray-500 dark:text-gray-400 font-medium mb-12 uppercase tracking-widest text-sm text-center transition-colors duration-300">
        {firstTurn ? 'Memorize this shape' : 'Does this match the PREVIOUS shape?'}
      </p>

      <div className="w-48 h-48 bg-white dark:bg-gray-800 rounded-3xl shadow-xl flex items-center justify-center mb-12 border border-transparent dark:border-gray-700 transition-colors duration-300">
        <motion.div
          key={currShape?.name + currColor + Math.random()}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          {ShapeIcon && <ShapeIcon className={`w-24 h-24 ${currColor}`} strokeWidth={2.5} />}
        </motion.div>
      </div>

      <div className="flex gap-6 w-full max-w-xs">
        {!firstTurn ? (
          <>
            <button
              onClick={() => handleAnswer(false)}
              className="flex-1 py-6 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl font-bold text-xl hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors active:scale-95"
            >
              No
            </button>
            <button
              onClick={() => handleAnswer(true)}
              className="flex-1 py-6 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-2xl font-bold text-xl hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors active:scale-95"
            >
              Yes
            </button>
          </>
        ) : (
          <button
            onClick={() => handleAnswer(true)}
            className="w-full py-6 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl font-bold text-xl hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors active:scale-95"
          >
            Got it!
          </button>
        )}
      </div>
    </div>
  );
}
