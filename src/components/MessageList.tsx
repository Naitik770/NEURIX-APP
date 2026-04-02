import React, { useState, useRef, useEffect } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { motion, useMotionValue, useSpring, useTransform, PanInfo } from 'motion/react';
import { useChat } from './ChatProvider';
import { MessageItem } from './MessageItem';
import { format, isToday, isYesterday } from 'date-fns';

export function MessageList() {
  const { messages, user, users } = useChat();
  const [showTimestamps, setShowTimestamps] = useState(false);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  
  // Global Swipe Logic
  const globalX = useMotionValue(0);
  const springGlobalX = useSpring(globalX, { stiffness: 400, damping: 40 });

  const handleGlobalDrag = (_: any, info: PanInfo) => {
    // Only allow global swipe if not dragging a message (simplified)
    if (info.offset.x < 0) {
      globalX.set(info.offset.x);
    } else {
      globalX.set(0);
    }
  };

  const handleGlobalDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x < -50) {
      setShowTimestamps(true);
      setTimeout(() => setShowTimestamps(false), 3000); // Auto-hide after 3s
    }
    globalX.set(0);
  };

  useEffect(() => {
    if (messages.length > 0) {
      virtuosoRef.current?.scrollToIndex({
        index: messages.length - 1,
        behavior: 'smooth'
      });
    }
  }, [messages.length]);

  if (!user) return null;

  return (
    <motion.div 
      drag="x"
      dragConstraints={{ left: -100, right: 0 }}
      dragElastic={0.1}
      onDrag={handleGlobalDrag}
      onDragEnd={handleGlobalDragEnd}
      style={{ x: springGlobalX }}
      className="flex-1 overflow-hidden bg-white"
    >
      <Virtuoso
        ref={virtuosoRef}
        data={messages}
        initialTopMostItemIndex={messages.length - 1}
        followOutput="smooth"
        className="h-full scrollbar-hide"
        itemContent={(index, message) => {
          const isOwn = message.senderId === user.uid;
          const sender = users[message.senderId];
          const replyTo = message.replyToMessageId 
            ? messages.find(m => m.id === message.replyToMessageId) 
            : undefined;

          // Date Separator Logic
          const prevMessage = index > 0 ? messages[index - 1] : null;
          const showDate = !prevMessage || 
            format(new Date(message.createdAt), 'yyyy-MM-dd') !== 
            format(new Date(prevMessage.createdAt), 'yyyy-MM-dd');

          return (
            <div key={message.id}>
              {showDate && (
                <div className="flex justify-center my-4">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    {isToday(new Date(message.createdAt)) 
                      ? 'Today' 
                      : isYesterday(new Date(message.createdAt)) 
                        ? 'Yesterday' 
                        : format(new Date(message.createdAt), 'MMMM d, yyyy')}
                  </span>
                </div>
              )}
              <MessageItem 
                message={message} 
                isOwn={isOwn} 
                sender={sender}
                replyTo={replyTo}
                showTimestamp={showTimestamps}
              />
            </div>
          );
        }}
      />
    </motion.div>
  );
}
