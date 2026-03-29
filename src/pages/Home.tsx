import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, getAvatarUrl } from '../App';
import { format, addDays, startOfWeek } from 'date-fns';
import { Bell, Plus, Check, Clock, Droplet, Wind, Activity, Footprints, Play, Pause, RotateCcw, X, Trash2, Edit2, Book, Moon, Coffee, Dumbbell, Brain, Heart, Music, Utensils, Sun, Timer, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, onSnapshot, doc, updateDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useTranslation } from 'react-i18next';
import { HABIT_ICONS as icons } from '../constants';

export default function Home() {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const [habits, setHabits] = useState<any[]>([]);
  const [showVerification, setShowVerification] = useState<string | null>(null);
  const [activeTimerHabit, setActiveTimerHabit] = useState<any | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDuration, setNewTaskDuration] = useState('');
  const [newTaskIcon, setNewTaskIcon] = useState('check');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
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

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/habits`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedHabits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHabits(fetchedHabits);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/habits`));

    return () => unsubscribe();
  }, [user]);

  const handleComplete = async (habitId: string) => {
    setShowVerification(habitId);
  };

  const [weeklyActivity, setWeeklyActivity] = useState<number[]>(new Array(7).fill(0));

  useEffect(() => {
    if (!user) return;
    
    // Fetch Game Sessions and Habit Completions for the last 7 days
    const qGames = query(collection(db, `users/${user.uid}/gameSessions`));
    const qHabits = query(collection(db, `users/${user.uid}/habitCompletions`));
    
    const activity = new Array(7).fill(0);
    const today = new Date();
    
    const unsubscribeGames = onSnapshot(qGames, (snapshot) => {
      const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const newActivity = new Array(7).fill(0);
      
      // Process Games
      sessions.forEach((s: any) => {
        if (s.playedAt) {
          const date = s.playedAt.toDate();
          const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays >= 0 && diffDays < 7) {
            const dayIndex = (date.getDay() + 6) % 7;
            newActivity[dayIndex] += 15; // Each game adds 15%
          }
        }
      });

      // We need to fetch habits too, but onSnapshot for both might be tricky to sync perfectly.
      // Let's just update state when either changes.
      setWeeklyActivity(prev => {
        const combined = [...newActivity];
        // We'll handle habits separately or use a combined listener if possible.
        // For simplicity, let's just use the latest game data and add habit data if we have it.
        return combined.map(v => Math.min(100, v));
      });
    });

    const unsubscribeHabits = onSnapshot(qHabits, (snapshot) => {
      const completions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      setWeeklyActivity(prev => {
        const updated = [...prev];
        completions.forEach((c: any) => {
          if (c.completedAt) {
            const date = c.completedAt.toDate();
            const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays >= 0 && diffDays < 7) {
              const dayIndex = (date.getDay() + 6) % 7;
              updated[dayIndex] += 10; // Each habit adds 10%
            }
          }
        });
        return updated.map(v => Math.min(100, v));
      });
    });

    return () => {
      unsubscribeGames();
      unsubscribeHabits();
    };
  }, [user]);

  const confirmCompletion = async (habitId: string, confirmed: boolean) => {
    setShowVerification(null);
    if (!confirmed || !user) return;

    try {
      const habitRef = doc(db, `users/${user.uid}/habits`, habitId);
      const habit = habits.find(h => h.id === habitId);
      const todayStr = new Date().toISOString().split('T')[0];
      if (habit?.lastCompleted === todayStr) {
        return; // Already completed today
      }
      
      await updateDoc(habitRef, {
        streak: (habit?.streak || 0) + 1,
        lastCompleted: todayStr
      });
      
      // Record completion in history for analytics
      await addDoc(collection(db, `users/${user.uid}/habitCompletions`), {
        habitId,
        completedAt: serverTimestamp(),
        date: todayStr
      });
      
      const userRef = doc(db, `users/${user.uid}`);
      await updateDoc(userRef, {
        xp: (profile?.xp || 0) + 10
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user?.uid}/habits/${habitId}`);
    }
  };

  const [editingHabit, setEditingHabit] = useState<any | null>(null);

  const handleEditTask = async () => {
    if (!user || !editingHabit || !newTaskTitle.trim()) return;
    
    const selectedIcon = icons.find(i => i.id === newTaskIcon) || icons[0];
    const duration = parseInt(newTaskDuration);

    try {
      const habitRef = doc(db, `users/${user.uid}/habits`, editingHabit.id);
      await updateDoc(habitRef, {
        title: newTaskTitle.trim(),
        isTimerBased: !isNaN(duration) && duration > 0,
        durationMins: !isNaN(duration) && duration > 0 ? duration : null,
        icon: selectedIcon.id,
        color: selectedIcon.color,
        bg: selectedIcon.bg,
        updatedAt: serverTimestamp()
      });
      setShowAddModal(false);
      setEditingHabit(null);
      setNewTaskTitle('');
      setNewTaskDuration('');
      setNewTaskIcon('check');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/habits/${editingHabit.id}`);
    }
  };

  const openEditModal = (habit: any) => {
    setEditingHabit(habit);
    setNewTaskTitle(habit.title);
    setNewTaskDuration(habit.durationMins?.toString() || '');
    setNewTaskIcon(habit.icon || 'check');
    setShowAddModal(true);
  };

  const handleAddTask = async () => {
    if (editingHabit) {
      handleEditTask();
      return;
    }
    if (!user || !newTaskTitle.trim()) return;
    
    const selectedIcon = icons.find(i => i.id === newTaskIcon) || icons[0];
    const duration = parseInt(newTaskDuration);

    try {
      await addDoc(collection(db, `users/${user.uid}/habits`), {
        uid: user.uid,
        title: newTaskTitle.trim(),
        streak: 0,
        isTimerBased: !isNaN(duration) && duration > 0,
        ...( !isNaN(duration) && duration > 0 ? { durationMins: duration } : {} ),
        icon: selectedIcon.id,
        color: selectedIcon.color,
        bg: selectedIcon.bg,
        createdAt: serverTimestamp()
      });
      setShowAddModal(false);
      setNewTaskTitle('');
      setNewTaskDuration('');
      setNewTaskIcon('check');
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

  const [reminders, setReminders] = useState<any[]>([]);
  const [showAddReminderModal, setShowAddReminderModal] = useState(false);
  const [showReminder, setShowReminder] = useState(true);
  const [newReminderTitle, setNewReminderTitle] = useState('');
  const [newReminderTime, setNewReminderTime] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/reminders`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedReminders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReminders(fetchedReminders);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/reminders`));

    return () => unsubscribe();
  }, [user]);

  const handleAddReminder = async () => {
    if (!user || !newReminderTitle.trim() || !newReminderTime) return;
    
    const [hours, minutes] = newReminderTime.split(':');
    const time = new Date();
    time.setHours(parseInt(hours));
    time.setMinutes(parseInt(minutes));
    time.setSeconds(0);

    try {
      await addDoc(collection(db, `users/${user.uid}/reminders`), {
        uid: user.uid,
        title: newReminderTitle.trim(),
        time: time,
        createdAt: serverTimestamp(),
        lastNotified: null
      });
      setShowAddReminderModal(false);
      setNewReminderTitle('');
      setNewReminderTime('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/reminders`);
    }
  };

  const today = new Date();
  const start = startOfWeek(today, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(start, i));

  const getIcon = (name: string) => {
    switch (name) {
      case 'droplet': return <Droplet className="w-5 h-5" />;
      case 'wind': return <Wind className="w-5 h-5" />;
      case 'activity': return <Activity className="w-5 h-5" />;
      case 'footprints': return <Footprints className="w-5 h-5" />;
      case 'book': return <Book className="w-5 h-5" />;
      case 'moon': return <Moon className="w-5 h-5" />;
      case 'coffee': return <Coffee className="w-5 h-5" />;
      case 'dumbbell': return <Dumbbell className="w-5 h-5" />;
      case 'brain': return <Brain className="w-5 h-5" />;
      case 'heart': return <Heart className="w-5 h-5" />;
      case 'music': return <Music className="w-5 h-5" />;
      case 'utensils': return <Utensils className="w-5 h-5" />;
      case 'sun': return <Sun className="w-5 h-5" />;
      case 'timer': return <Timer className="w-5 h-5" />;
      case 'pencil': return <Pencil className="w-5 h-5" />;
      default: return <Check className="w-5 h-5" />;
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('home.goodMorning', 'Good Morning');
    if (hour < 17) return t('home.goodAfternoon', 'Good Afternoon');
    if (hour < 21) return t('home.goodEvening', 'Good Evening');
    return t('home.goodNight', 'Good Night');
  };

  return (
    <div className="p-6 pt-12 min-h-screen relative bg-[#FDFBF7] dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-300 overflow-y-auto">
      <header className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-1">
            {getGreeting()}, {profile?.name?.split(' ')[0] || 'User'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{format(today, 'EEEE, d MMMM, yyyy')}</p>
        </div>
        <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 overflow-hidden border-2 border-white dark:border-gray-800 shadow-sm transition-colors duration-300">
          <img src={getAvatarUrl(profile, user)} alt="Avatar" className="w-full h-full object-cover" />
        </div>
      </header>

      {/* Reminder Card */}
      <AnimatePresence>
        {showReminder && (
          <motion.div 
            initial={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className="bg-white dark:bg-gray-800 rounded-3xl p-6 mb-8 flex justify-between items-center relative overflow-hidden shadow-sm transition-colors duration-300"
          >
            <div className="z-10 relative">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{t('home.setReminder', 'Set the reminder')}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-[200px]">{t('home.reminderDesc', 'Never miss your morning routine! Set a reminder to stay on track')}</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowAddReminderModal(true)}
                  className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-5 py-2.5 rounded-full text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
                >
                  {t('home.setNow', 'Set Now')}
                </button>
                <Link 
                  to="/reminders"
                  className="bg-gray-100/50 dark:bg-gray-700/50 backdrop-blur-sm text-gray-900 dark:text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-gray-200/50 dark:hover:bg-gray-600/50 transition-colors"
                >
                  {t('home.viewAll')}
                </Link>
              </div>
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-orange-400 opacity-80">
              <Bell className="w-20 h-20 fill-current" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calendar Strip */}
      <div className="flex justify-between mb-8">
        {weekDays.map((date, i) => {
          const isToday = format(date, 'd') === format(today, 'd');
          return (
            <div key={i} className="flex flex-col items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{format(date, 'EEE')}</span>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors duration-300 ${isToday ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'}`}>
                {format(date, 'd')}
              </div>
            </div>
          );
        })}
      </div>

      {/* Weekly Progress Section */}
      <div className="mb-8">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Weekly Progress</h2>
          <Link to="/analytics" className="text-sm text-orange-500 font-medium hover:text-orange-600">Details</Link>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-transparent dark:border-gray-700 transition-colors duration-300">
          <div className="flex justify-between items-end h-24 gap-2">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
              const isToday = i === (new Date().getDay() + 6) % 7;
              const height = weeklyActivity[i] || 5; // Use real data, min 5%
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full bg-gray-50 dark:bg-gray-700 rounded-full h-16 relative overflow-hidden flex flex-col justify-end transition-colors duration-300">
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: `${height}%` }}
                      className={`w-full rounded-full ${isToday ? 'bg-orange-500' : 'bg-orange-200 dark:bg-orange-900/40'}`}
                    />
                  </div>
                  <span className={`text-[10px] font-bold ${isToday ? 'text-orange-500' : 'text-gray-400'}`}>{day}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Daily Routine */}
      <div className="flex justify-between items-end mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('home.dailyRoutine')}</h2>
        <Link 
          to="/daily-routine"
          className="text-sm text-gray-500 dark:text-gray-400 font-medium hover:text-gray-900 dark:hover:text-white"
        >
          {t('home.viewAll')}
        </Link>
      </div>

      <div className="space-y-4 relative min-h-[100px]">
        {/* Vertical Line */}
        {habits.length > 0 && (
          <div className="absolute left-[23px] top-4 bottom-4 w-px bg-gray-100 dark:bg-gray-800 -z-10 transition-colors duration-300" />
        )}

        {habits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700 transition-colors duration-300">
            <div className="w-16 h-16 bg-orange-50 dark:bg-orange-900/20 text-orange-400 rounded-full flex items-center justify-center mb-4 transition-colors duration-300">
              <Activity className="w-8 h-8" />
            </div>
            <h3 className="text-gray-900 dark:text-white font-semibold mb-1">{t('home.noTasks', 'No tasks yet')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-[200px]">
              {t('home.tapToAdd', 'Tap the + button below to create your first daily task.')}
            </p>
          </div>
        ) : (
          habits.slice(0, 5).map((habit) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={habit.id} 
              className="bg-white dark:bg-gray-800 rounded-2xl p-4 flex items-center gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)] relative group border border-transparent dark:border-gray-700 transition-colors duration-300"
            >
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleComplete(habit.id)}
                disabled={habit.lastCompleted === new Date().toISOString().split('T')[0]}
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center bg-white dark:bg-gray-800 transition-all shrink-0 ${habit.lastCompleted === new Date().toISOString().split('T')[0] ? 'border-orange-500 bg-orange-500 text-white cursor-not-allowed' : 'border-gray-200 dark:border-gray-600 text-transparent hover:border-orange-400 dark:hover:border-orange-500'}`}
              >
                <motion.div
                  initial={false}
                  animate={{ 
                    scale: habit.lastCompleted === new Date().toISOString().split('T')[0] ? 1 : 0,
                    opacity: habit.lastCompleted === new Date().toISOString().split('T')[0] ? 1 : 0
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                >
                  <Check className="w-4 h-4" />
                </motion.div>
              </motion.button>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${habit.bg || 'bg-gray-100 dark:bg-gray-700'} ${habit.color || 'text-gray-500 dark:text-gray-400'}`}>
                {getIcon(habit.icon)}
              </div>
              <div className="flex-1 min-w-0 pr-2">
                <h3 className={`text-gray-900 dark:text-white font-medium truncate ${habit.lastCompleted === new Date().toISOString().split('T')[0] ? 'opacity-50 line-through' : ''}`}>{habit.title}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Streak {habit.streak} days</p>
              </div>
              <div className="flex items-center gap-2">
                {habit.lastCompleted === new Date().toISOString().split('T')[0] && (
                  <span className="text-[10px] font-bold text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-full uppercase">Completed</span>
                )}
                {habit.durationMins && habit.lastCompleted !== new Date().toISOString().split('T')[0] && (
                  <button 
                    onClick={() => {
                      setActiveTimerHabit(habit);
                      setTimeLeft(habit.durationMins * 60);
                      setIsTimerRunning(false);
                    }}
                    className="flex flex-col items-center justify-center gap-1 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40 w-12 h-12 rounded-xl transition-colors shrink-0"
                  >
                    <Play className="w-4 h-4 text-orange-500 ml-0.5" />
                    <span className="text-[10px] text-orange-600 dark:text-orange-400 font-bold">{habit.durationMins}m</span>
                  </button>
                )}
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => openEditModal(habit)}
                    className="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteTask(habit.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
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
          setNewTaskIcon('check');
          setShowAddModal(true);
        }}
        className="fixed bottom-24 right-6 w-14 h-14 bg-[#5C4033] text-white rounded-full flex items-center justify-center shadow-lg hover:bg-[#4A332A] transition-transform active:scale-95 z-40"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Add Task Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative transition-colors duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setEditingHabit(null);
                }}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                {editingHabit ? 'Edit Task' : t('home.addNewTask', 'Add New Task')}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('home.taskName', 'Task Name')}</label>
                  <input 
                    type="text" 
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder={t('home.taskPlaceholder', 'e.g., Read 10 pages')}
                    className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-xl px-4 py-3 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all text-gray-900 dark:text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('home.duration', 'Duration (minutes, optional)')}</label>
                  <input 
                    type="number" 
                    value={newTaskDuration}
                    onChange={(e) => setNewTaskDuration(e.target.value)}
                    placeholder={t('home.durationPlaceholder', 'e.g., 15')}
                    className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-xl px-4 py-3 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">{t('home.icon', 'Icon')}</label>
                  <div className="grid grid-cols-4 gap-3 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                    {icons.map((icon) => (
                      <button
                        key={`add-${icon.id}`}
                        onClick={() => setNewTaskIcon(icon.id)}
                        className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${icon.bg.replace('bg-', 'bg-').replace('100', '100 dark:bg-opacity-20')} ${icon.color} ${newTaskIcon === icon.id ? 'ring-2 ring-offset-2 ring-orange-500 scale-110 dark:ring-offset-gray-800' : 'hover:scale-105'}`}
                      >
                        <icon.component className="w-5 h-5" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button 
                onClick={handleAddTask}
                disabled={!newTaskTitle.trim()}
                className="w-full mt-8 py-4 rounded-xl font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:hover:bg-orange-500 transition-colors shadow-lg shadow-orange-500/30"
              >
                {editingHabit ? 'Save Changes' : t('home.createTask', 'Create Task')}
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
              className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl transition-colors duration-300"
            >
              <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors duration-300">
                <Activity className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('home.dontCheat', "Don't cheat yourself.")}</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-8">{t('home.reallyCompleted', 'Have you really completed this task?')}</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => confirmCompletion(showVerification, false)}
                  className="flex-1 py-3 rounded-xl font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {t('home.notYet', 'Not yet')}
                </button>
                <button 
                  onClick={() => confirmCompletion(showVerification, true)}
                  className="flex-1 py-3 rounded-xl font-semibold text-white bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/30 transition-colors"
                >
                  {t('home.yesIDid', 'Yes, I did!')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Timer Modal */}
      <AnimatePresence>
        {activeTimerHabit && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl relative border border-transparent dark:border-gray-700 transition-colors duration-300"
            >
              <button 
                onClick={() => {
                  setActiveTimerHabit(null);
                  setIsTimerRunning(false);
                }}
                className="absolute top-4 right-4 w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${activeTimerHabit.bg.replace('bg-', 'bg-').replace('100', '100 dark:bg-opacity-20')} ${activeTimerHabit.color}`}>
                {getIcon(activeTimerHabit.icon)}
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{activeTimerHabit.title}</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">{t('home.focusTask', 'Focus and complete your task')}</p>
              
              <div className="text-6xl font-mono font-light text-gray-900 dark:text-white mb-8 tracking-tighter">
                {formatTime(timeLeft)}
              </div>
              
              <div className="flex justify-center items-center gap-6 mb-8">
                <button 
                  onClick={() => {
                    setTimeLeft(activeTimerHabit.durationMins * 60);
                    setIsTimerRunning(false);
                  }}
                  className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setIsTimerRunning(!isTimerRunning)}
                  className="w-20 h-20 rounded-full bg-orange-500 flex items-center justify-center text-white hover:bg-orange-600 shadow-xl shadow-orange-500/30 transition-transform hover:scale-105 active:scale-95"
                >
                  {isTimerRunning ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
                </button>
                <div className="w-12 h-12" /> {/* Spacer */}
              </div>
              
              <button 
                onClick={() => {
                  const habitId = activeTimerHabit.id;
                  setActiveTimerHabit(null);
                  setIsTimerRunning(false);
                  handleComplete(habitId);
                }}
                className="w-full py-4 rounded-xl font-semibold text-white bg-gray-900 dark:bg-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors shadow-lg"
              >
                {t('home.markAsDone', 'Mark as Done')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Reminder Modal */}
      <AnimatePresence>
        {showAddReminderModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative transition-colors duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <button 
                onClick={() => setShowAddReminderModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">{t('home.addReminder')}</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('home.reminderTitle', 'Reminder Title')}</label>
                  <input 
                    type="text" 
                    value={newReminderTitle}
                    onChange={(e) => setNewReminderTitle(e.target.value)}
                    placeholder={t('home.reminderPlaceholder', 'e.g., Drink water')}
                    className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-xl px-4 py-3 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all text-gray-900 dark:text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('home.time', 'Time')}</label>
                  <input 
                    type="time" 
                    value={newReminderTime}
                    onChange={(e) => setNewReminderTime(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-xl px-4 py-3 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <button 
                onClick={handleAddReminder}
                disabled={!newReminderTitle.trim() || !newReminderTime}
                className="w-full mt-8 py-4 rounded-xl font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:hover:bg-orange-500 transition-colors shadow-lg shadow-orange-500/30"
              >
                {t('home.setReminderBtn', 'Set Reminder')}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
