import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, User, Gamepad2, Activity, Settings } from 'lucide-react';

export function BottomNav() {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;
  
  return (
    <div className="fixed bottom-0 w-full bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-around p-3 z-50">
      <Link to="/" className={`flex flex-col items-center ${isActive('/') ? 'text-indigo-600' : 'text-gray-500'}`}>
        <Home size={24} />
        <span className="text-xs mt-1">Home</span>
      </Link>
      <Link to="/games" className={`flex flex-col items-center ${isActive('/games') ? 'text-indigo-600' : 'text-gray-500'}`}>
        <Gamepad2 size={24} />
        <span className="text-xs mt-1">Games</span>
      </Link>
      <Link to="/analytics" className={`flex flex-col items-center ${isActive('/analytics') ? 'text-indigo-600' : 'text-gray-500'}`}>
        <Activity size={24} />
        <span className="text-xs mt-1">Analytics</span>
      </Link>
      <Link to="/profile" className={`flex flex-col items-center ${isActive('/profile') ? 'text-indigo-600' : 'text-gray-500'}`}>
        <User size={24} />
        <span className="text-xs mt-1">Profile</span>
      </Link>
    </div>
  );
}
