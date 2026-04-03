import { useState, useEffect } from 'react';
import { motion } from 'motion/react';

export default function MathRush({ onScore, isPlaying, level }: any) {
  const [equation, setEquation] = useState('');
  const [options, setOptions] = useState<number[]>([]);
  const [correctAnswer, setCorrectAnswer] = useState(0);

  const generateRound = () => {
    const ops = ['+', '-', '*'];
    // Limit operators based on level
    const availableOps = level < 3 ? ['+', '-'] : ops;
    const op = availableOps[Math.floor(Math.random() * availableOps.length)];
    
    let a, b, ans;
    const maxNum = 10 * level;

    if (op === '+') {
      a = Math.floor(Math.random() * maxNum) + 1;
      b = Math.floor(Math.random() * maxNum) + 1;
      ans = a + b;
    } else if (op === '-') {
      a = Math.floor(Math.random() * maxNum) + 5;
      b = Math.floor(Math.random() * a); // Ensure positive result
      ans = a - b;
    } else {
      a = Math.floor(Math.random() * (5 + level)) + 2;
      b = Math.floor(Math.random() * 9) + 2;
      ans = a * b;
    }

    setEquation(`${a} ${op} ${b}`);
    setCorrectAnswer(ans);

    // Generate options
    const newOptions = new Set<number>([ans]);
    while (newOptions.size < 4) {
      const offset = Math.floor(Math.random() * 10) - 5;
      if (offset !== 0 && ans + offset >= 0) {
        newOptions.add(ans + offset);
      } else {
        newOptions.add(ans + Math.floor(Math.random() * 10) + 1);
      }
    }
    
    setOptions(Array.from(newOptions).sort(() => Math.random() - 0.5));
  };

  useEffect(() => {
    if (isPlaying) {
      generateRound();
    }
  }, [isPlaying, level]);

  const handleAnswer = (answer: number) => {
    if (answer === correctAnswer) {
      onScore(15 * level);
    } else {
      onScore(-5);
    }
    generateRound();
  };

  if (!isPlaying) return null;

  return (
    <div className="w-full flex flex-col items-center">
      <p className="text-gray-500 dark:text-gray-400 font-medium mb-8 uppercase tracking-widest text-sm transition-colors duration-300">Solve the equation</p>

      <motion.div 
        key={equation}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-6xl font-black text-gray-900 dark:text-white mb-12 tracking-tighter transition-colors duration-300"
      >
        {equation} = ?
      </motion.div>

      <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
        {options.map((opt, i) => (
          <button
            key={i}
            onClick={() => handleAnswer(opt)}
            className="py-6 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl font-bold text-2xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors active:scale-95 shadow-sm border border-indigo-100 dark:border-indigo-800"
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
