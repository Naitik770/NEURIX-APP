import { useState, useEffect } from 'react';
import { useAuth, getAvatarUrl } from '../App';
import { logout, db, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { User, Settings, LogOut, Award, Flame, Target, Edit3, Plus, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarSeed, setAvatarSeed] = useState(profile?.avatarSeed || user?.uid || 'Aneka');
  const [avatarStyle, setAvatarStyle] = useState(profile?.avatarStyle || 'avataaars');
  const [avatarColor, setAvatarColor] = useState(profile?.avatarColor || 'transparent');

  const AVATAR_STYLES = [
    { id: 'avataaars', name: 'Human' },
    { id: 'bottts', name: 'Robot' },
    { id: 'pixel-art', name: 'Pixel' },
    { id: 'adventurer', name: 'Adventurer' },
    { id: 'big-smile', name: 'Smile' },
    { id: 'miniavs', name: 'Minimal' }
  ];

  const AVATAR_COLORS = [
    'transparent', 'FF6B6B', '4ECDC4', '45B7D1', '96CEB4', 'FFEEAD', 'D4A5A5', '9B59B6', '34495E'
  ];

  const AVATAR_OPTIONS = [
    'Aneka', 'Bandit', 'Bear', 'Boots', 'Cali', 'Charlie', 'Chester', 'Chloe', 
    'Cleo', 'Coco', 'Cookie', 'Daisy', 'Felix', 'Garfield', 'Gizmo', 'Harley', 
    'Jack', 'Jasper', 'Loki', 'Luna', 'Maggie', 'Max', 'Milo', 'Misty', 
    'Mochi', 'Oliver', 'Oscar', 'Pepper', 'Rocky', 'Sadie', 'Simba', 'Sophie', 
    'Tigger', 'Toby', 'Willow', 'Zoe', 'Abby', 'Bella', 'Buddy', 'Cooper',
    'Duke', 'Emma', 'Finn', 'Ginger', 'Hank', 'Ivy', 'Jake', 'Kobe',
    'Leo', 'Lucy', 'Mia', 'Nala', 'Oreo', 'Piper', 'Quinn', 'Riley',
    'Sam', 'Teddy', 'Uma', 'Vera', 'Winston', 'Xena', 'Yara', 'Zeus'
  ];

  useEffect(() => {
    if (profile) {
      setAvatarSeed(profile.avatarSeed || user?.uid || 'Aneka');
      setAvatarStyle(profile.avatarStyle || 'avataaars');
      setAvatarColor(profile.avatarColor || 'transparent');
    }
  }, [profile, user]);

  const handleSaveAvatar = async () => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        avatarSeed,
        avatarStyle,
        avatarColor,
        updatedAt: serverTimestamp()
      });

      const publicProfileRef = doc(db, 'publicProfiles', user.uid);
      await updateDoc(publicProfileRef, {
        avatarSeed,
        avatarStyle,
        avatarColor,
        updatedAt: serverTimestamp()
      }).catch(() => {
        // Ignore if public profile doesn't exist
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  return (
    <div className="p-6 pt-12 min-h-screen bg-[#FDFBF7] dark:bg-gray-900 pb-32 transition-colors duration-300">
      <header className="flex justify-between items-center mb-10">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Profile</h1>
        <button onClick={() => navigate('/settings')} className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
          <Settings className="w-5 h-5" />
        </button>
      </header>

      <div className="flex flex-col items-center mb-10">
        <div className="w-24 h-24 rounded-full bg-orange-100 dark:bg-orange-900/30 overflow-hidden border-4 border-white dark:border-gray-800 shadow-lg mb-4 relative transition-colors duration-300">
          <img src={getAvatarUrl({ avatarSeed, avatarStyle, avatarColor })} alt="Avatar" className="w-full h-full object-cover" />
          <button onClick={() => setShowAvatarModal(true)} className="absolute bottom-0 right-0 w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white border-2 border-white dark:border-gray-800 transition-colors duration-300">
            <Edit3 className="w-4 h-4" />
          </button>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{profile?.name || 'User'}</h2>
        {profile?.username && (
          <p className="text-orange-500 font-medium text-sm mb-1">@{profile.username}</p>
        )}
        <p className="text-gray-500 dark:text-gray-400 text-sm">{user?.email}</p>
      </div>

      {showAvatarModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 max-w-md w-full shadow-2xl flex flex-col max-h-[90vh] transition-colors duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Customize Avatar</h3>
              <button onClick={() => setShowAvatarModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-8">
              {/* Preview */}
              <div className="flex justify-center">
                <div className="w-32 h-32 rounded-3xl bg-gray-50 dark:bg-gray-700/50 p-2 border-2 border-orange-500/20">
                  <img src={getAvatarUrl({ avatarSeed, avatarStyle, avatarColor })} alt="Preview" className="w-full h-full object-contain" />
                </div>
              </div>

              {/* Style Selection */}
              <div>
                <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Style</h4>
                <div className="grid grid-cols-3 gap-2">
                  {AVATAR_STYLES.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setAvatarStyle(style.id)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border-2 ${avatarStyle === style.id ? 'bg-orange-500 text-white border-orange-500' : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-transparent hover:border-orange-200'}`}
                    >
                      {style.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Selection */}
              <div>
                <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Background Color</h4>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setAvatarColor(color)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${avatarColor === color ? 'border-orange-500 scale-110 ring-2 ring-orange-500/20' : 'border-white dark:border-gray-800'}`}
                      style={{ backgroundColor: color === 'transparent' ? 'transparent' : `#${color}` }}
                    >
                      {color === 'transparent' && <X className="w-4 h-4 mx-auto text-gray-400" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Seed Selection */}
              <div>
                <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Character</h4>
                <div className="grid grid-cols-4 gap-3">
                  {AVATAR_OPTIONS.map((seed) => (
                    <button 
                      key={seed}
                      onClick={() => setAvatarSeed(seed)}
                      className={`aspect-square rounded-2xl overflow-hidden border-2 transition-all bg-gray-50 dark:bg-gray-700/50 ${avatarSeed === seed ? 'border-orange-500 scale-105 shadow-lg' : 'border-transparent hover:border-orange-200'}`}
                    >
                      <img src={getAvatarUrl({ avatarSeed: seed, avatarStyle, avatarColor })} alt={seed} className="w-full h-full object-contain" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-6 mt-6 border-t border-gray-100 dark:border-gray-700 transition-colors duration-300">
              <button onClick={() => setShowAvatarModal(false)} className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 dark:text-white rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">Cancel</button>
              <button onClick={() => { handleSaveAvatar(); setShowAvatarModal(false); }} className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 text-center shadow-sm transition-colors duration-300">
          <div className="w-10 h-10 mx-auto bg-orange-100 dark:bg-orange-500/20 text-orange-500 rounded-full flex items-center justify-center mb-2 transition-colors duration-300">
            <Flame className="w-5 h-5" />
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{profile?.streak || 0}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Day Streak</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 text-center shadow-sm transition-colors duration-300">
          <div className="w-10 h-10 mx-auto bg-purple-100 dark:bg-purple-500/20 text-purple-500 rounded-full flex items-center justify-center mb-2 transition-colors duration-300">
            <Award className="w-5 h-5" />
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">Lvl {profile?.level || 1}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{profile?.xp || 0} XP</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 text-center shadow-sm transition-colors duration-300">
          <div className="w-10 h-10 mx-auto bg-green-100 dark:bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-2 transition-colors duration-300">
            <Target className="w-5 h-5" />
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{Math.min(100, Math.floor((profile?.xp || 0) / 10) + ((profile?.streak || 0) * 2))}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Life Score</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm mb-8 transition-colors duration-300">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Personal Data</h3>
        </div>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-700 transition-colors duration-300">
            <span className="text-gray-500 dark:text-gray-400">Age</span>
            <span className="font-medium text-gray-900 dark:text-white">{profile?.age || 'Not set'}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-700 transition-colors duration-300">
            <span className="text-gray-500 dark:text-gray-400">Height</span>
            <span className="font-medium text-gray-900 dark:text-white">{profile?.height ? `${profile.height} cm` : 'Not set'}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-700 transition-colors duration-300">
            <span className="text-gray-500 dark:text-gray-400">Weight</span>
            <span className="font-medium text-gray-900 dark:text-white">{profile?.weight ? `${profile.weight} kg` : 'Not set'}</span>
          </div>
          <div className="flex justify-between items-center py-3">
            <span className="text-gray-500 dark:text-gray-400">Personality</span>
            <span className="font-medium text-gray-900 dark:text-white">{profile?.personality || 'Not set'}</span>
          </div>
        </div>
      </div>

      <button 
        onClick={logout}
        className="w-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 py-4 rounded-full font-semibold text-lg hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
      >
        <LogOut className="w-5 h-5" />
        Log Out
      </button>
    </div>
  );
}
