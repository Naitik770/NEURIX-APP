import { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { motion } from 'motion/react';
import { X } from 'lucide-react';

export default function Analytics() {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    if (!profile?.uid) return;
    const q = query(collection(db, 'users', profile.uid, 'gameSessions'), orderBy('playedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [profile?.uid]);

  const categoryData = sessions.reduce((acc, session) => {
    acc[session.category] = (acc[session.category] || 0) + session.score;
    return acc;
  }, {});

  // Normalize data for the 4 bars in the design
  const categories = ['Walking', 'Running', 'Mediation', 'Drink']; // Placeholder categories
  const chartData = categories.map((cat, i) => ({
    label: cat,
    value: Math.min(100, (categoryData[cat] || 0) / 10), // Mock percentage
    color: ['bg-[#5C4033]', 'bg-[#B87333]', 'bg-[#8B9A46]', 'bg-[#DDA0DD]'][i]
  }));

  return (
    <div className="p-6 pt-12 min-h-screen bg-[#FDFBF7] dark:bg-gray-900 pb-32 transition-colors duration-300">
      <header className="flex justify-between items-start mb-8">
        <h1 className="text-3xl font-serif text-gray-900 dark:text-white leading-tight transition-colors duration-300">
          Your progress <br />
          and insights
        </h1>
        <button className="w-10 h-10 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-300">
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Bar Chart */}
      <div className="flex justify-between items-end h-64 mb-12 px-2">
        {chartData.map((item, index) => (
          <div key={index} className="flex flex-col items-center gap-4 w-16">
            <div className="w-full h-48 bg-gray-100 dark:bg-gray-800 rounded-full relative overflow-hidden flex flex-col justify-end transition-colors duration-300">
              {/* Striped background pattern */}
              <div 
                className="absolute inset-0 opacity-20 dark:opacity-10"
                style={{
                  backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, #000 4px, #000 8px)'
                }}
              />
              
              {/* Solid fill */}
              <motion.div 
                initial={{ height: 0 }}
                animate={{ height: `${item.value}%` }}
                transition={{ duration: 1, delay: index * 0.1, type: 'spring' }}
                className={`w-full rounded-full relative z-10 flex items-end justify-center pb-4 ${item.color}`}
              >
                <span className="text-white text-xs font-bold">{Math.round(item.value)}%</span>
              </motion.div>
            </div>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 transition-colors duration-300">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Points Earned */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white transition-colors duration-300">Points Earned</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 transition-colors duration-300">For this week</p>
        </div>
        <div className="text-right">
          <span className="text-3xl font-bold text-gray-900 dark:text-white transition-colors duration-300">{profile?.xp || 842}</span>
          <span className="text-orange-500 font-medium ml-1">Points</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 transition-colors duration-300">Post</p>
          <p className="font-bold text-gray-900 dark:text-white transition-colors duration-300">440 lb</p>
        </div>
        <div className="text-center border-x border-gray-200 dark:border-gray-700 transition-colors duration-300">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 transition-colors duration-300">Forest area</p>
          <p className="font-bold text-gray-900 dark:text-white transition-colors duration-300">200 ft²</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 transition-colors duration-300">Time</p>
          <p className="font-bold text-gray-900 dark:text-white transition-colors duration-300">7h 30m</p>
        </div>
      </div>

      {/* Share Button */}
      <button className="w-full bg-[#F97316] text-white py-4 rounded-full font-semibold text-lg hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2">
        Share Progress
      </button>
    </div>
  );
}
