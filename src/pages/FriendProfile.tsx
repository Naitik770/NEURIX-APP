import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, onSnapshot, collection, query, where, getCountFromServer } from 'firebase/firestore';
import { ArrowLeft, Trophy, Star, Zap, Heart, Calendar, User as UserIcon, Loader2 } from 'lucide-react';
import { getAvatarUrl } from '../App';
import { motion } from 'motion/react';

export default function FriendProfile() {
  const { friendId } = useParams<{ friendId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [loadingRank, setLoadingRank] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!friendId) return;
    const docRef = doc(db, 'publicProfiles', friendId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data());
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `publicProfiles/${friendId}`);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [friendId]);

  useEffect(() => {
    if (!profile) return;

    const calculateRank = async () => {
      setLoadingRank(true);
      try {
        const xpValue = profile.xp || 0;
        const q = query(collection(db, 'publicProfiles'), where('xp', '>', xpValue));
        const snapshot = await getCountFromServer(q);
        setRank(snapshot.data().count + 1);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `publicProfiles (rank calculation for ${profile.uid})`);
        setRank(null);
      } finally {
        setLoadingRank(false);
      }
    };

    calculateRank();
    
    // Periodically re-calculate to keep it fresh
    const interval = setInterval(calculateRank, 60000); // Every minute
    return () => clearInterval(interval);
  }, [profile?.xp, profile?.uid]);

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-[#FDFBF7] dark:bg-gray-900 items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col h-screen bg-[#FDFBF7] dark:bg-gray-900 items-center justify-center p-6 text-center">
        <UserIcon className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Profile not found</h2>
        <button onClick={() => navigate(-1)} className="mt-4 text-orange-500 font-bold">Go Back</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-gray-900 transition-colors duration-300">
      {/* Header */}
      <div className="relative h-48 bg-gradient-to-br from-orange-400 to-orange-600">
        <button 
          onClick={() => navigate(-1)} 
          className="absolute top-12 left-6 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 transition-all z-10"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Profile Info */}
      <div className="px-6 -mt-16 pb-32">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -mr-16 -mt-16" />
          
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <div className="w-32 h-32 rounded-full bg-white dark:bg-gray-700 p-1 shadow-lg">
                <div className="w-full h-full rounded-full bg-orange-100 dark:bg-orange-900/30 overflow-hidden">
                  <img src={getAvatarUrl(profile)} alt="Avatar" className="w-full h-full object-cover" />
                </div>
              </div>
              {profile.isOnline && (
                <div className="absolute bottom-2 right-2 w-6 h-6 bg-green-500 border-4 border-white dark:border-gray-800 rounded-full shadow-sm"></div>
              )}
            </div>

            <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">{profile.name}</h1>
            <p className="text-orange-500 font-medium">@{profile.username}</p>
            
            <div className="flex items-center gap-2 mt-2 px-3 py-1 bg-orange-50 dark:bg-orange-900/20 rounded-full">
              <Star className="w-4 h-4 text-orange-500 fill-orange-500" />
              <span className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">Level {profile.level || 1}</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 mt-8">
            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-500">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">XP Points</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{profile.xp || 0}</p>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Streak</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{profile.streak || 0} Days</p>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-500">
                <Heart className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Life Score</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{profile.lifeScore || 0}</p>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-yellow-500">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Rank</p>
                <div className="flex items-center gap-1">
                  {loadingRank ? (
                    <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />
                  ) : (
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{rank !== null ? `#${rank}` : '---'}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* About Section */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-6">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-orange-500" />
            About
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            Joined NEURIX on {profile.createdAt?.toDate ? profile.createdAt.toDate().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : 'recently'}. 
            Currently at Level {profile.level || 1} with {profile.xp || 0} XP and a {profile.streak || 0} day streak.
          </p>
        </div>
      </div>
    </div>
  );
}
