import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, where, getCountFromServer } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth, getAvatarUrl } from '../App';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Medal, ArrowLeft, Zap, Flame, Target, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Leaderboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [topUsers, setTopUsers] = useState<any[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;

    // 1. Fetch Friends UIDs
    const friendsRef = collection(db, 'users', user.uid, 'friends');
    const unsubscribeFriends = onSnapshot(friendsRef, (snapshot) => {
      const friendUids = snapshot.docs.map(doc => doc.data().friendUid);
      const allUids = [user.uid, ...friendUids];

      // 2. Fetch Public Profiles for these UIDs
      // Note: Firestore 'in' query is limited to 30 items. 
      // If there are more than 30 friends, we'll need to fetch them in chunks or handle it differently.
      // For now, we'll use the 'in' query for the first 30.
      const uidsToFetch = allUids.slice(0, 30);
      
      const q = query(
        collection(db, 'publicProfiles'),
        where('uid', 'in', uidsToFetch)
      );

      const unsubscribeProfiles = onSnapshot(q, (profileSnapshot) => {
        const users = profileSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as any))
          .sort((a, b) => (b.xp || 0) - (a.xp || 0));
        
        setTopUsers(users);
        
        // Calculate rank within this list
        const myIndex = users.findIndex(u => u.uid === user.uid);
        if (myIndex !== -1) {
          setUserRank(myIndex + 1);
        }
        
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'publicProfiles');
        setLoading(false);
      });

      return () => unsubscribeProfiles();
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/friends`);
      setLoading(false);
    });

    return () => unsubscribeFriends();
  }, [user?.uid]);

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="w-6 h-6 text-yellow-500" />;
    if (index === 1) return <Medal className="w-6 h-6 text-gray-400" />;
    if (index === 2) return <Medal className="w-6 h-6 text-orange-400" />;
    return <span className="text-sm font-bold text-gray-400">{index + 1}</span>;
  };

  const getRankColor = (index: number) => {
    if (index === 0) return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800';
    if (index === 1) return 'bg-gray-50 border-gray-200 dark:bg-gray-800/50 dark:border-gray-700';
    if (index === 2) return 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800';
    return 'bg-white border-gray-100 dark:bg-gray-800 dark:border-gray-700';
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-gray-900 pb-32 transition-colors duration-300">
      {/* Header */}
      <header className="p-6 pt-12 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 transition-colors duration-300 sticky top-0 z-20">
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Leaderboard</h1>
        </div>
      </header>

      {/* User Current Rank Card */}
      <div className="px-6 py-8">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-orange-500/30 relative overflow-hidden mb-10"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full -ml-12 -mb-12 blur-2xl" />
          
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 p-1">
                <div className="w-full h-full rounded-[0.9rem] overflow-hidden">
                  <img src={getAvatarUrl(profile, user)} alt="Avatar" className="w-full h-full object-cover" />
                </div>
              </div>
              <div>
                <p className="text-orange-100 text-xs font-bold uppercase tracking-widest mb-1">Your Current Rank</p>
                <h2 className="text-3xl font-black">#{userRank || '--'}</h2>
              </div>
            </div>
            <div className="text-right">
              <p className="text-orange-100 text-xs font-bold uppercase tracking-widest mb-1">Total XP</p>
              <div className="flex items-center justify-end gap-1">
                <Zap className="w-4 h-4 fill-current" />
                <span className="text-2xl font-black">{profile?.xp || 0}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* List */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {topUsers.map((u, index) => (
                <motion.div
                  key={u.uid}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => navigate(`/friend-profile/${u.uid}`)}
                  className={`flex items-center justify-between p-4 rounded-3xl border transition-all active:scale-[0.98] cursor-pointer ${getRankColor(index)} ${u.uid === user?.uid ? 'ring-2 ring-orange-500 ring-offset-2 dark:ring-offset-gray-900' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 flex justify-center">
                      {getRankIcon(index)}
                    </div>
                    <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-white dark:border-gray-700 shadow-sm">
                      <img src={getAvatarUrl(u)} alt={u.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                        {u.name} {u.uid === user?.uid && <span className="text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded-full ml-1">YOU</span>}
                      </h3>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-tighter">Lvl {u.level || 1} • {u.streak || 0}d Streak</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-orange-500 font-black">
                    <Zap className="w-3 h-3 fill-current" />
                    <span className="text-sm">{u.xp || 0}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
