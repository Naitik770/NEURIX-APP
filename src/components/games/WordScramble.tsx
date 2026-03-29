import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle, CheckCircle2, XCircle } from 'lucide-react';

const WORD_LISTS: Record<number, string[]> = {
  1: ['CAT', 'DOG', 'SUN', 'MAP', 'PEN', 'BOX', 'RED', 'BLUE', 'SKY', 'RUN'],
  2: ['BRAIN', 'FOCUS', 'MEMORY', 'LOGIC', 'TRAIN', 'SPEED', 'MATCH', 'LEVEL', 'GAME', 'PLAY'],
  3: ['COGNITIVE', 'NEURON', 'SYNAPSE', 'PLASTICITY', 'ATTENTION', 'PERCEPTION', 'ANALYSIS', 'STRATEGY', 'CREATIVE', 'INSIGHT'],
};

export default function WordScramble({ onScore, isPlaying, level }: { onScore: (points: number) => void, isPlaying: boolean, level: number }) {
  const [word, setWord] = useState('');
  const [scrambled, setScrambled] = useState('');
  const [guess, setGuess] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [hintUsed, setHintUsed] = useState(false);

  const getWordList = useCallback(() => {
    const difficulty = Math.min(3, Math.ceil(level / 10));
    return WORD_LISTS[difficulty] || WORD_LISTS[2];
  }, [level]);

  const scramble = (w: string) => {
    let s = w.split('').sort(() => Math.random() - 0.5).join('');
    while (s === w && w.length > 1) {
      s = w.split('').sort(() => Math.random() - 0.5).join('');
    }
    return s;
  };

  const nextWord = useCallback(() => {
    const list = getWordList();
    const newWord = list[Math.floor(Math.random() * list.length)];
    setWord(newWord);
    setScrambled(scramble(newWord));
    setGuess('');
    setHintUsed(false);
    setFeedback(null);
  }, [getWordList]);

  useEffect(() => {
    if (isPlaying) {
      nextWord();
    }
  }, [isPlaying, nextWord]);

  const checkGuess = () => {
    if (!guess) return;
    if (guess.toUpperCase() === word) {
      setFeedback('correct');
      const baseScore = word.length * 5;
      const finalScore = hintUsed ? Math.floor(baseScore / 2) : baseScore;
      onScore(finalScore);
      setTimeout(nextWord, 1000);
    } else {
      setFeedback('incorrect');
      setTimeout(() => setFeedback(null), 1000);
    }
  };

  const useHint = () => {
    if (hintUsed || !isPlaying) return;
    setHintUsed(true);
    setGuess(word[0]);
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-sm">
      <div className="flex flex-wrap justify-center gap-2">
        {scrambled.split('').map((char, i) => (
          <motion.div
            key={`${word}-${i}`}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.05 }}
            className="w-12 h-12 bg-white dark:bg-gray-800 rounded-xl shadow-md flex items-center justify-center text-2xl font-bold text-gray-800 dark:text-white border-2 border-orange-100 dark:border-gray-700"
          >
            {char}
          </motion.div>
        ))}
      </div>

      <div className="relative w-full">
        <input
          type="text"
          value={guess}
          onChange={(e) => setGuess(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && checkGuess()}
          className={`w-full text-2xl text-center p-4 rounded-2xl border-2 transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none ${
            feedback === 'correct' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' :
            feedback === 'incorrect' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' :
            'border-orange-200 dark:border-gray-700 focus:border-orange-500'
          }`}
          placeholder="Type your answer..."
          disabled={!isPlaying || feedback === 'correct'}
          autoFocus
        />
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="absolute right-4 top-1/2 -translate-y-1/2"
            >
              {feedback === 'correct' ? (
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              ) : (
                <XCircle className="w-8 h-8 text-red-500" />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex gap-4 w-full">
        <button 
          onClick={useHint}
          disabled={hintUsed || !isPlaying || feedback === 'correct'}
          className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          <HelpCircle className="w-5 h-5" /> Hint
        </button>
        <button 
          onClick={checkGuess}
          disabled={!isPlaying || feedback === 'correct'}
          className="flex-[2] py-4 bg-orange-500 text-white rounded-2xl font-bold text-lg hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/30 disabled:opacity-50"
        >
          Submit
        </button>
      </div>
    </div>
  );
}
