import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { resetPassword } from '../firebase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await resetPassword(email);
      setMessage('Password reset link sent to your email');
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setError('User not found');
      } else {
        setError('Failed to send reset link');
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex min-h-screen flex-col items-center justify-center bg-[#FDFBF7] dark:bg-gray-900 p-6 transition-colors duration-300"
    >
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl border border-transparent dark:border-gray-700 transition-colors duration-300">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 transition-colors duration-300">Forgot Password</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8 transition-colors duration-300">Enter your email to reset your password</p>
        
        <form onSubmit={handleReset} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all duration-300"
          />
          {error && <p className="text-red-500 dark:text-red-400 text-sm transition-colors duration-300">{error}</p>}
          {message && <p className="text-green-500 dark:text-green-400 text-sm transition-colors duration-300">{message}</p>}
          <button
            type="submit"
            className="w-full bg-orange-500 text-white py-4 rounded-full font-semibold text-lg hover:bg-orange-600 transition-transform active:scale-95 shadow-lg shadow-orange-500/30"
          >
            Send Reset Link
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/login" className="text-gray-500 dark:text-gray-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors duration-300">Back to Sign In</Link>
        </div>
      </div>
    </motion.div>
  );
}
