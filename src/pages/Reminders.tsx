import { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, orderBy, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Bell, Plus, Trash2, X, Clock, Calendar, Activity, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function Reminders() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newDays, setNewDays] = useState<number[]>([]); // 0-6 for Sun-Sat

  const daysOfWeek = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/reminders`), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReminders(fetched);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/reminders`));

    return () => unsubscribe();
  }, [user]);

  const handleAdd = async () => {
    if (!user || !newTitle.trim() || !newTime) return;
    
    const [hours, minutes] = newTime.split(':');
    const time = new Date();
    time.setHours(parseInt(hours));
    time.setMinutes(parseInt(minutes));
    time.setSeconds(0);

    try {
      await addDoc(collection(db, `users/${user.uid}/reminders`), {
        uid: user.uid,
        title: newTitle.trim(),
        time: time,
        days: newDays,
        enabled: true,
        createdAt: serverTimestamp(),
        lastNotified: null
      });
      setShowAddModal(false);
      setNewTitle('');
      setNewTime('');
      setNewDays([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/reminders`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/reminders`, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/reminders/${id}`);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, `users/${user.uid}/reminders`, id), { enabled });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/reminders/${id}`);
    }
  };

  const [isIframe, setIsIframe] = useState(false);

  useEffect(() => {
    setIsIframe(window.self !== window.top);
  }, []);

  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setLastChecked(new Date());
    }, 1000); // Update every second to show "instant" sync
    return () => clearInterval(interval);
  }, []);

  const handleClearAll = async () => {
    if (!user || reminders.length === 0) return;
    
    toast('Clear all reminders?', {
      action: {
        label: 'Clear All',
        onClick: async () => {
          try {
            const batch = reminders.map(r => deleteDoc(doc(db, `users/${user.uid}/reminders`, r.id)));
            await Promise.all(batch);
            toast.success('All reminders cleared');
          } catch (error) {
            handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/reminders`);
          }
        },
      },
    });
  };

  const [permissionState, setPermissionState] = useState<NotificationPermission>(
    "Notification" in window ? Notification.permission : "default"
  );
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(window.matchMedia('(display-mode: standalone)').matches);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      console.log('beforeinstallprompt event fired');
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    const handleAppInstalled = () => {
      console.log('App was installed');
      setDeferredPrompt(null);
      toast.success("NEURIX installed successfully!");
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setPermissionState("Notification" in window ? Notification.permission : "default");
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleTestNotification = async () => {
    if (!("Notification" in window)) {
      alert("❌ Browser Incompatible: Your browser does not support desktop notifications. Please try Chrome, Edge, or Safari.");
      return;
    }
    
    try {
      const permission = await Notification.requestPermission();
      setPermissionState(permission);
      
      if (permission === "granted") {
        const title = "⏰ NEURIX System Ready";
        const options = { 
          body: "NEURIX: Alerts are active",
          icon: 'https://picsum.photos/seed/neurix/192/192',
          badge: 'https://picsum.photos/seed/neurix/192/192',
          vibrate: [200, 100, 200],
          timestamp: Date.now(),
          requireInteraction: true
        };

        try {
          new Notification(title, options);
          toast.success("Test notification sent!");
        } catch (e) {
          // Fallback for mobile Chrome (Illegal constructor)
          if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.ready;
            await reg.showNotification(title, options);
            toast.success("Mobile test notification sent!");
          } else {
            throw e;
          }
        }
      } else if (permission === "denied") {
        alert("🚫 Permission Denied: You have blocked notifications for this site.\n\nTo fix this:\n1. Click the 'Lock' icon in the address bar.\n2. Change 'Notifications' from 'Block' to 'Allow'.\n3. Refresh the page.");
      }
    } catch (error) {
      console.error("Error requesting permission:", error);
      alert("⚠️ Error: Could not request permission. This often happens inside an iframe. Please open the app in a new tab using the icon at the top right.");
    }
  };

  return (
    <div className="p-6 pt-12 min-h-screen bg-[#FDFBF7] dark:bg-gray-900 pb-32 transition-colors duration-300">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white transition-colors duration-300">Reminders</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-gray-500 dark:text-gray-400 transition-colors duration-300">Manage your daily alerts</p>
            {lastChecked && (
              <span className="text-[10px] bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full text-gray-400 dark:text-gray-500 transition-colors duration-300">
                Sync {format(lastChecked, 'HH:mm:ss')}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          {reminders.length > 0 && (
            <button 
              onClick={handleClearAll}
              className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          <button 
            onClick={() => setShowAddModal(true)}
            className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-colors"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Notification Status & Action */}
      <div className="mb-8 bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${permissionState === 'granted' ? 'bg-green-500' : permissionState === 'denied' ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'}`} />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white transition-colors duration-300">
                {permissionState === 'granted' ? 'Alerts Active' : permissionState === 'denied' ? 'Alerts Blocked' : 'Action Required'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 transition-colors duration-300">
                {permissionState === 'granted' ? 'System is ready' : 'Enable alerts in settings'}
              </p>
            </div>
          </div>
          {permissionState !== 'granted' && (
            <button 
              onClick={handleTestNotification}
              className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-bold shadow-lg shadow-orange-500/20"
            >
              Enable
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {reminders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
            <Bell className="w-16 h-16 mb-4 text-gray-400 dark:text-gray-600 transition-colors duration-300" />
            <p className="text-gray-500 dark:text-gray-400 transition-colors duration-300">No reminders set yet.</p>
          </div>
        ) : (
          reminders.map((reminder) => (
            <motion.div 
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={reminder.id}
              className={`bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between group transition-all duration-300 ${!reminder.enabled ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${reminder.enabled ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-500' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'}`}>
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white transition-colors duration-300">{reminder.title}</h3>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400 transition-colors duration-300">
                      {reminder.time?.toDate ? format(reminder.time.toDate(), 'hh:mm a') : 'Time not set'}
                    </p>
                    <span className="text-[10px] text-gray-300 dark:text-gray-600 transition-colors duration-300">•</span>
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider transition-colors duration-300">
                      {reminder.days?.length > 0 
                        ? reminder.days.map((d: number) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')
                        : 'Today only'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleToggle(reminder.id, !reminder.enabled)}
                  className={`w-12 h-6 rounded-full relative transition-colors ${reminder.enabled ? 'bg-orange-500' : 'bg-gray-200 dark:bg-gray-700'}`}
                >
                  <motion.div 
                    animate={{ x: reminder.enabled ? 24 : 4 }}
                    className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                  />
                </button>
                <button 
                  onClick={() => handleDelete(reminder.id)}
                  className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 dark:hover:bg-red-900/40"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative border border-transparent dark:border-gray-700 transition-colors duration-300"
            >
              <button 
                onClick={() => setShowAddModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-300"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 transition-colors duration-300">New Reminder</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-300">Title</label>
                  <input 
                    type="text" 
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g., Take medicine"
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 rounded-xl px-4 py-3 outline-none focus:border-orange-500 transition-all duration-300"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-300">Time</label>
                  <input 
                    type="time" 
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl px-4 py-3 outline-none focus:border-orange-500 transition-all duration-300"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors duration-300">Repeat on</label>
                  <div className="flex justify-between">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          if (newDays.includes(i)) {
                            setNewDays(newDays.filter(d => d !== i));
                          } else {
                            setNewDays([...newDays, i]);
                          }
                        }}
                        className={`w-9 h-9 rounded-full text-xs font-bold transition-all duration-300 ${newDays.includes(i) ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 text-center transition-colors duration-300">
                    {newDays.length === 0 ? 'Remind only for today' : `Repeats every ${newDays.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}`}
                  </p>
                </div>
              </div>

              <button 
                onClick={handleAdd}
                disabled={!newTitle.trim() || !newTime}
                className="w-full mt-8 py-4 rounded-xl font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 transition-colors shadow-lg shadow-orange-500/30"
              >
                Create Reminder
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
