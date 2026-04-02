import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Image as ImageIcon, Smile, Mic } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useChat } from './ChatProvider';

export function ChatInput() {
  const { sendMessage, replyingTo, setReplyingTo, setTyping, user } = useChat();
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (replyingTo) {
      inputRef.current?.focus();
    }
  }, [replyingTo]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    
    // Typing indicator logic
    setTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setTyping(false);
    }, 2000);
  };

  const handleSend = async () => {
    if (!text.trim()) return;
    const currentText = text;
    setText('');
    setTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    await sendMessage(currentText);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  if (!user) return null;

  return (
    <div className="p-4 border-t border-gray-100 bg-white">
      <AnimatePresence>
        {replyingTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-2 bg-gray-50 rounded-xl p-3 flex items-center gap-3 border-l-4 border-blue-500"
          >
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-blue-600">
                Replying to {replyingTo.senderId === user.uid ? 'yourself' : 'them'}
              </div>
              <div className="text-xs text-gray-500 truncate">{replyingTo.text}</div>
            </div>
            <button 
              onClick={() => setReplyingTo(null)}
              className="p-1 hover:bg-gray-200 rounded-full transition-colors"
            >
              <X size={16} className="text-gray-400" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2 bg-gray-100 rounded-3xl px-4 py-2">
        <button className="p-1 text-gray-500 hover:text-blue-500 transition-colors">
          <Smile size={22} />
        </button>
        
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Message..."
          className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2"
        />

        {text.trim() ? (
          <button 
            onClick={handleSend}
            className="text-blue-500 font-bold text-sm px-2 hover:opacity-80 transition-opacity"
          >
            Send
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button className="p-1 text-gray-500 hover:text-blue-500 transition-colors">
              <Mic size={22} />
            </button>
            <button className="p-1 text-gray-500 hover:text-blue-500 transition-colors">
              <ImageIcon size={22} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
