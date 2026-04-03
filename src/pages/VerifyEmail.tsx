import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { auth, sendVerificationEmail } from '../firebase';
import { useAuth } from '../App';
import { signOut } from 'firebase/auth';
import { toast } from 'sonner';
import { Mail, RefreshCw, LogOut, CheckCircle } from 'lucide-react';

export default function VerifyEmail() {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const navigate = useNavigate();
  const { user, checkVerification } = useAuth();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (user.emailVerified) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleResendEmail = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await sendVerificationEmail(user);
      toast.success('Verification email sent! Please check your inbox.');
    } catch (error: any) {
      console.error('Error resending verification email:', error);
      toast.error(error.message || 'Failed to send verification email');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!user) return;
    setChecking(true);
    try {
      await checkVerification();
      if (auth.currentUser?.emailVerified) {
        toast.success('Email verified! Redirecting...');
        navigate('/');
      } else {
        toast.info('Email not verified yet. Please check your inbox.');
      }
    } catch (error: any) {
      console.error('Error checking verification status:', error);
      toast.error('Failed to check status');
    } finally {
      setChecking(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FDFBF7] dark:bg-gray-900 p-6 transition-colors duration-300">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl border border-transparent dark:border-gray-700 text-center"
      >
        <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <Mail className="w-10 h-10 text-orange-500" />
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Verify Your Email</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          We've sent a verification email to <span className="font-semibold text-gray-900 dark:text-white">{user.email}</span>. 
          Please click the link in the email to verify your account.
        </p>

        <div className="space-y-4">
          <button
            onClick={handleCheckStatus}
            disabled={checking}
            className="w-full bg-orange-500 text-white py-4 rounded-full font-semibold text-lg hover:bg-orange-600 transition-all active:scale-95 shadow-lg shadow-orange-500/30 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {checking ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
            I've Verified My Email
          </button>

          <button
            onClick={handleResendEmail}
            disabled={loading}
            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 py-4 rounded-full font-semibold text-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
            Resend Email
          </button>

          <button
            onClick={handleSignOut}
            className="w-full text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 font-medium flex items-center justify-center gap-2 pt-4"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </motion.div>
    </div>
  );
}
