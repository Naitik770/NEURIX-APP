import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { signUpWithEmail, sendVerificationEmail } from '../firebase';
import { doc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !email || !password || !confirmPassword) {
      toast.error('Please fill in all fields');
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
      const userCredential = await signUpWithEmail(email, password);
      const user = userCredential.user;
      
      // Send verification email
      await sendVerificationEmail(user);
      
      // Save user data to Firestore
      const userRef = doc(db, 'users', user.uid);
      try {
        // Try to update first (in case App.tsx already created it via onAuthStateChanged)
        await updateDoc(userRef, {
          name: name,
          email: email
        });
      } catch (error: any) {
        // If it doesn't exist, create it
        if (error.code === 'not-found' || error.message?.includes('No document to update')) {
          await setDoc(userRef, {
            uid: user.uid,
            name: name,
            email: email,
            xp: 0,
            level: 1,
            streak: 0,
            lifeScore: 50,
            createdAt: serverTimestamp(),
            role: 'user'
          });
        } else {
          // If it's a permission error, it might be because App.tsx created it but we don't have permission to update it?
          // Actually, if App.tsx created it, we should have permission.
          // Let's just try setDoc with merge as a fallback, but omit createdAt to avoid rule violation
          await setDoc(userRef, {
            name: name,
            email: email
          }, { merge: true });
        }
      }

      toast.success('Account created! Please check your email to verify your account.');
      navigate('/login');
    } catch (err: any) {
      console.error('Sign up error:', err);
      if (err.code === 'auth/email-already-in-use') {
        toast.error('This email is already in use. Please sign in instead.');
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
            disabled={loading}
            className="w-full bg-orange-500 text-white py-4 rounded-full font-semibold text-lg hover:bg-orange-600 transition-transform active:scale-95 shadow-lg shadow-orange-500/30 disabled:opacity-50"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-500 dark:text-gray-400 transition-colors duration-300">Already have an account? <Link to="/login" className="text-orange-500 font-bold hover:text-orange-600 transition-colors duration-300">Sign In</Link></p>
        </div>
      </div>
    </motion.div>
  );
}
