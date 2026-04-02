import React from 'react';
import { ChevronLeft, Info, Video, Phone } from 'lucide-react';
import { useChat } from './ChatProvider';

export function ChatHeader() {
  const { user, users } = useChat();
  
  // Find the other user (for demo purposes, just pick the first one that isn't the current user)
  const otherUser = Object.values(users).find(u => u.uid !== user?.uid);

  if (!user) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <button className="p-1 -ml-1 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronLeft size={28} />
        </button>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 p-[1.5px]">
              <div className="w-full h-full rounded-full bg-white p-[1.5px]">
                <img 
                  src={otherUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser?.uid || 'guest'}`} 
                  alt="Avatar" 
                  className="w-full h-full rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
            {otherUser?.isTyping && (
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
            )}
          </div>
          
          <div className="flex flex-col">
            <span className="text-sm font-bold text-gray-900 truncate max-w-[120px]">
              {otherUser?.displayName || 'Chat Room'}
            </span>
            <span className="text-[10px] text-gray-500 font-medium">
              {otherUser?.isTyping ? 'Typing...' : 'Active now'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="p-1 hover:bg-gray-100 rounded-full transition-colors">
          <Phone size={22} />
        </button>
        <button className="p-1 hover:bg-gray-100 rounded-full transition-colors">
          <Video size={24} />
        </button>
        <button className="p-1 hover:bg-gray-100 rounded-full transition-colors">
          <Info size={24} />
        </button>
      </div>
    </div>
  );
}
