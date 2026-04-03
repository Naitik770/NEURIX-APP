import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { collection, query, onSnapshot, doc, updateDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Check, Trash2, Edit2, Play, Activity, RotateCcw, Pause, Flame, Droplet, Wind, Footprints, Book, Moon, Coffee, Dumbbell, Brain, Heart, Music, Utensils, Sun, Timer, Pencil } from 'lucide-react';
import { HABIT_ICONS as icons } from '../constants';

export default function DailyRoutine() {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [habits, setHabits] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState<any | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDuration, setNewTaskDuration] = useState('');
  const [newTaskIcon, setNewTaskIcon] = useState('check');
  const [showVerification, setShowVerification] = useState<string | null>(null);
  const [activeTimerHabit, setActiveTimerHabit] = useState<any | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/habits`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHabits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/habits`));
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0 && isTimerRunning) {
      setIsTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleComplete = (habitId: string) => setShowVerification(habitId);

  const confirmCompletion = async (habitId: string, confirmed: boolean) => {
    setShowVerification(null);
    if (!confirmed || !user) return;
    try {
      const habitRef = doc(db, `users/${user.uid}/habits`, habitId);
      const habit = habits.find(h => h.id === habitId);
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      if (habit?.lastCompleted === todayStr) {
        return; // Already completed today
      }
      
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const isCompletedYesterday = habit?.lastCompleted === yesterdayStr;
      const newStreak = isCompletedYesterday ? (habit?.streak || 0) + 1 : 1;

      await updateDoc(habitRef, {
        streak: newStreak,
        lastCompleted: todayStr
      });
      await addDoc(collection(db, `users/${user.uid}/habitCompletions`), {
        habitId,
        completedAt: serverTimestamp(),
        date: todayStr
      });
      await updateDoc(doc(db, `users/${user.uid}`), { xp: (profile?.xp || 0) + 10 });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/habits/${habitId}`);
    }
  };

  const handleAddTask = async () => {
    if (!user || !newTaskTitle.trim()) return;
    const selectedIcon = icons.find(i => i.id === newTaskIcon) || icons[0];
    const duration = parseInt(newTaskDuration);
    try {
      if (editingHabit) {
        await updateDoc(doc(db, `users/${user.uid}/habits`, editingHabit.id), {
          title: newTaskTitle.trim(),
          isTimerBased: !isNaN(duration) && duration > 0,
          durationMins: !isNaN(duration) && duration > 0 ? duration : null,
          icon: selectedIcon.id,
          color: selectedIcon.color,
          bg: selectedIcon.bg,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, `users/${user.uid}/habits`), {
          uid: user.uid,
          title: newTaskTitle.trim(),
          streak: 0,
          isTimerBased: !isNaN(duration) && duration > 0,
          durationMins: !isNaN(duration) && duration > 0 ? duration : null,
          icon: selectedIcon.id,
          color: selectedIcon.color,
          bg: selectedIcon.bg,
          createdAt: serverTimestamp()
        });
      }
      setShowAddModal(false);
      setEditingHabit(null);
      setNewTaskTitle('');
      setNewTaskDuration('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/habits`);
    }
  };

  const handleDeleteTask = async (habitId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/habits`, habitId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/habits/${habitId}`);
    }
  };

  const openEditModal = (habit: any) => {
    setEditingHabit(habit);
    setNewTaskTitle(habit.title);
    setNewTaskDuration(habit.durationMins?.toString() || '');
    setNewTaskIcon(habit.icon || 'check');
    setShowAddModal(true);
  };

  return (
    <div className="p-6 pt-12 min-h-screen bg-[#FDFBF7] dark:bg-gray-900 pb-32 transition-colors duration-300 overflow-y-auto">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('home.dailyRoutine')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage all your daily tasks</p>
        </div>
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      <div className="space-y-4">
        {habits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
            <Activity className="w-16 h-16 mb-4 text-gray-400" />
            <p className="text-gray-500 dark:text-gray-400">No tasks set yet.</p>
          </div>
        ) : (
          habits.map((habit) => (
            <motion.div 
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={habit.id}
              className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between group transition-all duration-300"
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <button 
                  onClick={() => handleComplete(habit.id)}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${habit.lastCompleted === new Date().toISOString().split('T')[0] ? 'border-orange-500 bg-orange-500' : 'border-gray-200 dark:border-gray-600 hover:border-orange-400'}`}
                >
                  <AnimatePresence>
                    {habit.lastCompleted === new Date().toISOString().split('T')[0] && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                      >
                        <Check className="w-4 h-4 text-white" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${habit.bg || 'bg-gray-100 dark:bg-gray-700'} ${habit.color || 'text-gray-500'}`}>
                  <Activity className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate">{habit.title}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                    <Flame className="w-3 h-3 mr-1 text-orange-500" />
                    Streak {habit.streak} days
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {habit.durationMins && (
                  <button 
                    onClick={() => {
                      setActiveTimerHabit(habit);
                      setTimeLeft(habit.durationMins * 60);
                      setIsTimerRunning(false);
                    }}
                    className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-500 flex items-center justify-center hover:bg-orange-100 transition-colors"
                  >
                    <Play className="w-4 h-4 ml-0.5" />
                  </button>
                )}
                <button 
                  onClick={() => openEditModal(habit)}
                  className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-400 hover:text-orange-500 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDeleteTask(habit.id)}
                  className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* FAB */}
      <button 
        onClick={() => {
          setEditingHabit(null);
          setNewTaskTitle('');
          setNewTaskDuration('');
          setShowAddModal(true);
        }}
        className="fixed bottom-24 right-6 w-14 h-14 bg-orange-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-orange-600 transition-transform active:scale-95 z-40"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative transition-colors duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <button onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">{editingHabit ? 'Edit Task' : 'New Task'}</h3>
              <div className="space-y-4">
                <input 
                  type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Task Name" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-orange-500 text-gray-900 dark:text-white"
                />
                <input 
                  type="number" value={newTaskDuration} onChange={(e) => setNewTaskDuration(e.target.value)}
                  placeholder="Duration (mins)" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-orange-500 text-gray-900 dark:text-white"
                />
                
                <div className="pt-2">
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Select Icon</label>
                  <div className="grid grid-cols-4 gap-3 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                    {icons.map((icon) => (
                      <button
                        key={`routine-${icon.id}`}
                        onClick={() => setNewTaskIcon(icon.id)}
                        className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${icon.bg.replace('bg-', 'bg-').replace('100', '100 dark:bg-opacity-20')} ${icon.color} ${newTaskIcon === icon.id ? 'ring-2 ring-offset-2 ring-orange-500 scale-110 dark:ring-offset-gray-800' : 'hover:scale-105'}`}
                      >
                        <icon.component className="w-5 h-5" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={handleAddTask} className="w-full mt-8 py-4 rounded-xl font-semibold text-white bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/30">
                {editingHabit ? 'Save Changes' : 'Create Task'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Verification Popup */}
      <AnimatePresence>
        {showVerification && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }} 
              className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-4"><Activity className="w-8 h-8" /></div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('home.dontCheat')}</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-8">{t('home.reallyCompleted')}</p>
              <div className="flex gap-4">
                <button onClick={() => confirmCompletion(showVerification!, false)} className="flex-1 py-3 rounded-xl font-semibold text-gray-500 bg-gray-100 dark:bg-gray-700">Not yet</button>
                <button onClick={() => confirmCompletion(showVerification!, true)} className="flex-1 py-3 rounded-xl font-semibold text-white bg-orange-500">Yes, I did!</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Timer Modal */}
      <AnimatePresence>
        {activeTimerHabit && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <button onClick={() => { setActiveTimerHabit(null); setIsTimerRunning(false); }} className="absolute top-4 right-4 w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-500"><X className="w-4 h-4" /></button>
              <div className="w-16 h-16 rounded-2xl bg-orange-100 dark:bg-orange-900/20 text-orange-500 flex items-center justify-center mx-auto mb-4"><Activity className="w-8 h-8" /></div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{activeTimerHabit.title}</h3>
              <div className="text-6xl font-mono font-light text-gray-900 dark:text-white mb-8 tracking-tighter">{formatTime(timeLeft)}</div>
              <div className="flex justify-center items-center gap-6 mb-8">
                <button onClick={() => setTimeLeft(activeTimerHabit.durationMins * 60)} className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500"><RotateCcw className="w-5 h-5" /></button>
                <button onClick={() => setIsTimerRunning(!isTimerRunning)} className="w-20 h-20 rounded-full bg-orange-500 flex items-center justify-center text-white shadow-xl shadow-orange-500/30">{isTimerRunning ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}</button>
              </div>
              <button onClick={() => { confirmCompletion(activeTimerHabit.id, true); setActiveTimerHabit(null); setIsTimerRunning(false); }} className="w-full py-4 rounded-xl font-semibold text-white bg-gray-900 dark:bg-white dark:text-gray-900">Mark as Done</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
