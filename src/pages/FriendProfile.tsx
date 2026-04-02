import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, Trophy, Zap, Star, Heart, Calendar, User, Shield, MessageCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { getAvatarUrl } from '../App';

export default function FriendProfile() {
  const { friendId } = useParams<{ friendId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
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
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Profile Not Found</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">The user you're looking for doesn't exist or has a private profile.</p>
        <button 
          onClick={() => navigate(-1)}
          className="px-6 py-3 bg-orange-500 text-white rounded-2xl font-bold shadow-lg shadow-orange-500/20"
        >
          Go Back
        </button>
      </div>
    );
  }

  const stats = [
    { label: 'Level', value: profile.level || 1, icon: Shield, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'XP', value: profile.xp || 0, icon: Zap, color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
    { label: 'Streak', value: `${profile.streak || 0} Days`, icon: Trophy, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
    { label: 'Life Score', value: profile.lifeScore || 50, icon: Heart, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
  ];

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-gray-900 pb-12">
      {/* Header */}
      <div className="relative h-48 bg-gradient-to-br from-orange-400 to-orange-600 overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/hexellence.png")' }} />
        <button 
          onClick={() => navigate(-1)}
          className="absolute top-6 left-6 p-3 bg-white/20 backdrop-blur-md rounded-2xl text-white hover:bg-white/30 transition-colors z-10"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Profile Info */}
      <div className="px-6 -mt-16 relative z-10">
        <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-xl shadow-orange-900/5 p-8 border border-gray-100 dark:border-gray-700">
          <div className="flex flex-col items-center text-center">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-32 h-32 rounded-[2rem] bg-orange-100 dark:bg-orange-900/30 p-1 mb-6 shadow-2xl shadow-orange-500/20"
            >
              <div className="w-full h-full rounded-[1.8rem] overflow-hidden border-4 border-white dark:border-gray-800">
                <img src={getAvatarUrl(profile)} alt="Avatar" className="w-full h-full object-cover" />
              </div>
            </motion.div>

            <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-1 tracking-tight">{profile.name}</h1>
            <p className="text-orange-500 font-bold text-sm mb-6 tracking-wide uppercase">@{profile.username || 'user'}</p>

            <div className="flex gap-3 w-full">
              <button 
                onClick={() => navigate(`/chat/${profile.uid}`)}
                className="flex-1 flex items-center justify-center gap-2 py-4 bg-orange-500 text-white rounded-2xl font-bold shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all active:scale-95"
              >
                <MessageCircle className="w-5 h-5" />
                Message
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-10">
            {stats.map((stat, idx) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`${stat.bg} p-5 rounded-3xl border border-white/50 dark:border-gray-700/50 flex flex-col items-center text-center`}
              >
                <div className={`p-3 rounded-2xl bg-white dark:bg-gray-800 shadow-sm mb-3 ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{stat.label}</span>
                <span className="text-lg font-black text-gray-900 dark:text-white">{stat.value}</span>
              </motion.div>
            ))}
          </div>

          <div className="mt-10 pt-10 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-700/50 flex items-center justify-center text-gray-400">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Member Since</p>
                <p className="font-bold text-gray-900 dark:text-white">
                  {profile.createdAt?.toDate ? profile.createdAt.toDate().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Recently'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-700/50 flex items-center justify-center text-gray-400">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</p>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${profile.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <p className="font-bold text-gray-900 dark:text-white">{profile.isOnline ? 'Online' : 'Offline'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
