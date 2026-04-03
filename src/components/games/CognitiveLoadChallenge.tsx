import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, Zap, AlertCircle } from 'lucide-react';

interface CognitiveLoadChallengeProps {
  onScore: (points: number) => void;
  isPlaying: boolean;
  level: number;
}

export default function CognitiveLoadChallenge({ onScore, isPlaying, level }: CognitiveLoadChallengeProps) {
  const [mathProblem, setMathProblem] = useState({ a: 0, b: 0, op: '+', answer: 0 });
  const [colorTask, setColorTask] = useState({ text: '', color: '', isMatch: false });
  const [activeTask, setActiveTask] = useState<'math' | 'color'>('math');
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [distraction, setDistraction] = useState<string | null>(null);

  const generateMath = useCallback(() => {
    const a = Math.floor(Math.random() * (10 + level));
    const b = Math.floor(Math.random() * (10 + level));
    const ops = ['+', '-'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    const answer = op === '+' ? a + b : a - b;
    setMathProblem({ a, b, op, answer });
  }, [level]);

  const generateColor = useCallback(() => {
    const colors = ['Red', 'Blue', 'Green', 'Yellow'];
    const colorValues = ['text-red-500', 'text-blue-500', 'text-green-500', 'text-yellow-500'];
    const textIdx = Math.floor(Math.random() * colors.length);
    const colorIdx = Math.floor(Math.random() * colors.length);
    const isMatch = textIdx === colorIdx;
    setColorTask({ 
      text: colors[textIdx], 
      color: colorValues[colorIdx],
      isMatch 
    });
  }, []);

  useEffect(() => {
    if (isPlaying) {
      generateMath();
      generateColor();
    }
  }, [isPlaying, generateMath, generateColor]);

  // Distractions logic
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        const distractions = ['FOCUS!', 'HURRY!', 'WATCH OUT!', 'SWITCH!'];
        setDistraction(distractions[Math.floor(Math.random() * distractions.length)]);
        setTimeout(() => setDistraction(null), 1000);
      }
      // Randomly switch active task
      if (Math.random() > 0.8) {
        setActiveTask(prev => prev === 'math' ? 'color' : 'math');
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const handleMathAnswer = (val: number) => {
    if (activeTask !== 'math') {
      onScore(-2);
      setFeedback('wrong');
      setTimeout(() => setFeedback(null), 500);
      return;
    }

    if (val === mathProblem.answer) {
      onScore(10);
      setFeedback('correct');
      generateMath();
    } else {
      onScore(-5);
      setFeedback('wrong');
    }
    setTimeout(() => setFeedback(null), 500);
  };

  const handleColorAnswer = (match: boolean) => {
    if (activeTask !== 'color') {
      onScore(-2);
      setFeedback('wrong');
      setTimeout(() => setFeedback(null), 500);
      return;
    }

    if (match === colorTask.isMatch) {
      onScore(10);
      setFeedback('correct');
      generateColor();
    } else {
      onScore(-5);
      setFeedback('wrong');
    }
    setTimeout(() => setFeedback(null), 500);
  };

  if (!isPlaying) return null;

  return (
    <div className="w-full max-w-md space-y-8 relative">
      {/* Distraction Overlay */}
      <AnimatePresence>
        {distraction && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1.5 }}
            exit={{ opacity: 0, scale: 2 }}
            className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
          >
            <span className="text-4xl font-black text-red-500/40 uppercase tracking-widest">{distraction}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task Indicator */}
      <div className="flex justify-center gap-4 mb-4">
        <div className={`px-4 py-2 rounded-full flex items-center gap-2 transition-all ${activeTask === 'math' ? 'bg-blue-500 text-white scale-110 shadow-lg' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
          <Brain className="w-4 h-4" />
          <span className="text-sm font-bold">Math Task</span>
        </div>
        <div className={`px-4 py-2 rounded-full flex items-center gap-2 transition-all ${activeTask === 'color' ? 'bg-purple-500 text-white scale-110 shadow-lg' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
          <Zap className="w-4 h-4" />
          <span className="text-sm font-bold">Color Task</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Math Panel */}
        <motion.div 
          animate={{ 
            opacity: activeTask === 'math' ? 1 : 0.3,
            scale: activeTask === 'math' ? 1 : 0.95,
            filter: activeTask === 'math' ? 'blur(0px)' : 'blur(2px)'
          }}
          className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border-2 border-blue-100 dark:border-blue-900/30 text-center"
        >
          <p className="text-4xl font-bold text-gray-900 dark:text-white mb-6">
            {mathProblem.a} {mathProblem.op} {mathProblem.b} = ?
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[mathProblem.answer - 2, mathProblem.answer, mathProblem.answer + 3].sort(() => Math.random() - 0.5).map((val, i) => (
              <button
                key={i}
                onClick={() => handleMathAnswer(val)}
                className="py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl font-bold hover:bg-blue-100 transition-colors"
              >
                {val}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Color Panel */}
        <motion.div 
          animate={{ 
            opacity: activeTask === 'color' ? 1 : 0.3,
            scale: activeTask === 'color' ? 1 : 0.95,
            filter: activeTask === 'color' ? 'blur(0px)' : 'blur(2px)'
          }}
          className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border-2 border-purple-100 dark:border-purple-900/30 text-center"
        >
          <p className={`text-4xl font-black mb-6 ${colorTask.color}`}>
            {colorTask.text}
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => handleColorAnswer(true)}
              className="flex-1 py-4 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-colors"
            >
              Match
            </button>
            <button
              onClick={() => handleColorAnswer(false)}
              className="flex-1 py-4 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors"
            >
              No Match
            </button>
          </div>
        </motion.div>
      </div>

      {/* Feedback Overlay */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
          >
            <div className={`p-4 rounded-full ${feedback === 'correct' ? 'bg-green-500' : 'bg-red-500'} text-white shadow-lg`}>
              {feedback === 'correct' ? <Zap className="w-12 h-12" /> : <AlertCircle className="w-12 h-12" />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-2xl border border-orange-100 dark:border-orange-900/30">
        <p className="text-xs text-orange-700 dark:text-orange-400 font-medium text-center">
          💡 Only answer the <span className="font-bold underline">Active Task</span> (highlighted). 
          Answering the inactive task or getting it wrong will deduct points!
        </p>
      </div>
    </div>
  );
}
