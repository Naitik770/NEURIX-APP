import { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ChevronLeft, Save, Moon, Sun, Bell, Globe, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export default function Settings() {
  const { user, profile, theme, setTheme } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [formData, setFormData] = useState({
    name: profile?.name || '',
    age: profile?.age || 0,
    height: profile?.height || 0,
    weight: profile?.weight || 0,
    personality: profile?.personality || '',
  });
  const [language, setLanguage] = useState(localStorage.getItem('appLanguage') || 'en');
  const [notifications, setNotifications] = useState(true);

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        age: profile.age || 0,
        height: profile.height || 0,
        weight: profile.weight || 0,
        personality: profile.personality || '',
      });
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        ...formData,
        updatedAt: serverTimestamp()
      });
      localStorage.setItem('appLanguage', language);
      i18n.changeLanguage(language);
      localStorage.setItem('appTheme', theme);
      toast.success(t('settings.success'));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('appTheme', newTheme);
  };

  return (
    <div className="p-6 pt-12 min-h-screen bg-[#FDFBF7] dark:bg-gray-900 pb-32 transition-colors duration-300">
      <header className="flex items-center mb-10">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white ml-4">{t('settings.title')}</h1>
      </header>

      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm transition-colors duration-300">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><User className="w-5 h-5" /> {t('settings.personalData')}</h2>
          <div className="space-y-4">
            <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder={t('settings.name')} className="w-full bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl px-4 py-3 outline-none transition-colors duration-300" />
            <input type="number" value={formData.age} onChange={(e) => setFormData({...formData, age: Number(e.target.value)})} placeholder={t('settings.age')} className="w-full bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl px-4 py-3 outline-none transition-colors duration-300" />
            <input type="number" value={formData.height} onChange={(e) => setFormData({...formData, height: Number(e.target.value)})} placeholder={t('settings.height')} className="w-full bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl px-4 py-3 outline-none transition-colors duration-300" />
            <input type="number" value={formData.weight} onChange={(e) => setFormData({...formData, weight: Number(e.target.value)})} placeholder={t('settings.weight')} className="w-full bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl px-4 py-3 outline-none transition-colors duration-300" />
            <select value={formData.personality} onChange={(e) => setFormData({...formData, personality: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl px-4 py-3 outline-none transition-colors duration-300">
              <option value="">{t('settings.personality')}</option>
              <option value="Analytical">Analytical</option>
              <option value="Creative">Creative</option>
              <option value="Adventurous">Adventurous</option>
              <option value="Calm">Calm</option>
              <option value="Energetic">Energetic</option>
            </select>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm transition-colors duration-300">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Globe className="w-5 h-5" /> {t('settings.language')}</h2>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl px-4 py-3 outline-none transition-colors duration-300">
            <option value="en">English</option>
            <option value="hi">Hindi (हिंदी)</option>
          </select>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm flex justify-between items-center transition-colors duration-300">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">{theme === 'light' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />} {t('settings.theme')}</h2>
          <button onClick={toggleTheme} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 dark:text-white rounded-xl font-medium transition-colors duration-300">{theme === 'light' ? t('settings.light') : t('settings.dark')}</button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm flex justify-between items-center transition-colors duration-300">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Bell className="w-5 h-5" /> {t('settings.notifications')}</h2>
          <button onClick={() => setNotifications(!notifications)} className={`px-4 py-2 rounded-xl font-medium transition-colors duration-300 ${notifications ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-gray-700 dark:text-white'}`}>{notifications ? t('settings.on') : t('settings.off')}</button>
        </div>

        <button onClick={handleSave} className="w-full bg-orange-500 text-white py-4 rounded-full font-semibold text-lg hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30">
          <Save className="w-5 h-5" /> {t('settings.saveChanges')}
        </button>
      </div>
    </div>
  );
}
