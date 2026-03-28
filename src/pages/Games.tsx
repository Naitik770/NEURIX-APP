import { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { Search, Play, Heart, ChevronLeft, Bell, Brain, Zap, Puzzle, Target, Wind } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import GameEngine from '../components/games/GameEngine';

const GAME_TYPES = ['Color Match', 'Memory Matrix', 'Speed Match', 'Math Rush'];
const CATEGORIES = ['Focus', 'Memory', 'Logic', 'Math'];
const ICONS = [Zap, Brain, Puzzle, Target];
const BGS = ['bg-[#FFEFE5]', 'bg-purple-100', 'bg-yellow-100', 'bg-blue-100'];
const COLORS = ['text-orange-500', 'text-purple-500', 'text-yellow-600', 'text-blue-500'];

const generateGamesList = () => {
  const list = [];
  for (let i = 1; i <= 120; i++) {
    const typeIndex = (i - 1) % GAME_TYPES.length;
    const type = GAME_TYPES[typeIndex];
    const level = Math.ceil(i / GAME_TYPES.length);
    list.push({
      id: i,
      title: `${type} Lvl ${level}`,
      type: type,
      level: level,
      category: CATEGORIES[typeIndex],
      icon: ICONS[typeIndex],
      bg: BGS[typeIndex],
      color: COLORS[typeIndex],
      image: `https://images.unsplash.com/photo-${[
        '1559757175-5700dde675bc',
        '1516116216624-53e697fedbea',
        '1509228468518-180dd4864904',
        '1518133910546-b6c2fb7d79e3'
      ][typeIndex]}?w=400&q=80`
    });
  }
  return list;
};

const GAME_TYPES_LIST = generateGamesList();

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

export default function Games() {
  const { profile } = useAuth();
  const [view, setView] = useState<'home' | 'allGames' | 'relax'>('home');
  const [activeGame, setActiveGame] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = [
    { id: 'Focus', name: 'Quick Focus', icon: Zap, color: 'text-orange-500', bg: 'bg-[#FFEFE5]' },
    { id: 'Memory', name: 'Memory', icon: Brain, color: 'text-purple-500', bg: 'bg-purple-100' },
    { id: 'Logic', name: 'Logic Puzzles', icon: Puzzle, color: 'text-yellow-600', bg: 'bg-yellow-100' },
    { id: 'relax', name: 'Mind & Relax', icon: Wind, color: 'text-blue-500', bg: 'bg-blue-100' },
  ];

  const filteredGames = selectedCategory 
    ? GAME_TYPES_LIST.filter(g => g.category === selectedCategory)
    : GAME_TYPES_LIST.slice(0, 8);

  if (activeGame) {
    return (
      <GameEngine 
        game={activeGame} 
        onClose={() => setActiveGame(null)} 
        onComplete={(score: number) => {
          console.log(`Game completed with score: ${score}`);
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
          <button onClick={() => setView('home')} className="w-10 h-10 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">All Games ({GAME_TYPES_LIST.length})</h1>
          <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 overflow-hidden border-2 border-white dark:border-gray-800 transition-colors duration-300">
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.avatarSeed || profile?.uid}`} alt="Avatar" className="w-full h-full object-cover" />
          </div>
        </header>

        <div className="grid grid-cols-2 gap-4 pb-24">
          {GAME_TYPES_LIST.map((game) => (
            <motion.div 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              key={game.id} 
              onClick={() => setActiveGame(game)}
              className={`${game.bg} dark:opacity-90 rounded-3xl p-6 relative overflow-hidden aspect-[3/4] flex flex-col justify-between cursor-pointer shadow-lg border border-transparent dark:border-gray-700 transition-colors duration-300`}
            >
              <div className="flex justify-between items-start">
                <div className="bg-white/40 dark:bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-gray-900 dark:text-white uppercase tracking-wider transition-colors duration-300">
                  Play
                </div>
                <div className="w-8 h-8 bg-white/40 dark:bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-gray-900 dark:text-white transition-colors duration-300">
                  <Play className="w-4 h-4 fill-current" />
                </div>
              </div>
              
              <div className="bg-white/60 dark:bg-black/60 backdrop-blur-md rounded-2xl p-4 transition-colors duration-300">
                <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-1">{game.title}</h3>
                <p className="text-[10px] text-gray-700 dark:text-gray-300 font-medium uppercase tracking-wide">{game.category}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 pt-12 min-h-screen bg-[#FDFBF7] dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-300">
      <header className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1 transition-colors duration-300">Hello, {profile?.name?.split(' ')[0] || 'Devon'}</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1 transition-colors duration-300">
            <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
            Pennsylvania
          </p>
        </div>
        <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 overflow-hidden border-2 border-white dark:border-gray-800 shadow-sm transition-colors duration-300">
          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.avatarSeed || profile?.uid}`} alt="Avatar" className="w-full h-full object-cover" />
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
              } else {
                setSelectedCategory(cat.id);
                setView('home');
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
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white transition-colors duration-300">{selectedCategory ? `${selectedCategory} Games` : 'Popular games'}</h3>
        <button onClick={() => {setView('allGames'); setSelectedCategory(null);}} className="text-xs text-orange-500 font-medium hover:text-orange-600">See all 120+</button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-8 -mx-6 px-6 snap-x hide-scrollbar">
        {filteredGames.map((game) => (
          <motion.div 
            whileHover={{ scale: 1.02 }}
            key={game.id} 
            onClick={() => setActiveGame(game)}
            className={`${game.bg} min-w-[200px] rounded-3xl p-5 text-white relative overflow-hidden snap-center flex flex-col justify-end aspect-[3/4] shadow-lg cursor-pointer`}
          >
            {/* Brain Image Placeholder */}
            <div className="absolute inset-0 -z-10 opacity-80 mix-blend-multiply">
              <img src={game.image} alt={game.title} className="w-full h-full object-cover" />
            </div>
            
            <div className="z-10">
              <h4 className="font-bold text-lg mb-1 leading-tight">{game.title}</h4>
              <p className="text-xs opacity-80 mb-4">{game.category}</p>
              <div className="flex items-center gap-3 text-xs font-medium">
                <button className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
                  <Play className="w-3 h-3 fill-current ml-0.5" />
                </button>
                Play
                <span className="opacity-80 ml-auto flex items-center gap-1">
                  <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
                    <Play className="w-2 h-2 fill-current" />
                  </div>
                  1 min
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
