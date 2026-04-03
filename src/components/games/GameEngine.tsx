import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Play, RotateCcw, Trophy } from 'lucide-react';
import ColorMatch from './ColorMatch';
import MemoryMatrix from './MemoryMatrix';
import SpeedMatch from './SpeedMatch';
import MathRush from './MathRush';
import WordScramble from './WordScramble';
import PatternRecognition from './PatternRecognition';
import SpatialReasoning from './SpatialReasoning';
import ReactionTime from './ReactionTime';
import LogicFlow from './LogicFlow';
import CognitiveLoadChallenge from './CognitiveLoadChallenge';
import { doc, updateDoc, increment, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../App';

export default function GameEngine({ game, onClose, onComplete }: any) {
  const { profile } = useAuth();
  const [gameState, setGameState] = useState<'intro' | 'playing' | 'gameover'>('intro');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (gameState === 'playing' && timeLeft > 0) {
      timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && gameState === 'playing') {
      setGameState('gameover');
    }
    return () => clearTimeout(timer);
  }, [gameState, timeLeft]);

  const startGame = () => {
    setScore(0);
    setTimeLeft(60);
    setGameState('playing');
  };

  const handleScore = (points: number) => {
    setScore(prev => prev + points);
  };

  const [claiming, setClaiming] = useState(false);

  const claimXP = async () => {
    if (profile?.uid && !claiming) {
      setClaiming(true);
      const xpEarned = Math.max(10, Math.floor(score / 5)); // Minimum 10 XP
      try {
        const userRef = doc(db, 'users', profile.uid);
        await updateDoc(userRef, {
          xp: increment(xpEarned)
        });

        const sessionsRef = collection(db, 'users', profile.uid, 'gameSessions');
        await addDoc(sessionsRef, {
          uid: profile.uid,
          gameId: game.id.toString(),
          category: game.category,
          score: score,
          xpEarned: xpEarned,
          playedAt: serverTimestamp()
        });

        onComplete(xpEarned);
      } catch (error) {
        console.error("Error updating XP or saving session:", error);
        setClaiming(false);
      }
    }
    onClose();
  };

  const renderGame = () => {
    const commonProps = {
      onScore: handleScore,
      isPlaying: gameState === 'playing',
      level: game.level || 1
    };

    switch (game.type) {
      case 'Color Match':
        return <ColorMatch {...commonProps} />;
      case 'Memory Matrix':
        return <MemoryMatrix {...commonProps} />;
      case 'Speed Match':
        return <SpeedMatch {...commonProps} />;
      case 'Math Rush':
        return <MathRush {...commonProps} />;
      case 'Word Scramble':
        return <WordScramble {...commonProps} />;
      case 'Pattern Recognition':
        return <PatternRecognition {...commonProps} />;
      case 'Spatial Reasoning':
        return <SpatialReasoning {...commonProps} />;
      case 'Reaction Time':
        return <ReactionTime {...commonProps} />;
      case 'Logic Flow':
        return <LogicFlow {...commonProps} />;
      case 'Cognitive Load Challenge':
        return <CognitiveLoadChallenge {...commonProps} />;
      default:
        return <ColorMatch {...commonProps} />;
    }
  };

  return (
    <div className="fixed inset-0 bg-[#FDFBF7] dark:bg-gray-900 z-[100] flex flex-col transition-colors duration-300">
      <header className="flex flex-col border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 transition-colors duration-300">
        <div className="flex justify-between items-center p-6">
          <button onClick={onClose} className="w-10 h-10 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{game.title}</h2>
          <div className="text-center">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Score</p>
            <p className="text-2xl font-bold text-orange-500">{score}</p>
          </div>
        </div>
        {gameState === 'playing' && (
          <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 transition-colors duration-300">
            <motion.div 
              className="h-full bg-orange-500"
              initial={{ width: '100%' }}
              animate={{ width: `${(timeLeft / 60) * 100}%` }}
              transition={{ ease: 'linear', duration: 1 }}
            />
          </div>
        )}
      </header>

      <div className="flex-1 relative overflow-y-auto flex flex-col p-4 sm:p-6">
        <AnimatePresence mode="wait">
          {gameState === 'intro' && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="m-auto text-center max-w-md w-full bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl border border-transparent dark:border-gray-700 transition-colors duration-300"
            >
              <div className={`w-20 h-20 rounded-2xl ${game.bg} dark:opacity-90 ${game.color} flex items-center justify-center mx-auto mb-6 transition-colors duration-300`}>
                <Play className="w-10 h-10 ml-1" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{game.title}</h1>
              <p className="text-gray-500 dark:text-gray-400 mb-8">Train your {game.category.toLowerCase()} skills. Get as many correct answers as possible in 60 seconds.</p>
              <button
                onClick={startGame}
                className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold text-lg hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/30"
              >
                Start Game
              </button>
            </motion.div>
          )}

          {gameState === 'playing' && (
            <motion.div
              key="playing"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="m-auto w-full max-w-lg flex flex-col items-center justify-center py-4"
            >
              {renderGame()}
            </motion.div>
          )}

          {gameState === 'gameover' && (
            <motion.div
              key="gameover"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="m-auto text-center max-w-md w-full bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl border border-transparent dark:border-gray-700 transition-colors duration-300"
            >
              <div className="w-20 h-20 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-500 flex items-center justify-center mx-auto mb-6 transition-colors duration-300">
                <Trophy className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Time's Up!</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">You scored <span className="font-bold text-orange-500">{score}</span> points.</p>
              
              <div className="flex gap-4">
                <button
                  onClick={startGame}
                  className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-2xl font-bold text-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-5 h-5" /> Play Again
                </button>
                <button
                  onClick={claimXP}
                  className="flex-1 py-4 bg-orange-500 text-white rounded-2xl font-bold text-lg hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/30"
                >
                  Claim XP
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
