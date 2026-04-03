import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { signUpWithEmail, loginWithEmail, sendVerificationEmail, signInWithGoogle, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import { Search, Check, X, Loader2 } from 'lucide-react';

export default function SignUp() {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState('');
  const navigate = useNavigate();

  // Real-time username check
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (username.length >= 3) {
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
          setUsernameError('Username can only contain letters, numbers, and underscores.');
          setIsUsernameAvailable(false);
          return;
        }
        setUsernameError('');
        setCheckingUsername(true);
        try {
          const usernameRef = doc(db, 'usernames', username.toLowerCase());
          const usernameDoc = await getDoc(usernameRef);
          setIsUsernameAvailable(!usernameDoc.exists());
          if (usernameDoc.exists()) {
            setUsernameError('This username is already taken.');
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `usernames/${username.toLowerCase()}`);
        } finally {
          setCheckingUsername(false);
        }
      } else if (username.length > 0) {
        setUsernameError('Username must be at least 3 characters.');
        setIsUsernameAvailable(false);
      } else {
        setUsernameError('');
        setIsUsernameAvailable(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !username || !email || !password || !confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    if (isUsernameAvailable === false) {
      toast.error(usernameError || 'Please choose a valid username');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      let user;
      try {
        const userCredential = await signUpWithEmail(email, password);
        user = userCredential.user;
        // Send verification email only for new sign-ups
        await sendVerificationEmail(user);
      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
          // If email exists, try to sign in to resume
          const { loginWithEmail } = await import('../firebase');
          const userCredential = await loginWithEmail(email, password);
          user = userCredential.user;
        } else {
          throw err;
        }
      }

      if (!user) throw new Error('Failed to get user');
      
      // Only proceed with pending profile if not verified
      if (!user.emailVerified) {
        // Claim username (reserve it)
        const usernameRef = doc(db, 'usernames', username.toLowerCase());
        try {
          await setDoc(usernameRef, {
            uid: user.uid,
            createdAt: serverTimestamp(),
            pending: true
          }, { merge: true });
        } catch (error: any) {
          console.error('Error reserving username:', error);
        }

        // Store pending profile data
        const pendingProfileRef = doc(db, 'pendingProfiles', user.uid);
        try {
          await setDoc(pendingProfileRef, {
            uid: user.uid,
            name: name,
            username: username.toLowerCase(),
            email: email,
            createdAt: serverTimestamp()
          }, { merge: true });
        } catch (error: any) {
          console.error('Error storing pending profile:', error);
        }

        toast.success('Please check your email to verify your account.');
        navigate('/verify-email');
      } else {
        // If already verified, redirect to home (AuthProvider will handle profile creation if missing)
        toast.success('Welcome back!');
        navigate('/');
      }
    } catch (err: any) {
      console.error('Sign up error:', err);
      if (err.code === 'auth/email-already-in-use') {
        try {
          // Attempt to login to resume sign up process
          const loginResult = await loginWithEmail(email, password);
          const user = loginResult.user;
          
          if (!user.emailVerified) {
            // Store pending profile data again to ensure it's up to date
            const pendingProfileRef = doc(db, 'pendingProfiles', user.uid);
            await setDoc(pendingProfileRef, {
              uid: user.uid,
              name: name,
              username: username.toLowerCase(),
              email: email,
              createdAt: serverTimestamp()
            }, { merge: true });

            // Reserve username
            const usernameRef = doc(db, 'usernames', username.toLowerCase());
            await setDoc(usernameRef, {
              uid: user.uid,
              createdAt: serverTimestamp(),
              pending: true
            }, { merge: true });

            toast.info('Resuming your sign up. Please verify your email.');
            navigate('/verify-email');
          } else {
            toast.success('Welcome back!');
            navigate('/');
          }
          return;
        } catch (loginErr: any) {
          if (loginErr.code === 'auth/wrong-password') {
            toast.error('This email is already registered. Please sign in with the correct password.');
          } else {
            toast.error('This email is already in use. Please sign in instead.');
          }
        }
      } else if (err.code === 'auth/wrong-password') {
        toast.error('This email is already registered. Please sign in with the correct password.');
      } else if (err.code === 'auth/invalid-email') {
        toast.error('Invalid email address');
      } else if (err.code === 'auth/weak-password') {
        toast.error('Password is too weak');
      } else if (err.code === 'auth/operation-not-allowed') {
        toast.error('This sign-in method is not enabled. Please enable it in the Firebase Console.');
      } else {
        toast.error(err.message || 'Failed to create account');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      toast.success('Signed in with Google!');
      navigate('/');
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        setLoading(false);
        return;
      }
      console.error('Google sign up error:', err);
      toast.error('Failed to sign up with Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex min-h-screen flex-col items-center justify-center bg-[#FDFBF7] dark:bg-gray-900 p-6 transition-colors duration-300"
    >
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl border border-transparent dark:border-gray-700 transition-colors duration-300">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 transition-colors duration-300">Create Account</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8 transition-colors duration-300">Join NEURIX and start your journey</p>
        
        <form onSubmit={handleSignUp} className="space-y-4">
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all duration-300"
          />
          <div className="relative">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              className={`w-full p-4 rounded-2xl border ${
                isUsernameAvailable === true ? 'border-green-500' : isUsernameAvailable === false ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
              } bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all duration-300`}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
              {checkingUsername ? (
                <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
              ) : isUsernameAvailable === true ? (
                <Check className="w-5 h-5 text-green-500" />
              ) : isUsernameAvailable === false ? (
                <X className="w-5 h-5 text-red-500" />
              ) : null}
            </div>
            {usernameError && <p className="text-red-500 text-xs mt-1 ml-2">{usernameError}</p>}
          </div>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all duration-300"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all duration-300"
          />
          <input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all duration-300"
          />
          <button
            type="submit"
            disabled={loading || isUsernameAvailable === false}
            className="w-full bg-orange-500 text-white py-4 rounded-full font-semibold text-lg hover:bg-orange-600 transition-transform active:scale-95 shadow-lg shadow-orange-500/30 disabled:opacity-50"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-4">
          <button
            onClick={handleGoogleSignUp}
            disabled={loading}
            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 py-4 rounded-full font-semibold text-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-3"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {loading ? 'Please wait...' : 'Continue with Google'}
          </button>
        </div>

        <div className="mt-6 text-center">
          <p className="text-gray-500 dark:text-gray-400 transition-colors duration-300">Already have an account? <Link to="/login" className="text-orange-500 font-bold hover:text-orange-600 transition-colors duration-300">Sign In</Link></p>
        </div>
      </div>
    </motion.div>
  );
}
