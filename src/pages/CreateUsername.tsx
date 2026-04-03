import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, updateDoc, getDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { toast } from 'sonner';
import { useAuth } from '../App';

export default function CreateUsername() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (profile?.username) {
      navigate('/');
    }
  }, [profile, navigate]);

  const checkUsername = async (val: string) => {
    if (val.length < 3) {
      setIsAvailable(null);
      return;
    }
    setChecking(true);
    try {
      const usernameRef = doc(db, 'usernames', val.toLowerCase());
      const docSnap = await getDoc(usernameRef);
      if (docSnap.exists()) {
        // If it exists, check if it's reserved by ME
        if (docSnap.data().uid === user?.uid) {
          setIsAvailable(true);
        } else {
          setIsAvailable(false);
        }
      } else {
        setIsAvailable(true);
      }
    } catch (error) {
      console.error('Error checking username:', error);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (username) checkUsername(username);
    }, 500);
    return () => clearTimeout(timer);
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !isAvailable || !user) {
      toast.error('Please choose a valid and available username');
      return;
    }

    setLoading(true);
    try {
      const lowerUsername = username.toLowerCase();
      const usernameRef = doc(db, 'usernames', lowerUsername);
      
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      const publicProfileRef = doc(db, 'publicProfiles', user.uid);
      const publicProfileSnap = await getDoc(publicProfileRef);
      
      const pendingProfileRef = doc(db, 'pendingProfiles', user.uid);
      const pendingSnap = await getDoc(pendingProfileRef);
      const pendingData = pendingSnap.exists() ? pendingSnap.data() : null;
      const name = pendingData?.name || user.displayName || 'User';
      const email = pendingData?.email || user.email || '';
      
      // Claim username
      await setDoc(usernameRef, {
        uid: user.uid,
        createdAt: serverTimestamp()
      });

      // Update/Create user profile
      if (userSnap.exists()) {
        await updateDoc(userRef, {
          username: lowerUsername,
          updatedAt: serverTimestamp()
        });
      } else {
        await setDoc(userRef, {
          uid: user.uid,
          name: name,
          username: lowerUsername,
          email: email,
          xp: 0,
          level: 1,
          streak: 0,
          lifeScore: 50,
          role: 'user',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      // Update/Create public profile
      if (publicProfileSnap.exists()) {
        await updateDoc(publicProfileRef, {
          username: lowerUsername,
          updatedAt: serverTimestamp()
        });
      } else {
        await setDoc(publicProfileRef, {
          uid: user.uid,
          name: name,
          username: lowerUsername,
          avatarSeed: name || 'Aneka',
          avatarStyle: 'avataaars',
          avatarColor: 'transparent',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      
      // Delete pending profile
      if (pendingSnap.exists()) {
        await deleteDoc(pendingProfileRef);
      }

      toast.success('Username created successfully!');
      navigate('/personalization');
    } catch (error: any) {
      console.error('Error creating username:', error);
      toast.error(error.message || 'Failed to create username');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex min-h-screen flex-col items-center justify-center bg-[#FDFBF7] dark:bg-gray-900 p-6 transition-colors duration-300"
    >
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl border border-transparent dark:border-gray-700 transition-colors duration-300">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 transition-colors duration-300">Choose a Username</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8 transition-colors duration-300">This is how others will find you on NEURIX.</p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              className={`w-full p-4 rounded-2xl border ${
                isAvailable === true ? 'border-green-500' : isAvailable === false ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
              } bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all duration-300`}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              {checking ? (
                <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              ) : isAvailable === true ? (
                <span className="text-green-500 text-sm font-bold">Available</span>
              ) : isAvailable === false ? (
                <span className="text-red-500 text-sm font-bold">Taken</span>
              ) : null}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !isAvailable || username.length < 3}
            className="w-full bg-orange-500 text-white py-4 rounded-full font-semibold text-lg hover:bg-orange-600 transition-transform active:scale-95 shadow-lg shadow-orange-500/30 disabled:opacity-50"
          >
            {loading ? 'Setting Username...' : 'Continue'}
          </button>
        </form>
      </div>
    </motion.div>
  );
}
