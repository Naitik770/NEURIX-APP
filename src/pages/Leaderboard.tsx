import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth, getAvatarUrl } from '../App';
import { Trophy, Medal, Crown, ArrowLeft, Loader2, Star, Zap } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';

export default function Leaderboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leaders, setLeaders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'publicProfiles'),
      orderBy('xp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLeaders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLeaders(fetchedLeaders);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'publicProfiles');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0: return <Crown className="w-6 h-6 text-yellow-500 fill-yellow-500" />;
      case 1: return <Medal className="w-6 h-6 text-gray-400 fill-gray-400" />;
      case 2: return <Medal className="w-6 h-6 text-orange-400 fill-orange-400" />;
      default: return <span className="text-sm font-black text-gray-400">#{index + 1}</span>;
    }
  };

  return (
    <div className="p-6 pt-12 min-h-screen bg-[#FDFBF7] dark:bg-gray-900 pb-32 transition-colors duration-300">
      <header className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-orange-500 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Global Leaderboard</h1>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-4" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">Loading legends...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leaders.map((leader, index) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              key={leader.id}
              className={`bg-white dark:bg-gray-800 rounded-3xl p-4 flex items-center gap-4 shadow-sm border-2 transition-all ${leader.id === user?.uid ? 'border-orange-500 ring-4 ring-orange-500/10' : 'border-transparent'}`}
            >
              <div className="w-10 flex items-center justify-center">
                {getRankIcon(index)}
              </div>
              
              <Link to={`/friend/${leader.id}`} className="relative">
                <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 overflow-hidden border-2 border-white dark:border-gray-700 shadow-sm">
                  <img 
                    src={getAvatarUrl(leader)} 
                    alt={leader.name} 
                    className="w-full h-full object-cover"
                  />
                </div>
                {index < 3 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center">
                    <Star className="w-3 h-3 text-white fill-current" />
                  </div>
                )}
              </Link>

              <div className="flex-1 min-w-0">
                <h3 className="text-gray-900 dark:text-white font-bold truncate tracking-tight">
                  {leader.name} {leader.id === user?.uid && <span className="text-[10px] bg-orange-500 text-white px-2 py-0.5 rounded-full ml-1 uppercase">You</span>}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Level {leader.level || 1}</span>
                  {leader.streak > 0 && (
                    <div className="flex items-center gap-0.5 text-orange-500">
                      <Zap className="w-3 h-3 fill-current" />
                      <span className="text-[10px] font-bold">{leader.streak}d</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-right">
                <p className="text-lg font-black text-gray-900 dark:text-white leading-none">{leader.xp || 0}</p>
                <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">XP</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {!loading && leaders.length === 0 && (
        <div className="text-center py-20">
          <Trophy className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No one has earned XP yet. Be the first!</p>
        </div>
      )}
    </div>
  );
}
