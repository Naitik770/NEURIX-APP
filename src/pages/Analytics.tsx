import { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { motion } from 'motion/react';
import { X, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function Analytics() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<any[]>([]);
  const [habits, setHabits] = useState<any[]>([]);
  const [completions, setCompletions] = useState<any[]>([]);

  useEffect(() => {
    if (!profile?.uid) return;
    
    // Fetch Game Sessions
    const qGames = query(collection(db, 'users', profile.uid, 'gameSessions'), orderBy('playedAt', 'desc'));
    const unsubscribeGames = onSnapshot(qGames, (snapshot) => {
      setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${profile.uid}/gameSessions`));

    // Fetch Habits (Tasks)
    const qHabits = query(collection(db, 'users', profile.uid, 'habits'));
    const unsubscribeHabits = onSnapshot(qHabits, (snapshot) => {
      setHabits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${profile.uid}/habits`));

    // Fetch Habit Completions
    const qCompletions = query(collection(db, 'users', profile.uid, 'habitCompletions'), orderBy('completedAt', 'desc'));
    const unsubscribeCompletions = onSnapshot(qCompletions, (snapshot) => {
      setCompletions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${profile.uid}/habitCompletions`));

    return () => {
      unsubscribeGames();
      unsubscribeHabits();
      unsubscribeCompletions();
    };
  }, [profile?.uid]);

  const categoryData = sessions.reduce((acc, session) => {
    acc[session.category] = (acc[session.category] || 0) + session.score;
    return acc;
  }, {} as Record<string, number>);

  // Normalize data for the 4 bars in the design
  const categories = ['Focus', 'Memory', 'Logic', 'Math'];
  const maxScoreAchieved = Math.max(...(Object.values(categoryData) as number[]), 100);
  const chartData = categories.map((cat, i) => {
    const score = categoryData[cat] || 0;
    const value = (score / maxScoreAchieved) * 100;
    return {
      label: cat,
      value: value || 0,
      color: ['bg-orange-500', 'bg-purple-500', 'bg-yellow-500', 'bg-blue-500'][i]
    };
  });

  // Calculate Weekly Task Completion Data
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  const weeklyTaskData = last7Days.map(date => {
    const count = completions.filter(c => c.date === date).length;
    return { date, count };
  });

  const maxCompletions = Math.max(...weeklyTaskData.map(d => d.count), 1);
  const weeklyTaskChart = weeklyTaskData.map(d => ({
    ...d,
    height: (d.count / maxCompletions) * 100
  }));

  // Calculate Task Stats
  const today = new Date().toISOString().split('T')[0];
  const completedToday = habits.filter(h => h.lastCompleted === today).length;
  const totalTasks = habits.length;
  const taskCompletionRate = totalTasks > 0 ? (completedToday / totalTasks) * 100 : 0;

  const handleShare = async () => {
    const shareData = {
      title: 'My NEURIX Progress',
      text: `I've earned ${profile?.xp || 0} XP and completed ${completedToday}/${totalTasks} tasks today on NEURIX! Check out my brain training progress.`,
      url: window.location.origin
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        throw new Error('Web Share API not supported');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Error sharing:', err);
        try {
          await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
          toast.success('Progress copied to clipboard!');
        } catch (clipErr) {
          toast.error('Could not share or copy to clipboard');
        }
      }
    }
  };

  return (
    <div className="p-6 pt-12 min-h-screen bg-[#FDFBF7] dark:bg-gray-900 pb-32 transition-colors duration-300">
      <header className="flex justify-between items-start mb-8">
        <h1 className="text-3xl font-serif text-gray-900 dark:text-white leading-tight transition-colors duration-300">
          Your progress <br />
          and insights
        </h1>
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-300"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Bar Chart */}
      <div className="flex justify-between items-end h-64 mb-12 px-2">
        {chartData.map((item, index) => (
          <div key={index} className="flex flex-col items-center gap-4 w-16">
            <div className="w-full h-48 bg-gray-100 dark:bg-gray-800 rounded-full relative overflow-hidden flex flex-col justify-end transition-colors duration-300">
              <div 
                className="absolute inset-0 opacity-20 dark:opacity-10"
                style={{
                  backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, #000 4px, #000 8px)'
                }}
              />
              
              <motion.div 
                initial={{ height: 0 }}
                animate={{ height: `${item.value}%` }}
                transition={{ duration: 1, delay: index * 0.1, type: 'spring' }}
                className={`w-full rounded-full relative z-10 flex items-end justify-center pb-4 ${item.color}`}
              >
                <span className="text-white text-[10px] font-bold">{Math.round(item.value)}%</span>
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
          <p className="text-sm text-gray-500 dark:text-gray-400 transition-colors duration-300">Total XP</p>
        </div>
        <div className="text-right">
          <span className="text-3xl font-bold text-gray-900 dark:text-white transition-colors duration-300">{profile?.xp || 0}</span>
          <span className="text-orange-500 font-medium ml-1">XP</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 transition-colors duration-300">Games</p>
          <p className="font-bold text-gray-900 dark:text-white transition-colors duration-300">{sessions.length}</p>
        </div>
        <div className="text-center border-x border-gray-200 dark:border-gray-700 transition-colors duration-300">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 transition-colors duration-300">Tasks</p>
          <p className="font-bold text-gray-900 dark:text-white transition-colors duration-300">{completedToday}/{totalTasks}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 transition-colors duration-300">Streak</p>
          <p className="font-bold text-gray-900 dark:text-white transition-colors duration-300">{Math.max(0, ...habits.map(h => h.streak || 0))}d</p>
        </div>
      </div>

      {/* Task Progress Bar */}
      {totalTasks > 0 && (
        <div className="mb-10 bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-transparent dark:border-gray-700 transition-colors duration-300">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-gray-900 dark:text-white">Weekly Task Consistency</h3>
            <span className="text-sm font-medium text-orange-500">{completedToday} today</span>
          </div>
          <div className="flex justify-between items-end h-24 gap-2">
            {weeklyTaskChart.map((day, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-gray-50 dark:bg-gray-700 rounded-full h-16 relative overflow-hidden flex flex-col justify-end transition-colors duration-300">
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: `${day.height}%` }}
                    className={`w-full rounded-full ${i === 6 ? 'bg-orange-500' : 'bg-orange-200 dark:bg-orange-900/40'}`}
                  />
                </div>
                <span className="text-[8px] font-bold text-gray-400 uppercase">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'][(new Date(day.date).getDay())]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Task Progress */}
      {totalTasks > 0 && (
        <div className="mb-10 bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-transparent dark:border-gray-700 transition-colors duration-300">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-900 dark:text-white">Daily Tasks</h3>
            <span className="text-sm font-medium text-orange-500">{Math.round(taskCompletionRate)}%</span>
          </div>
          <div className="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${taskCompletionRate}%` }}
              className="h-full bg-orange-500 rounded-full"
            />
          </div>
        </div>
      )}

      {/* Share Button */}
      <button 
        onClick={handleShare}
        className="w-full bg-[#F97316] text-white py-4 rounded-full font-semibold text-lg hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2"
      >
        <Share2 className="w-5 h-5" />
        Share Progress
      </button>
    </div>
  );
}
