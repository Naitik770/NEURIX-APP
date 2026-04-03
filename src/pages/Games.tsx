import { useState, useEffect } from 'react';
import { useAuth, getAvatarUrl } from '../App';
import { Search, Play, Heart, ChevronLeft, Bell, Brain, Zap, Puzzle, Target, Wind } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import GameEngine from '../components/games/GameEngine';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

const GAME_TYPES = ['Color Match', 'Memory Matrix', 'Speed Match', 'Math Rush', 'Word Scramble', 'Pattern Recognition', 'Spatial Reasoning', 'Reaction Time', 'Logic Flow', 'Cognitive Load Challenge'];
const CATEGORIES = ['Focus', 'Memory', 'Focus', 'Math', 'Language', 'Memory', 'Logic', 'Focus', 'Logic', 'Focus'];
const ICONS = [Zap, Brain, Zap, Target, Brain, Brain, Puzzle, Target, Brain, Zap];
const BGS = ['bg-[#FFEFE5]', 'bg-purple-100', 'bg-yellow-100', 'bg-blue-100', 'bg-green-100', 'bg-pink-100', 'bg-indigo-100', 'bg-teal-100', 'bg-orange-100', 'bg-red-100'];
const COLORS = ['text-orange-500', 'text-purple-500', 'text-yellow-600', 'text-blue-500', 'text-green-500', 'text-pink-500', 'text-indigo-500', 'text-teal-500', 'text-orange-600', 'text-red-500'];

const generateGamesList = () => {
  const list = [];
  for (let i = 1; i <= GAME_TYPES.length * 30; i++) {
    const typeIndex = (i - 1) % GAME_TYPES.length;
    const type = GAME_TYPES[typeIndex];
    const level = Math.ceil(i / GAME_TYPES.length);
    
    let difficulty = 'Easy';
    if (level > 20) difficulty = 'Hard';
    else if (level > 10) difficulty = 'Medium';

    list.push({
      id: i,
      title: `${type} Lvl ${level}`,
      type: type,
      level: level,
      difficulty: difficulty,
      category: CATEGORIES[typeIndex],
      icon: ICONS[typeIndex],
      bg: BGS[typeIndex],
      color: COLORS[typeIndex],
      image: `https://images.unsplash.com/photo-${[
        '1550684848-fac1c5b4e853', // Color Match
        '1558655146-d09347e92766', // Memory Matrix
        '1484480974627-29255d9130ac', // Speed Match
        '1509228468518-180dd4864904', // Math Rush
        '1455390582262-044cdead277a', // Word Scramble
        '1550684376-efcbd6e3f031', // Pattern Recognition
        '1493246507139-91e8fad9978e', // Spatial Reasoning
        '1559757175-5700dde675bc', // Reaction Time
        '1517694712202-14dd9538aa97', // Logic Flow
        '1551818255-e6e10975bc17'  // Cognitive Load Challenge
      ][typeIndex]}?w=400&q=80`
    });
  }
  return list;
};

const GAME_TYPES_LIST = generateGamesList();

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case 'Easy': return 'text-emerald-500';
    case 'Medium': return 'text-amber-500';
    case 'Hard': return 'text-rose-500';
    default: return 'text-gray-400';
  }
};

const BreathingExercise = () => {
  const [phase, setPhase] = useState<'Inhale' | 'Hold' | 'Exhale'>('Inhale');
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!isActive) return;

    let timeout: NodeJS.Timeout;
    if (phase === 'Inhale') {
      timeout = setTimeout(() => setPhase('Hold'), 4000);
    } else if (phase === 'Hold') {
      timeout = setTimeout(() => setPhase('Exhale'), 4000);
    } else if (phase === 'Exhale') {
      timeout = setTimeout(() => setPhase('Inhale'), 6000);
    }

    return () => clearTimeout(timeout);
  }, [phase, isActive]);

  const circleVariants = {
    Inhale: { scale: 1.8, backgroundColor: '#A7F3D0', transition: { duration: 4, ease: 'easeInOut' as const } }, // emerald-200
    Hold: { scale: 1.8, backgroundColor: '#BFDBFE', transition: { duration: 4, ease: 'linear' as const } }, // blue-200
    Exhale: { scale: 1, backgroundColor: '#FECACA', transition: { duration: 6, ease: 'easeInOut' as const } }, // red-200
  };

  return (
    <div className="flex flex-col items-center justify-center w-full mt-20">
      <div className="relative w-72 h-72 flex items-center justify-center mb-16">
        {/* Outer expanding circle */}
        <motion.div
          className="absolute w-32 h-32 rounded-full opacity-60"
          variants={circleVariants}
          animate={isActive ? phase : { scale: 1, backgroundColor: '#E5E7EB' }}
        />
        {/* Inner static circle */}
        <motion.div
          className="absolute w-28 h-28 rounded-full bg-white shadow-xl flex items-center justify-center z-10"
        >
          <span className="text-xl font-bold text-gray-800 tracking-wide">
            {isActive ? phase : 'Ready'}
          </span>
        </motion.div>
      </div>

      <div className="text-center mb-12 h-16">
        <AnimatePresence mode="wait">
          {isActive && (
            <motion.p
              key={phase}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-gray-500 font-medium"
            >
              {phase === 'Inhale' && 'Breathe in deeply through your nose...'}
              {phase === 'Hold' && 'Hold your breath...'}
              {phase === 'Exhale' && 'Slowly exhale through your mouth...'}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <button
        onClick={() => {
          setIsActive(!isActive);
          if (!isActive) setPhase('Inhale');
        }}
        className={`px-10 py-4 rounded-full font-bold text-lg shadow-xl transition-all hover:scale-105 active:scale-95 ${
          isActive 
            ? 'bg-gray-100 text-gray-800 hover:bg-gray-200' 
            : 'bg-orange-500 text-white hover:bg-orange-600 shadow-orange-500/30'
        }`}
      >
        {isActive ? 'Stop Exercise' : 'Start Breathing'}
      </button>
    </div>
  );
};

const GAME_DESCRIPTIONS: Record<string, { objective: string; rules: string[] }> = {
  'Color Match': {
    objective: 'Test your cognitive flexibility and reaction speed.',
    rules: [
      'Match the color of the text, not the word itself.',
      'Tap the correct color button as fast as possible.',
      'Avoid making mistakes to maintain your streak.'
    ]
  },
  'Memory Matrix': {
    objective: 'Enhance your spatial memory and visualization skills.',
    rules: [
      'Memorize the pattern of highlighted tiles.',
      'Tap the correct tiles once they disappear.',
      'The grid size increases as you progress.'
    ]
  },
  'Speed Match': {
    objective: 'Improve your processing speed and pattern recognition.',
    rules: [
      'Decide if the current shape matches the previous one.',
      'Tap "Match" or "No Match" quickly.',
      'Speed is key to getting a high score.'
    ]
  },
  'Math Rush': {
    objective: 'Sharpen your mental arithmetic and numerical fluency.',
    rules: [
      'Solve as many math problems as you can.',
      'Type the correct answer before the timer runs out.',
      'Difficulty increases with each correct answer.'
    ]
  },
  'Word Scramble': {
    objective: 'Boost your vocabulary and linguistic processing.',
    rules: [
      'Unscramble the letters to form a valid word.',
      'Use hints if you get stuck (but they cost points).',
      'Complete words quickly for bonus multipliers.'
    ]
  },
  'Pattern Recognition': {
    objective: 'Develop your logical reasoning and sequence analysis.',
    rules: [
      'Identify the underlying pattern in the sequence.',
      'Select the next logical item in the series.',
      'Think carefully but act fast.'
    ]
  },
  'Spatial Reasoning': {
    objective: 'Improve your ability to visualize and manipulate objects.',
    rules: [
      'Rotate or flip objects to match the target shape.',
      'Complete the puzzle in the fewest moves possible.',
      'Watch out for complex 3D transformations.'
    ]
  },
  'Reaction Time': {
    objective: 'Measure and improve your physical response speed.',
    rules: [
      'Wait for the screen to change color.',
      'Tap as soon as you see the signal.',
      'Consistency is just as important as speed.'
    ]
  },
  'Logic Flow': {
    objective: 'Enhance your problem-solving and deductive logic.',
    rules: [
      'Connect the nodes following the logical constraints.',
      'Ensure all conditions are met for the flow to complete.',
      'Plan your moves ahead to avoid dead ends.'
    ]
  },
  'Cognitive Load Challenge': {
    objective: 'Test your ability to multitask and manage competing distractions.',
    rules: [
      'Monitor multiple tasks simultaneously.',
      'Ignore irrelevant distractions and focus on the primary target.',
      'Respond correctly to each task as it appears.'
    ]
  }
};

const GameIntro = ({ game, onStart, onCancel }: { game: any; onStart: () => void; onCancel: () => void }) => {
  const description = GAME_DESCRIPTIONS[game.type] || {
    objective: 'Train your brain with this engaging exercise.',
    rules: ['Follow the on-screen instructions.', 'Try to get the highest score possible.', 'Have fun!']
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-white dark:bg-gray-900 z-[60] overflow-y-auto transition-colors duration-300"
    >
      <div className="min-h-full flex flex-col p-6 max-w-md mx-auto w-full">
        <header className="flex justify-between items-center mb-12 shrink-0">
          <button onClick={onCancel} className="w-10 h-10 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${game.bg} ${game.color}`}>
              <game.icon className="w-5 h-5" />
            </div>
            <span className="font-bold text-gray-900 dark:text-white">{game.category}</span>
          </div>
          <div className="w-10" />
        </header>

        <div className="flex-1 flex flex-col items-center justify-center">
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="w-24 h-24 rounded-3xl overflow-hidden mb-8 shadow-2xl shrink-0"
          >
            <img src={game.image} alt="" className="w-full h-full object-cover" />
          </motion.div>

          <motion.h2 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-4"
          >
            {game.title}
          </motion.h2>

          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-orange-50 dark:bg-orange-900/20 p-6 rounded-3xl mb-8 w-full"
          >
            <h4 className="text-orange-600 dark:text-orange-400 font-bold text-sm uppercase tracking-widest mb-2">Objective</h4>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {description.objective}
            </p>
          </motion.div>

          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="w-full space-y-4 mb-12"
          >
            <h4 className="text-gray-400 dark:text-gray-500 font-bold text-sm uppercase tracking-widest px-2">How to play</h4>
            {description.rules.map((rule, i) => (
              <div key={i} className="flex gap-4 items-start bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors duration-300">
                <div className="w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center text-xs font-bold shrink-0">
                  {i + 1}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{rule}</p>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          onClick={onStart}
          className="w-full py-5 rounded-2xl bg-orange-500 text-white font-bold text-lg shadow-xl shadow-orange-500/30 hover:bg-orange-600 transition-all active:scale-95 mb-4 shrink-0"
        >
          Start Game
        </motion.button>
      </div>
    </motion.div>
  );
};

export default function Games() {
  const { user, profile } = useAuth();
  const [view, setView] = useState<'home' | 'allGames' | 'relax'>('home');
  const [activeGame, setActiveGame] = useState<any>(null);
  const [showIntro, setShowIntro] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    { id: 'Focus', name: 'Quick Focus', icon: Zap, color: 'text-orange-500', bg: 'bg-[#FFEFE5]' },
    { id: 'Memory', name: 'Memory', icon: Brain, color: 'text-purple-500', bg: 'bg-purple-100' },
    { id: 'Logic', name: 'Logic Puzzles', icon: Puzzle, color: 'text-yellow-600', bg: 'bg-yellow-100' },
    { id: 'relax', name: 'Mind & Relax', icon: Wind, color: 'text-blue-500', bg: 'bg-blue-100' },
  ];

  const filteredGames = GAME_TYPES_LIST.filter(g => {
    const matchesCategory = selectedCategory ? g.category === selectedCategory : true;
    const matchesDifficulty = selectedDifficulty ? g.difficulty === selectedDifficulty : true;
    const matchesSearch = searchQuery ? g.title.toLowerCase().includes(searchQuery.toLowerCase()) : true;
    return matchesCategory && matchesDifficulty && matchesSearch;
  });

  const displayGames = selectedCategory || searchQuery
    ? filteredGames
    : filteredGames.slice(0, 8);

  if (activeGame && showIntro) {
    return (
      <GameIntro 
        game={activeGame} 
        onStart={() => setShowIntro(false)} 
        onCancel={() => {
          setActiveGame(null);
          setShowIntro(false);
        }} 
      />
    );
  }

  if (activeGame && !showIntro) {
    return (
      <GameEngine 
        game={activeGame} 
        onClose={() => setActiveGame(null)} 
        onComplete={async (xpEarned: number) => {
          if (!user) return;
          try {
            await addDoc(collection(db, 'users', user.uid, 'gameSessions'), {
              gameId: activeGame.id,
              gameTitle: activeGame.title,
              category: activeGame.category,
              score: xpEarned,
              playedAt: serverTimestamp()
            });
            await updateDoc(doc(db, 'users', user.uid), {
              xp: (profile?.xp || 0) + xpEarned
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/gameSessions`);
          }
          setActiveGame(null);
        }} 
      />
    );
  }

  if (view === 'relax') {
    return (
      <div className="p-6 pt-12 min-h-screen bg-[#FDFBF7] dark:bg-gray-900 flex flex-col items-center text-gray-900 dark:text-white transition-colors duration-300">
        <header className="w-full flex justify-between items-center mb-12">
          <button onClick={() => setView('home')} className="w-10 h-10 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Mind & Relax</h1>
          <div className="w-10 h-10" />
        </header>
        
        <BreathingExercise />
      </div>
    );
  }

  if (view === 'allGames') {
    return (
      <div className="p-6 pt-12 min-h-screen bg-[#FDFBF7] dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-300">
        <header className="flex justify-between items-center mb-8">
          <button onClick={() => {setView('home'); setSearchQuery(''); setSelectedDifficulty(null);}} className="w-10 h-10 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">Game Browser</h1>
          <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 overflow-hidden border-2 border-white dark:border-gray-800 transition-colors duration-300">
            <img src={getAvatarUrl(profile, user)} alt="Avatar" className="w-full h-full object-cover" />
          </div>
        </header>

        <div className="relative mb-6">
          <input 
            type="text" 
            placeholder="Search games..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-gray-800 rounded-2xl py-4 pl-6 pr-16 shadow-[0_4px_20px_rgba(0,0,0,0.03)] outline-none text-gray-900 dark:text-white placeholder:text-gray-400 border border-transparent dark:border-gray-700 transition-colors duration-300"
          />
          <button className="absolute right-2 top-2 bottom-2 w-12 bg-orange-50 dark:bg-orange-900/20 text-orange-500 rounded-xl flex items-center justify-center hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors">
            <Search className="w-5 h-5" />
          </button>
        </div>

        {/* Cognitive Category Filters */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-4 hide-scrollbar">
          <button 
            onClick={() => setSelectedCategory(null)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${!selectedCategory ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-gray-700'}`}
          >
            All Categories
          </button>
          {['Focus', 'Memory', 'Logic', 'Math', 'Language'].map(cat => (
            <button 
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${selectedCategory === cat ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-gray-700'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Difficulty Filters */}
        <div className="flex gap-2 mb-8">
          {['Easy', 'Medium', 'Hard'].map(diff => (
            <button 
              key={diff}
              onClick={() => setSelectedDifficulty(selectedDifficulty === diff ? null : diff)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                selectedDifficulty === diff 
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent' 
                  : 'bg-transparent text-gray-400 border-gray-200 dark:border-gray-700'
              }`}
            >
              {diff}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 pb-24">
          <AnimatePresence mode="popLayout">
            {filteredGames.slice(0, 50).map((game) => (
              <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileHover={{ y: -5 }}
                whileTap={{ scale: 0.95 }}
                key={game.id} 
                onClick={() => {
                  setActiveGame(game);
                  setShowIntro(true);
                }}
                className={`group ${game.bg} dark:opacity-90 rounded-[2rem] p-5 relative overflow-hidden aspect-[4/5] flex flex-col justify-between cursor-pointer shadow-md hover:shadow-xl transition-all duration-300 border border-transparent dark:border-gray-700`}
              >
                {/* Background Pattern/Image */}
                <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity">
                  <img src={game.image} alt="" className="w-full h-full object-cover grayscale" />
                </div>

                <div className="flex justify-between items-start relative z-10">
                  <div className={`p-2 rounded-xl bg-white/60 dark:bg-black/40 backdrop-blur-md ${game.color}`}>
                    <game.icon className="w-5 h-5" />
                  </div>
                </div>
                
                <div className="relative z-10">
                  <div className="flex items-center gap-1.5 mb-1">
                    <p className="text-[10px] text-gray-600 dark:text-gray-300 font-bold uppercase tracking-widest">{game.category}</p>
                    <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                    <p className={`text-[9px] font-black uppercase tracking-tighter ${getDifficultyColor(game.difficulty)}`}>{game.difficulty}</p>
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm leading-tight group-hover:text-orange-600 transition-colors">{game.title}</h3>
                </div>

                {/* Play Button Overlay */}
                <div className="absolute inset-0 bg-orange-500/0 group-hover:bg-orange-500/10 transition-colors flex items-center justify-center">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.5 }}
                    whileHover={{ opacity: 1, scale: 1 }}
                    className="w-12 h-12 bg-white rounded-full shadow-xl flex items-center justify-center text-orange-500"
                  >
                    <Play className="w-6 h-6 fill-current ml-1" />
                  </motion.div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {filteredGames.length === 0 && (
            <div className="col-span-2 py-20 text-center">
              <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 font-medium">No games found matching your filters.</p>
              <button 
                onClick={() => {setSelectedCategory(null); setSelectedDifficulty(null); setSearchQuery('');}}
                className="mt-4 text-orange-500 font-bold text-sm"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 pt-12 min-h-screen bg-[#FDFBF7] dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-300 overflow-y-auto">
      <header className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1 transition-colors duration-300">Hello, {profile?.name?.split(' ')[0] || 'Devon'}</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1 transition-colors duration-300">
            <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
            Pennsylvania
          </p>
        </div>
        <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 overflow-hidden border-2 border-white dark:border-gray-800 shadow-sm transition-colors duration-300">
          <img src={getAvatarUrl(profile, user)} alt="Avatar" className="w-full h-full object-cover" />
        </div>
      </header>

      <h2 className="text-3xl font-serif text-gray-900 dark:text-white mb-6 leading-tight transition-colors duration-300">
        Find the Perfect <br />
        Brain Training <span className="italic font-light text-orange-500">Exercise!</span>
      </h2>

      <div className="relative mb-8">
        <input 
          type="text" 
          placeholder="Search anything games" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white dark:bg-gray-800 rounded-2xl py-4 pl-6 pr-16 shadow-[0_4px_20px_rgba(0,0,0,0.03)] outline-none text-gray-900 dark:text-white placeholder:text-gray-400 border border-transparent dark:border-gray-700 transition-colors duration-300"
        />
        <button className="absolute right-2 top-2 bottom-2 w-12 bg-orange-50 dark:bg-orange-900/20 text-orange-500 rounded-xl flex items-center justify-center hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors">
          <Search className="w-5 h-5" />
        </button>
      </div>

      <div className="flex justify-between mb-10 px-2">
        {categories.map((cat) => (
          <div 
            key={cat.id} 
            className="flex flex-col items-center gap-2 cursor-pointer"
            onClick={() => {
              if (cat.id === 'relax') {
                setView('relax');
                setSelectedCategory(null);
                setSearchQuery('');
              } else {
                setSelectedCategory(cat.id);
                setView('home');
                setSearchQuery('');
              }
            }}
          >
            <div className={`w-14 h-14 rounded-2xl ${cat.bg} dark:opacity-90 ${cat.color} flex items-center justify-center shadow-sm hover:scale-105 transition-transform ${selectedCategory === cat.id ? 'ring-2 ring-orange-500' : ''}`}>
              <cat.icon className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 text-center w-16 leading-tight transition-colors duration-300">{cat.name}</span>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-end mb-4">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white transition-colors duration-300">{selectedCategory ? `${selectedCategory} Games` : searchQuery ? 'Search Results' : 'Popular games'}</h3>
        <button onClick={() => {setView('allGames'); setSelectedCategory(null); setSearchQuery('');}} className="text-xs text-orange-500 font-medium hover:text-orange-600">See all {GAME_TYPES_LIST.length}+</button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-8 -mx-6 px-6 snap-x hide-scrollbar">
        {displayGames.map((game) => (
          <motion.div 
            whileHover={{ y: -5 }}
            whileTap={{ scale: 0.95 }}
            key={game.id} 
            onClick={() => {
              setActiveGame(game);
              setShowIntro(true);
            }}
            className={`group ${game.bg} dark:opacity-90 min-w-[220px] rounded-[2rem] p-5 relative overflow-hidden aspect-[4/5] flex flex-col justify-between cursor-pointer shadow-md hover:shadow-xl transition-all duration-300 border border-transparent dark:border-gray-700 snap-center`}
          >
            {/* Background Pattern/Image */}
            <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity">
              <img src={game.image} alt="" className="w-full h-full object-cover grayscale" referrerPolicy="no-referrer" />
            </div>

            <div className="flex justify-between items-start relative z-10">
              <div className={`p-2 rounded-xl bg-white/60 dark:bg-black/40 backdrop-blur-md ${game.color}`}>
                <game.icon className="w-5 h-5" />
              </div>
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-1.5 mb-1">
                <p className="text-[10px] text-gray-600 dark:text-gray-300 font-bold uppercase tracking-widest">{game.category}</p>
                <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                <p className={`text-[9px] font-black uppercase tracking-tighter ${getDifficultyColor(game.difficulty)}`}>{game.difficulty}</p>
              </div>
              <h4 className="font-bold text-gray-900 dark:text-white text-base leading-tight group-hover:text-orange-600 transition-colors">{game.title}</h4>
            </div>

            {/* Play Button Overlay */}
            <div className="absolute inset-0 bg-orange-500/0 group-hover:bg-orange-500/10 transition-colors flex items-center justify-center">
              <motion.div 
                initial={{ opacity: 0, scale: 0.5 }}
                whileHover={{ opacity: 1, scale: 1 }}
                className="w-12 h-12 bg-white rounded-full shadow-xl flex items-center justify-center text-orange-500"
              >
                <Play className="w-6 h-6 fill-current ml-1" />
              </motion.div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
