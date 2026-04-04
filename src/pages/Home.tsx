import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, getAvatarUrl } from '../App';
import { format, addDays, startOfWeek } from 'date-fns';
import { Users, Bell, Plus, Check, Clock, Droplet, Wind, Activity, Footprints, Play, Pause, RotateCcw, X, Trash2, Edit2, Book, Moon, Coffee, Dumbbell, Brain, Heart, Music, Utensils, Sun, Timer, Pencil, Flame, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, onSnapshot, doc, updateDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { HABIT_ICONS as icons } from '../constants';

// Particle Burst for completion
const ParticleBurst = ({ active }: { active: boolean }) => {
  if (!active) return null;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
          animate={{ 
            scale: [0, 1, 0],
            x: (Math.random() - 0.5) * 100,
            y: (Math.random() - 0.5) * 100,
            opacity: 0
          }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute left-1/2 top-1/2 w-1 h-1 bg-orange-400 rounded-full"
        />
      ))}
    </div>
  );
};


// Focus Mode Component
const FocusMode = ({ habit, timeLeft, isRunning, onToggle, onClose, onComplete }: any) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-gray-900 flex flex-col items-center justify-center p-8 text-white"
    >
      
      <motion.button 
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onClose}
        className="absolute top-8 right-8 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/10"
      >
        <X className="w-6 h-6" />
      </motion.button>

      <div className="text-center relative z-10">
        <motion.div
          animate={{ scale: isRunning ? [1, 1.05, 1] : 1 }}
          transition={{ duration: 4, repeat: Infinity }}
          className="w-48 h-48 rounded-full border-4 border-orange-500/30 flex items-center justify-center mb-12 relative"
        >
          <div className="absolute inset-0 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" style={{ animationDuration: '10s' }} />
          <span className="text-6xl font-black font-mono tracking-tighter">{formatTime(timeLeft)}</span>
        </motion.div>

        <h2 className="text-3xl font-black mb-2 uppercase tracking-tight">{habit.title}</h2>
        <p className="text-orange-400 font-bold uppercase tracking-[0.3em] text-xs mb-12">Deep Focus Session</p>

        <div className="flex gap-6">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onToggle}
            className="w-20 h-20 rounded-full bg-white text-gray-900 flex items-center justify-center shadow-2xl"
          >
            {isRunning ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
          </motion.button>
          
          {timeLeft === 0 && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              onClick={onComplete}
              className="w-20 h-20 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-2xl"
            >
              <Check className="w-8 h-8 stroke-[3]" />
            </motion.button>
          )}
        </div>
      </div>

      <div className="absolute bottom-12 left-0 right-0 px-12">
        <p className="text-center text-gray-500 text-[10px] font-bold uppercase tracking-widest leading-relaxed">
          "The successful warrior is the average man, with laser-like focus."
        </p>
      </div>
    </motion.div>
  );
};

export default function Home() {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const [habits, setHabits] = useState<any[]>([]);
  const [showVerification, setShowVerification] = useState<string | null>(null);
  const [activeTimerHabit, setActiveTimerHabit] = useState<any | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [editingHabit, setEditingHabit] = useState<any | null>(null);
  const [newTaskDuration, setNewTaskDuration] = useState('');
  const [newTaskIcon, setNewTaskIcon] = useState('check');
  const [showReminder, setShowReminder] = useState(true);

  // Level Up Check
  useEffect(() => {
    if (!profile?.xp || !user) return;
    const nextLevelXp = (profile.level || 1) * 100;
    if (profile.xp >= nextLevelXp) {
      const upgradeLevel = async () => {
        try {
          await updateDoc(doc(db, `users/${user.uid}`), {
            level: (profile.level || 1) + 1,
            xp: profile.xp - nextLevelXp
          });
          setShowLevelUp(true);
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#fb923c', '#f97316', '#ea580c']
          });
        } catch (e) {
          console.error("Level up error", e);
        }
      };
      upgradeLevel();
    }
  }, [profile?.xp, profile?.level, user]);


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

  const [rawSessions, setRawSessions] = useState<any[]>([]);
  const [rawCompletions, setRawCompletions] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    
    // Fetch Game Sessions and Habit Completions for the last 7 days
    const qGames = query(collection(db, `users/${user.uid}/gameSessions`));
    const qHabits = query(collection(db, `users/${user.uid}/habitCompletions`));
    
    const unsubscribeGames = onSnapshot(qGames, (snapshot) => {
      setRawSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/gameSessions`));

    const unsubscribeHabits = onSnapshot(qHabits, (snapshot) => {
      setRawCompletions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/habitCompletions`));

    return () => {
      unsubscribeGames();
      unsubscribeHabits();
    };
  }, [user]);

  const weeklyActivity = useMemo(() => {
    const activity = new Array(7).fill(0);
    const today = new Date();
    const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 });
    
    // Process Games
    rawSessions.forEach((s: any) => {
      if (s.playedAt) {
        const date = s.playedAt.toDate();
        if (date >= startOfCurrentWeek) {
          const dayIndex = (date.getDay() + 6) % 7;
          activity[dayIndex] += 15; // Each game adds 15%
        }
      }
    });

    // Process Habits
    rawCompletions.forEach((c: any) => {
      if (c.completedAt) {
        const date = c.completedAt.toDate();
        if (date >= startOfCurrentWeek) {
          const dayIndex = (date.getDay() + 6) % 7;
          activity[dayIndex] += 10; // Each habit adds 10%
        }
      }
    });

    return activity.map(v => Math.min(100, v));
  }, [rawSessions, rawCompletions]);

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

      confetti({
        particleCount: 40,
        spread: 50,
        origin: { y: 0.8 },
        colors: ['#fb923c', '#f97316']
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user?.uid}/habits/${habitId}`);
    }
  };


  const startFocusMode = (habit: any) => {
    setActiveTimerHabit(habit);
    setTimeLeft((habit.durationMins || 25) * 60);
    setIsTimerRunning(true);
    setIsFocusMode(true);
  };

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
      {/* Focus Mode Overlay */}
      <AnimatePresence>
        {isFocusMode && activeTimerHabit && (
          <FocusMode 
            habit={activeTimerHabit}
            timeLeft={timeLeft}
            isRunning={isTimerRunning}
            onToggle={() => setIsTimerRunning(!isTimerRunning)}
            onClose={() => {
              setIsFocusMode(false);
              setIsTimerRunning(false);
            }}
            onComplete={() => {
              confirmCompletion(activeTimerHabit.id, true);
              setIsFocusMode(false);
              setIsTimerRunning(false);
            }}
          />
        )}
      </AnimatePresence>

      <header className="flex justify-between items-start mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
              {getGreeting()}, {profile?.name?.split(' ')[0] || 'User'}
            </h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{format(today, 'EEEE, d MMMM, yyyy')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/messages"
            className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-orange-500 dark:hover:text-orange-400 transition-colors relative"
          >
            <Users className="w-5 h-5" />
            {/* TODO: Add notification badge logic here */}
          </Link>
          <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 overflow-hidden border-2 border-white dark:border-gray-800 shadow-sm transition-colors duration-300">
            <img src={getAvatarUrl(profile, user)} alt="Avatar" className="w-full h-full object-cover" />
          </div>
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
              const height = weeklyActivity[i] || 0; // Use real data, no min height to avoid confusion
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
              className="bg-white dark:bg-gray-800 rounded-3xl p-5 flex items-center gap-4 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative group border border-transparent dark:border-gray-700 overflow-hidden"
            >
              <ParticleBurst active={habit.lastCompleted === new Date().toISOString().split('T')[0]} />
              
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleComplete(habit.id)}
                disabled={habit.lastCompleted === new Date().toISOString().split('T')[0]}
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center bg-white dark:bg-gray-800 transition-all shrink-0 relative z-10 ${habit.lastCompleted === new Date().toISOString().split('T')[0] ? 'border-orange-500 bg-orange-500 text-white cursor-not-allowed' : 'border-gray-200 dark:border-gray-600 text-transparent hover:border-orange-400 dark:hover:border-orange-500'}`}
              >
                <motion.div
                  initial={false}
                  animate={{ 
                    scale: habit.lastCompleted === new Date().toISOString().split('T')[0] ? 1 : 0,
                    opacity: habit.lastCompleted === new Date().toISOString().split('T')[0] ? 1 : 0
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                >
                  <Check className="w-5 h-5 stroke-[3]" />
                </motion.div>
              </motion.button>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner relative z-10 ${habit.bg || 'bg-gray-100 dark:bg-gray-700'} ${habit.color || 'text-gray-500 dark:text-gray-400'}`}>
                {getIcon(habit.icon)}
              </div>
              <div className="flex-1 min-w-0 pr-2 relative z-10">
                <h3 className={`text-gray-900 dark:text-white font-bold truncate text-lg tracking-tight ${habit.lastCompleted === new Date().toISOString().split('T')[0] ? 'opacity-40 line-through' : ''}`}>{habit.title}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Streak</span>
                  <span className="text-xs font-bold text-orange-500">{habit.streak}d</span>
                </div>
              </div>
              <div className="flex items-center gap-2 relative z-10">
                {habit.lastCompleted === new Date().toISOString().split('T')[0] && (
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center"
                  >
                    <Flame className="w-5 h-5 text-orange-500 fill-current" />
                  </motion.div>
                )}
                {habit.durationMins && habit.lastCompleted !== new Date().toISOString().split('T')[0] && (
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => startFocusMode(habit)}
                    className="flex flex-col items-center justify-center gap-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 w-14 h-14 rounded-2xl shadow-lg transition-all shrink-0 group/focus"
                  >
                    <Play className="w-5 h-5 fill-current ml-0.5 group-hover/focus:scale-110 transition-transform" />
                    <span className="text-[10px] font-black">{habit.durationMins}M</span>
                  </motion.button>
                )}
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => openEditModal(habit)}
                    className="p-2 text-gray-300 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-xl transition-all"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteTask(habit.id)}
                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
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
      {/* Level Up Modal */}
      <AnimatePresence>
        {showLevelUp && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.5, opacity: 0, rotate: 10 }}
              className="bg-white dark:bg-gray-800 rounded-[3rem] p-8 max-w-sm w-full text-center shadow-2xl relative overflow-hidden"
            >
              {/* Confetti-like background elements */}
              <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ 
                      y: [-20, 400],
                      x: [Math.random() * 300 - 150, Math.random() * 300 - 150],
                      rotate: [0, 360]
                    }}
                    transition={{ duration: 2 + Math.random() * 2, repeat: Infinity, ease: "linear" }}
                    className="absolute w-2 h-2 bg-orange-500 rounded-sm opacity-50"
                    style={{ left: `${Math.random() * 100}%`, top: -20 }}
                  />
                ))}
              </div>

              <div className="relative z-10">
                <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-orange-500/40">
                  <Trophy className="w-12 h-12 text-white fill-current" />
                </div>
                <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tighter">Level Up!</h2>
                <div className="flex items-center justify-center gap-2 mb-6">
                  <span className="text-gray-400 text-lg font-medium">Level</span>
                  <span className="text-5xl font-black text-orange-500">{profile?.level}</span>
                </div>
                <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
                  You've unlocked new potential and mental clarity.
                </p>
                <button
                  onClick={() => setShowLevelUp(false)}
                  className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-bold text-lg hover:scale-105 active:scale-95 transition-transform shadow-xl"
                >
                  Keep Growing
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
