import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, onSnapshot, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth, getAvatarUrl } from '../App';
import { ArrowLeft, Flame, Trophy, Star, Heart, MessageCircle, UserPlus, Check, X, Shield, Calendar, MapPin, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

const FriendProfile: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [friendStatus, setFriendStatus] = useState<'none' | 'pending' | 'friends'>('none');
  const [rank, setRank] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) return;

    setLoading(true);

    // Fetch profile data
    const unsubscribeProfile = onSnapshot(doc(db, 'publicProfiles', userId), (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data());
      } else {
        toast.error("Profile not found");
        navigate(-1);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `publicProfiles/${userId}`);
      setLoading(false);
    });

    // Fetch rank
    const fetchRank = async () => {
      try {
        const profilesRef = collection(db, 'publicProfiles');
        const q = query(profilesRef, orderBy('xp', 'desc'));
        const querySnapshot = await getDocs(q);
        let currentRank = 1;
        let found = false;
        querySnapshot.forEach((docSnap) => {
          if (!found) {
            if (docSnap.id === userId) {
              found = true;
            } else {
              currentRank++;
            }
          }
        });
        if (found) {
          setRank(currentRank);
        }
      } catch (error) {
        console.error("Error fetching rank:", error);
      }
    };
    fetchRank();

    // Check friendship status
    let unsubscribeFriend: (() => void) | undefined;
    let unsubscribeSentReq: (() => void) | undefined;
    let unsubscribeReceivedReq: (() => void) | undefined;

    if (user) {
      // Listen to friendship
      unsubscribeFriend = onSnapshot(doc(db, 'users', user.uid, 'friends', userId), (docSnap) => {
        if (docSnap.exists()) {
          setFriendStatus('friends');
        } else {
          // If not friends, listen to friend requests
          // 1. Sent request
          unsubscribeSentReq = onSnapshot(doc(db, `users/${userId}/friendRequests`, user.uid), (sentSnap) => {
            if (sentSnap.exists()) {
              setFriendStatus('pending');
            } else {
              // 2. Received request
              unsubscribeReceivedReq = onSnapshot(doc(db, `users/${user.uid}/friendRequests`, userId), (receivedSnap) => {
                if (receivedSnap.exists()) {
                  setFriendStatus('pending');
                } else {
                  setFriendStatus('none');
                }
              });
            }
          });
        }
      });
    }

    return () => {
      unsubscribeProfile();
      if (unsubscribeFriend) unsubscribeFriend();
      if (unsubscribeSentReq) unsubscribeSentReq();
      if (unsubscribeReceivedReq) unsubscribeReceivedReq();
    };
  }, [userId, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] dark:bg-gray-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const stats = [
    { label: 'Daily Streak', value: profile?.streak || 0, icon: Flame, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
    { label: 'Total XP', value: profile?.xp || 0, icon: Trophy, color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
    { label: 'Level', value: profile?.level || 1, icon: Star, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    { label: 'Life Score', value: profile?.lifeScore || 0, icon: Heart, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
  ];

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-gray-900 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-700 px-4 py-4 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-300" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">Profile</h1>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-8">
        {/* Profile Card */}
        <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 shadow-xl shadow-orange-500/5 border border-gray-100 dark:border-gray-700 relative overflow-hidden mb-8">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -mr-16 -mt-16 blur-2xl" />
          
          <div className="flex flex-col items-center text-center relative z-10">
            <div className="relative mb-6">
              <div className="w-32 h-32 rounded-full bg-orange-100 dark:bg-orange-900/30 p-1 border-2 border-orange-500/20 overflow-hidden">
                <img 
                  src={getAvatarUrl(profile)} 
                  alt={profile?.name} 
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-orange-500 text-white p-2 rounded-full shadow-lg">
                <Shield className="w-5 h-5" />
              </div>
            </div>

            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-1">{profile?.name}</h2>
            <p className="text-orange-500 font-bold mb-6">@{profile?.username}</p>

            <div className="flex gap-3 w-full max-w-xs">
              <button 
                onClick={() => navigate(`/chat/${userId}`)}
                className="flex-1 bg-orange-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-orange-500/30 hover:bg-orange-600 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-5 h-5" />
                Message
              </button>
              {friendStatus === 'none' && (
                <button className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white py-4 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all active:scale-95 flex items-center justify-center gap-2">
                  <UserPlus className="w-5 h-5" />
                  Add
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-lg shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700"
            >
              <div className={`w-12 h-12 ${stat.bg} rounded-2xl flex items-center justify-center mb-4`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div className="text-2xl font-black text-gray-900 dark:text-white mb-1">
                {stat.value}
              </div>
              <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Additional Info */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Joined</p>
              <p className="font-bold text-gray-900 dark:text-white">
                {profile?.createdAt ? new Date(profile.createdAt.seconds * 1000).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Recently'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center">
              <Hash className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Global Rank</p>
              <p className="font-bold text-gray-900 dark:text-white">
                {rank ? `#${rank}` : 'Calculating...'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FriendProfile;
