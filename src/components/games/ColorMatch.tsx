import { useState, useEffect } from 'react';
import { motion } from 'motion/react';

const COLORS = [
  { name: 'Red', hex: '#EF4444' },
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Green', hex: '#10B981' },
  { name: 'Yellow', hex: '#F59E0B' },
  { name: 'Purple', hex: '#8B5CF6' },
  { name: 'Orange', hex: '#F97316' }
];

export default function ColorMatch({ onScore, isPlaying, level }: any) {
  const [meaning, setMeaning] = useState(COLORS[0]);
  const [textColor, setTextColor] = useState(COLORS[0]);
  const [isMatch, setIsMatch] = useState(true);

  const generateRound = () => {
    const match = Math.random() > 0.5;
    setIsMatch(match);
    
    // Scale number of colors based on level
    const availableColors = COLORS.slice(0, Math.min(2 + Math.floor(level / 2), COLORS.length));
    const meaningColor = availableColors[Math.floor(Math.random() * availableColors.length)];
    setMeaning(meaningColor);

    if (match) {
      setTextColor(meaningColor);
    } else {
      let otherColor = availableColors[Math.floor(Math.random() * availableColors.length)];
      while (otherColor.name === meaningColor.name) {
        otherColor = availableColors[Math.floor(Math.random() * availableColors.length)];
      }
      setTextColor(otherColor);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      generateRound();
    }
  }, [isPlaying]);

  const handleAnswer = (answer: boolean) => {
    if (answer === isMatch) {
      onScore(10 * level);
    } else {
      onScore(-5);
    }
    generateRound();
  };

  if (!isPlaying) return null;

  return (
    <div className="w-full flex flex-col items-center">
      <div className="text-center mb-12">
        <p className="text-gray-500 dark:text-gray-400 font-medium mb-4 uppercase tracking-widest text-sm transition-colors duration-300">Does the meaning match the text color?</p>
        <motion.h2 
          key={meaning.name + textColor.hex}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-6xl font-black uppercase tracking-tight"
          style={{ color: textColor.hex }}
        >
          {meaning.name}
        </motion.h2>
      </div>

      <div className="flex gap-6 w-full max-w-xs">
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
      </div>
    </div>
  );
}
