import React, { useRef, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform, PanInfo } from 'motion/react';
import { Reply, Check, CheckCheck } from 'lucide-react';
import { format } from 'date-fns';
import { Message, User } from '../types';
import { useChat } from './ChatProvider';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MessageItemProps {
  message: Message;
  isOwn: boolean;
  sender?: User;
  replyTo?: Message;
  showTimestamp: boolean;
}

export function MessageItem({ message, isOwn, sender, replyTo, showTimestamp }: MessageItemProps) {
  const { setReplyingTo } = useChat();
  const x = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 400, damping: 40 });
  
  // Reply icon opacity and scale based on swipe
  const replyOpacity = useTransform(x, [0, -60], [0, 1]);
  const replyScale = useTransform(x, [0, -60], [0.5, 1]);
  
  // Timestamp reveal logic
  const timestampX = useTransform(x, [0, -100], [100, 0]);

  const handleDrag = (_: any, info: PanInfo) => {
    // Limit swipe to left only
    if (info.offset.x > 0) {
      x.set(0);
    } else {
      x.set(info.offset.x);
    }
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x < -80) {
      setReplyingTo(message);
      // Haptic feedback simulation or visual cue
    }
    x.set(0);
  };

  return (
    <div className={cn(
      "relative flex w-full px-4 py-1 group select-none overflow-hidden",
      isOwn ? "justify-end" : "justify-start"
    )}>
      {/* Reply Action Icon (Revealed on Swipe) */}
      <motion.div 
        style={{ opacity: replyOpacity, scale: replyScale }}
        className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
      >
        <Reply size={20} />
      </motion.div>

      {/* Timestamp (Revealed on Screen Swipe) */}
      <motion.div
        animate={{ x: showTimestamp ? -80 : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 40 }}
        className="absolute -right-20 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-medium whitespace-nowrap"
      >
        {format(new Date(message.createdAt), 'h:mm a')}
      </motion.div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -100, right: 0 }}
        dragElastic={0.1}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        style={{ x: springX }}
        className={cn(
          "relative max-w-[75%] flex flex-col",
          isOwn ? "items-end" : "items-start"
        )}
      >
        {/* Reply Preview inside Bubble */}
        {replyTo && (
          <div className={cn(
            "mb-[-12px] pb-3 pt-2 px-3 rounded-t-2xl text-xs opacity-60 border-b border-white/10",
            isOwn ? "bg-blue-600/50" : "bg-gray-200"
          )}>
            <div className="font-semibold truncate max-w-[150px]">
              {replyTo.senderId === message.senderId ? 'You' : 'Them'}
            </div>
            <div className="truncate max-w-[200px]">{replyTo.text}</div>
          </div>
        )}

        <div className={cn(
          "px-4 py-2.5 rounded-2xl text-sm shadow-sm transition-colors",
          isOwn 
            ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-tr-sm" 
            : "bg-gray-100 text-gray-900 rounded-tl-sm"
        )}>
          {message.text}
        </div>

        {/* Status Indicators */}
        {isOwn && (
          <div className="mt-1 flex items-center gap-1">
            {message.status === 'seen' ? (
              <CheckCheck size={12} className="text-blue-500" />
            ) : (
              <Check size={12} className="text-gray-400" />
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
