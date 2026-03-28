import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithGoogle, loginWithEmail } from '../firebase';
import { toast } from 'sonner';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await loginWithEmail(email, password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        toast.error('Invalid email or password');
      } else if (err.code === 'auth/operation-not-allowed') {
        toast.error('This sign-in method is not enabled. Please enable it in the Firebase Console.');
      } else {
        toast.error(err.message || 'Failed to sign in');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      toast.success('Welcome back!');
      navigate('/');
    } catch (err: any) {
      console.error('Google login error:', err);
      toast.error('Failed to sign in with Google');
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 transition-colors duration-300">Welcome Back</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8 transition-colors duration-300">Sign in to continue to NEURIX</p>
        
        <form onSubmit={handleLogin} className="space-y-4">
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
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 text-white py-4 rounded-full font-semibold text-lg hover:bg-orange-600 transition-transform active:scale-95 shadow-lg shadow-orange-500/30 disabled:opacity-50"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/forgot-password" className="text-gray-500 dark:text-gray-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors duration-300">Forgot Password?</Link>
        </div>

        <div className="mt-6">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 py-4 rounded-full font-semibold text-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 disabled:opacity-50"
          >
            {loading ? 'Please wait...' : 'Continue with Google'}
          </button>
        </div>
        
        <div className="mt-6 text-center">
          <p className="text-gray-500 dark:text-gray-400 transition-colors duration-300">Don't have an account? <Link to="/signup" className="text-orange-500 font-bold hover:text-orange-600 transition-colors duration-300">Sign Up</Link></p>
        </div>
      </div>
    </motion.div>
  );
}
