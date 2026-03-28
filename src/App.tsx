import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import React, { useEffect, useState, createContext, useContext } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { ErrorBoundary } from './components/ErrorBoundary';
import { BottomNav } from './components/BottomNav';
import { format, isSameMinute } from 'date-fns';
import { Toaster, toast } from 'sonner';

// Pages
import Home from './pages/Home';
import Coach from './pages/Coach';
import Games from './pages/Games';
import Analytics from './pages/Analytics';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Reminders from './pages/Reminders';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import ForgotPassword from './pages/ForgotPassword';
import Personalization from './pages/Personalization';
import ChatHistory from './pages/ChatHistory';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  profile: any | null;
  theme: string;
  setTheme: (theme: string) => void;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, profile: null, theme: 'light', setTheme: () => {} });

export const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [reminders, setReminders] = useState<any[]>([]);
  const [theme, setTheme] = useState(localStorage.getItem('appTheme') || 'light');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = undefined;
      }

      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        // Use onSnapshot for real-time profile updates
        unsubscribeProfile = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data());
          } else {
            // Create profile if it doesn't exist (e.g., first social login)
            const newProfile: any = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'User',
              xp: 0,
              level: 1,
              streak: 0,
              lifeScore: 50,
              role: 'user',
              createdAt: serverTimestamp(),
            };
            if (firebaseUser.email) {
              newProfile.email = firebaseUser.email;
            }
            setDoc(userRef, newProfile).catch(error => {
              // Ignore permission errors here, as SignUp.tsx might have already created the profile
              // and this setDoc would be treated as an invalid update (modifying createdAt)
              if (error.code !== 'permission-denied') {
                handleFirestoreError(error, OperationType.WRITE, `users/${firebaseUser.uid}`);
              }
            });
          }
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  // Sync reminders
  useEffect(() => {
    if (!user) {
      setReminders([]);
      return;
    }
    const q = query(collection(db, `users/${user.uid}/reminders`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReminders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/reminders`));

    // Register Service Worker for mobile notifications
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('SW registered:', reg.scope))
        .catch(err => console.error('SW registration failed:', err));
    }

    return () => unsubscribe();
  }, [user]);

  // Global Reminder Notification Logic
  useEffect(() => {
    if (!user || reminders.length === 0) return;

    // Auto-request permission on first user interaction if not already decided
    const requestPermissionOnInteraction = async () => {
      if ("Notification" in window && Notification.permission === 'default') {
        try {
          await Notification.requestPermission();
        } catch (e) {
          console.error("Failed to request permission on interaction", e);
        }
      }
      window.removeEventListener('click', requestPermissionOnInteraction);
      window.removeEventListener('touchstart', requestPermissionOnInteraction);
    };

    window.addEventListener('click', requestPermissionOnInteraction);
    window.addEventListener('touchstart', requestPermissionOnInteraction);

    const checkReminders = async () => {
      const now = new Date();
      const todayStr = format(now, 'yyyy-MM-dd');
      const currentDay = now.getDay();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      for (const reminder of reminders) {
        if (!reminder.time || reminder.enabled === false) continue;
        
        // Check if recurring day matches (if days specified)
        if (reminder.days?.length > 0 && !reminder.days.includes(currentDay)) {
          continue;
        }

        // Robust date parsing
        let reminderTime: Date;
        try {
          if (typeof reminder.time.toDate === 'function') {
            reminderTime = reminder.time.toDate();
          } else if (reminder.time instanceof Date) {
            reminderTime = reminder.time;
          } else if (reminder.time?.seconds) {
            reminderTime = new Date(reminder.time.seconds * 1000);
          } else {
            reminderTime = new Date(reminder.time);
          }
        } catch (e) {
          continue;
        }

        const reminderHour = reminderTime.getHours();
        const reminderMinute = reminderTime.getMinutes();

        // Match hour and minute exactly
        if (currentHour === reminderHour && currentMinute === reminderMinute) {
          // Check if already notified today
          if (reminder.lastNotified !== todayStr) {
            let notified = false;

            // 1. Try Browser Notification
            if ("Notification" in window && Notification.permission === 'granted') {
              try {
                const title = `⏰ ${reminder.title}`; 
                const options = { 
                  body: "NEURIX: Scheduled Task", 
                  icon: 'https://picsum.photos/seed/neurix/192/192',
                  badge: 'https://picsum.photos/seed/neurix/192/192',
                  vibrate: [200, 100, 200],
                  tag: `reminder-${reminder.id}-${todayStr}`,
                  renotify: true,
                  timestamp: Date.now(),
                  requireInteraction: true 
                };

                try {
                  const notification = new Notification(title, options);
                  notification.onclick = () => {
                    window.focus();
                    notification.close();
                  };
                  notified = true;
                } catch (e) {
                  if ('serviceWorker' in navigator) {
                    const reg = await navigator.serviceWorker.ready;
                    await reg.showNotification(title, options);
                    notified = true;
                  }
                }
              } catch (e) {
                console.error("Browser notification failed", e);
              }
            }

            // 2. In-App Toast
            toast.success(`Reminder: ${reminder.title}`, {
              description: `Scheduled for ${format(reminderTime, 'hh:mm a')}`,
              duration: 15000,
              icon: '⏰',
            });

            // 3. Fallback Alert
            if (!notified && window.location.pathname !== '/reminders') {
              setTimeout(() => {
                alert(`⏰ NEURIX REMINDER: ${reminder.title}\n\nIt's time for your scheduled task!`);
              }, 1000);
              notified = true;
            } else if (!notified) {
              notified = true;
            }

            if (notified) {
              try {
                const updates: any = { lastNotified: todayStr };
                // If it's a one-time reminder (no days), disable it after firing
                if (!reminder.days || reminder.days.length === 0) {
                  updates.enabled = false;
                }
                await updateDoc(doc(db, `users/${user.uid}/reminders`, reminder.id), updates);
              } catch (e) {
                console.error("Error updating reminder state", e);
              }
            }
          }
        }
      }
    };

    // Run check every 1 second to be truly instant
    const interval = setInterval(checkReminders, 1000);
    checkReminders();

    return () => {
      clearInterval(interval);
      window.removeEventListener('click', requestPermissionOnInteraction);
      window.removeEventListener('touchstart', requestPermissionOnInteraction);
    };
  }, [user, reminders]);

  return (
    <AuthContext.Provider value={{ user, loading, profile, theme, setTheme }}>
      {children}
      <Toaster position="top-center" richColors closeButton />
    </AuthContext.Provider>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, profile } = useAuth();
  const location = useLocation();

  if (loading) return <div className="flex h-screen items-center justify-center bg-[#FDFBF7]">Loading...</div>;
  if (!user) return <Navigate to="/login" />;

  // Check if profile is complete (e.g., has age set)
  const isProfileComplete = profile && profile.age !== undefined;

  if (!isProfileComplete && location.pathname !== '/personalization') {
    return <Navigate to="/personalization" />;
  }

  if (isProfileComplete && location.pathname === '/personalization') {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-gray-900 pb-24 font-sans text-gray-900 dark:text-gray-100 transition-colors duration-300">
      {children}
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/personalization" element={<ProtectedRoute><Personalization /></ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute><Layout><Home /></Layout></ProtectedRoute>} />
            <Route path="/coach" element={<ProtectedRoute><Layout><Coach /></Layout></ProtectedRoute>} />
            <Route path="/chat-history" element={<ProtectedRoute><Layout><ChatHistory /></Layout></ProtectedRoute>} />
            <Route path="/games" element={<ProtectedRoute><Layout><Games /></Layout></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Layout><Analytics /></Layout></ProtectedRoute>} />
            <Route path="/reminders" element={<ProtectedRoute><Layout><Reminders /></Layout></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
