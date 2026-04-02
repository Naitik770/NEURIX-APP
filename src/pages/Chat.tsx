import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, getAvatarUrl } from '../App';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, onSnapshot, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, orderBy, writeBatch } from 'firebase/firestore';
import { ArrowLeft, Send, Paperclip, X, Edit2, Trash2, Image as ImageIcon, FileText, Check, FileVideo, Download, Play, CornerUpLeft, ExternalLink, Loader2, Copy, CheckCheck } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export default function Chat() {
  const { friendId } = useParams<{ friendId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [friendProfile, setFriendProfile] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [attachment, setAttachment] = useState<{ type: string, data: string, name: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ msg: any, x: number, y: number } | null>(null);
  const [editingMessage, setEditingMessage] = useState<any>(null);
  const [editMessageText, setEditMessageText] = useState('');
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [previewMedia, setPreviewMedia] = useState<{url: string, type: string, name: string, id: string} | null>(null);
  const [fileAction, setFileAction] = useState<{url: string, name: string, type: string, id: string} | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [globalSwipeX, setGlobalSwipeX] = useState(0);
  const [touchedMessageId, setTouchedMessageId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch friend profile
  useEffect(() => {
    if (!friendId) return;
    const fetchFriend = async () => {
      try {
        const docRef = doc(db, 'publicProfiles', friendId);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            setFriendProfile(docSnap.data());
          }
          setLoading(false);
        });
        return () => unsubscribe();
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `publicProfiles/${friendId}`);
        setLoading(false);
      }
    };
    fetchFriend();
  }, [friendId]);

  // Fetch messages and typing status
  useEffect(() => {
    if (!user || !friendId) return;
    const chatId = [user.uid, friendId].sort().join('_');
    const q = query(collection(db, `chats/${chatId}/messages`), orderBy('createdAt', 'asc'));

    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date() 
      }));
      setMessages(newMessages);

      // Mark unread messages as read
      const unreadMessages = snapshot.docs.filter(doc => {
        const data = doc.data();
        return data.senderId === friendId && !data.isRead;
      });

      if (unreadMessages.length > 0) {
        const batch = writeBatch(db);
        unreadMessages.forEach(msgDoc => {
          batch.update(msgDoc.ref, { isRead: true });
        });
        batch.commit().catch(err => console.error("Error marking messages as read:", err));
      }

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `chats/${chatId}/messages`));

    const chatRef = doc(db, 'chats', chatId);
    const unsubscribeChat = onSnapshot(chatRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.typing && data.typing[friendId]) {
          setFriendTyping(true);
        } else {
          setFriendTyping(false);
        }
      }
    });

    return () => {
      unsubscribeMessages();
      unsubscribeChat();
    };
  }, [user, friendId]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 800 * 1024) {
      toast.error("File must be less than 800KB for this demo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result as string;
      const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file';
      setAttachment({ type, data, name: file.name });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1 || items[i].type.indexOf('video') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          if (file.size > 800 * 1024) {
            toast.error("File must be less than 800KB for this demo.");
            continue;
          }
          const reader = new FileReader();
          reader.onload = (ev) => {
            const data = ev.target?.result as string;
            const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file';
            setAttachment({ type, data, name: file.name });
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !friendId || (!newMessage.trim() && !attachment)) return;

    const chatId = [user.uid, friendId].sort().join('_');
    const messageText = newMessage.trim();
    const currentAttachment = attachment;
    
    const replyData = replyingTo ? {
      id: replyingTo.id,
      text: replyingTo.text,
      senderName: replyingTo.senderId === user.uid ? 'You' : friendProfile?.name || 'User',
      attachment: replyingTo.attachment ? { type: replyingTo.attachment.type } : null
    } : null;

    setNewMessage('');
    setAttachment(null);
    setReplyingTo(null);
    setIsTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    try {
      const chatRef = doc(db, 'chats', chatId);
      await setDoc(chatRef, {
        participants: [user.uid, friendId],
        lastMessage: currentAttachment ? `[${currentAttachment.type}]` : messageText,
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        typing: { [user.uid]: false }
      }, { merge: true });

      await addDoc(collection(db, `chats/${chatId}/messages`), {
        senderId: user.uid,
        text: messageText,
        attachment: currentAttachment,
        replyTo: replyData,
        createdAt: serverTimestamp(),
        isEdited: false,
        isRead: false
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chats/${chatId}/messages`);
    }
  };

  const handleTyping = async () => {
    if (!user || !friendId) return;
    const chatId = [user.uid, friendId].sort().join('_');
    const chatRef = doc(db, 'chats', chatId);

    if (!isTyping) {
      setIsTyping(true);
      try {
        await setDoc(chatRef, { typing: { [user.uid]: true } }, { merge: true });
      } catch (e) {
        console.error(e);
      }
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(async () => {
      setIsTyping(false);
      try {
        await setDoc(chatRef, { typing: { [user.uid]: false } }, { merge: true });
      } catch (e) {
        console.error(e);
      }
    }, 2000);
  };

  const handleEditMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMessage || !editMessageText.trim()) return;
    const chatId = [user!.uid, friendId].sort().join('_');
    try {
      await updateDoc(doc(db, `chats/${chatId}/messages`, editingMessage.id), {
        text: editMessageText.trim(),
        isEdited: true
      });
      setEditingMessage(null);
      setEditMessageText('');
      toast.success("Message edited");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `chats/${chatId}/messages/${editingMessage.id}`);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    const chatId = [user!.uid, friendId].sort().join('_');
    try {
      await deleteDoc(doc(db, `chats/${chatId}/messages`, msgId));
      toast.success("Message unsent");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `chats/${chatId}/messages/${msgId}`);
    }
  };

  const handleContextMenu = (e: React.MouseEvent | React.TouchEvent, msg: any) => {
    e.preventDefault();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    setContextMenu({ msg, x: clientX, y: clientY });
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
    setContextMenu(null);
  };

  const handleDownload = async (dataUrl: string, filename: string, id: string) => {
    setDownloadingId(id);
    try {
      // Simulate network delay for UX
      await new Promise(resolve => setTimeout(resolve, 800));
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      setDownloadedIds(prev => new Set(prev).add(id));
      setTimeout(() => {
        setDownloadedIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 2000);
    } catch (error) {
      toast.error('Download failed');
    } finally {
      setDownloadingId(null);
    }
  };

  const scrollToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-orange-500/20');
      setTimeout(() => el.classList.remove('bg-orange-500/20'), 2000);
    }
  };

  const formatMessageDate = (date: any) => {
    if (!date || !(date instanceof Date)) return '';
    if (isToday(date)) return format(date, 'h:mm a');
    if (isYesterday(date)) return 'Yesterday ' + format(date, 'h:mm a');
    return format(date, 'MMM d, h:mm a');
  };

  const groupMessagesByDate = (messages: any[]) => {
    const groups: { [key: string]: any[] } = {};
    messages.forEach(msg => {
      const date = msg.createdAt instanceof Date ? format(msg.createdAt, 'yyyy-MM-dd') : 'pending';
      if (!groups[date]) groups[date] = [];
      groups[date].push(msg);
    });
    return groups;
  };

  const messageGroups = groupMessagesByDate(messages);

  // Check online status
  const isOnline = friendProfile?.isOnline;

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-[#FDFBF7] dark:bg-gray-900 items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-[#FDFBF7] dark:bg-gray-900 overflow-hidden relative">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          {friendProfile && (
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 overflow-hidden border-2 border-orange-500/20">
                <img src={getAvatarUrl(friendProfile)} alt="Avatar" className="w-full h-full object-cover" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900 dark:text-white leading-tight text-sm">{friendProfile.name}</h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {friendTyping ? (
                    <p className="text-[10px] text-orange-500 font-medium tracking-wide animate-pulse">
                      typing...
                    </p>
                  ) : (
                    <>
                      <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium tracking-wide">
                        {isOnline ? 'Online' : 'Offline'}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none dark:opacity-[0.05] bg-fixed" 
             style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/hexellence.png")' }} />
        <motion.div 
          className="min-h-full p-4 pb-48 relative z-10"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={{ left: 0.5, right: 0 }}
          onDrag={(e, info) => {
            setGlobalSwipeX(info.offset.x);
          }}
          onDragEnd={(e, info) => {
            if (info.offset.x < -80 && touchedMessageId) {
              const msg = messages.find(m => m.id === touchedMessageId);
              if (msg) {
                setReplyingTo(msg);
                toast.info(`Replying to ${msg.senderId === user?.uid ? 'yourself' : friendProfile?.name}`, { 
                  icon: <CornerUpLeft className="w-4 h-4" />,
                  duration: 1500 
                });
              }
            }
            setGlobalSwipeX(0);
            setTouchedMessageId(null);
          }}
          animate={{ x: globalSwipeX }}
          transition={{ type: "spring", stiffness: 400, damping: 40 }}
        >
          {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-40">
            <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center">
              <Send className="w-10 h-10 text-orange-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">Start a conversation</p>
              <p className="text-xs text-gray-500">Say hi to {friendProfile?.name}!</p>
            </div>
          </div>
        ) : (
          Object.entries(messageGroups).map(([date, group]) => (
            <div key={date} className="flex flex-col">
              <div className="flex justify-center my-6">
                <span className="px-3 py-1 bg-gray-200/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-full text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                  {date === 'pending' ? 'Sending...' : (isToday(new Date(date)) ? 'Today' : (isYesterday(new Date(date)) ? 'Yesterday' : format(new Date(date), 'MMMM d, yyyy')))}
                </span>
              </div>
              {group.map((msg, index) => {
                const isMe = msg.senderId === user?.uid;
                const prevMsg = index > 0 ? group[index - 1] : null;
                const nextMsg = index < group.length - 1 ? group[index + 1] : null;
                
                const isFirstInSequence = !prevMsg || prevMsg.senderId !== msg.senderId;
                const isLastInSequence = !nextMsg || nextMsg.senderId !== msg.senderId;
                
                const isLastReadByFriend = isMe && msg.isRead && (!nextMsg || !nextMsg.isRead || nextMsg.senderId !== user.uid);

                const spacingClass = isLastInSequence ? 'mb-4' : 'mb-1';

                let bubbleShape = '';
                if (isMe) {
                  bubbleShape = `rounded-2xl ${isFirstInSequence ? 'rounded-tr-2xl' : 'rounded-tr-sm'} ${isLastInSequence ? 'rounded-br-2xl' : 'rounded-br-sm'}`;
                } else {
                  bubbleShape = `rounded-2xl ${isFirstInSequence ? 'rounded-tl-2xl' : 'rounded-tl-sm'} ${isLastInSequence ? 'rounded-bl-2xl' : 'rounded-bl-sm'}`;
                }

                return (
                  <div 
                    key={msg.id} 
                    id={`msg-${msg.id}`}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'} items-end gap-2 transition-colors duration-500 px-1 ${spacingClass} relative group/msg`}
                    onContextMenu={(e) => handleContextMenu(e, msg)}
                    onPointerDown={() => setTouchedMessageId(msg.id)}
                    onTouchStart={(e) => {
                      setTouchedMessageId(msg.id);
                      const timer = setTimeout(() => handleContextMenu(e, msg), 500);
                      e.currentTarget.dataset.timer = timer.toString();
                    }}
                    onTouchEnd={(e) => {
                      clearTimeout(Number(e.currentTarget.dataset.timer));
                    }}
                    onTouchMove={(e) => clearTimeout(Number(e.currentTarget.dataset.timer))}
                  >
                    {/* Swipe Time Reveal */}
                    <div 
                      className="absolute right-[-80px] top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 pointer-events-none"
                      style={{ 
                        opacity: Math.abs(globalSwipeX) / 60,
                        transform: `translateX(${globalSwipeX / 2}px)`
                      }}
                    >
                      <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">
                        {format(msg.createdAt, 'h:mm a')}
                      </span>
                    </div>

                    {/* Reply Icon Indicator */}
                    <AnimatePresence>
                      {globalSwipeX < -60 && touchedMessageId === msg.id && (
                        <motion.div 
                          initial={{ opacity: 0, x: 20, scale: 0.5 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={{ opacity: 0, x: 20, scale: 0.5 }}
                          className="absolute left-[-40px] top-1/2 -translate-y-1/2 p-2 bg-orange-500 rounded-full text-white shadow-lg"
                        >
                          <CornerUpLeft className="w-4 h-4" />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {!isMe && (
                      <div className="w-6 h-6 shrink-0 mb-1">
                        {isLastInSequence && (
                          <div className="w-full h-full rounded-full bg-orange-100 dark:bg-orange-900/30 overflow-hidden">
                            <img src={getAvatarUrl(friendProfile)} alt="Avatar" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>
                    )}
                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%]`}>
                      <div className={`relative group select-none ${
                        isMe 
                          ? `bg-orange-500 text-white shadow-sm ${bubbleShape}` 
                          : `bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm border border-gray-100 dark:border-gray-700 ${bubbleShape}`
                      } ${(!msg.text && msg.attachment && msg.attachment.type !== 'file') ? 'p-1 bg-transparent border-none shadow-none' : 'px-4 py-2.5'}`}>
                        
                        {/* Reply Preview */}
                        {msg.replyTo && (
                          <div 
                            onClick={() => scrollToMessage(msg.replyTo.id)}
                            className={`mb-2 p-2 rounded-xl text-xs border-l-2 cursor-pointer opacity-90 hover:opacity-100 transition-all ${
                              isMe ? 'bg-black/10 border-white/50 text-white' : 'bg-gray-50 dark:bg-gray-700/50 border-orange-500 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            <span className="font-bold block mb-0.5">{msg.replyTo.senderName}</span>
                            <p className="truncate opacity-80">
                              {msg.replyTo.attachment ? `[${msg.replyTo.attachment.type}]` : msg.replyTo.text}
                            </p>
                          </div>
                        )}

                        {/* Attachments */}
                        {msg.attachment && (
                          <div className={`mb-1 relative group/media ${(!msg.text && msg.attachment.type !== 'file') ? '' : 'rounded-xl overflow-hidden'}`}>
                            {msg.attachment.type === 'image' && (
                              <div 
                                className="relative cursor-pointer overflow-hidden rounded-2xl" 
                                onClick={() => setPreviewMedia({url: msg.attachment.data, type: 'image', name: msg.attachment.name, id: msg.id})}
                              >
                                <img src={msg.attachment.data} alt="attachment" loading="lazy" className="max-w-full h-auto max-h-64 object-cover hover:scale-[1.02] transition-transform duration-300" />
                                <div className="absolute inset-0 bg-black/0 group-hover/media:bg-black/10 transition-colors flex items-center justify-center">
                                  {downloadingId === msg.id ? (
                                    <div className="p-2 bg-black/50 rounded-full backdrop-blur-md">
                                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                                    </div>
                                  ) : downloadedIds.has(msg.id) ? (
                                    <div className="p-2 bg-green-500/80 rounded-full backdrop-blur-md">
                                      <Check className="w-5 h-5 text-white" />
                                    </div>
                                  ) : (
                                    <div className="p-2 bg-black/40 rounded-full backdrop-blur-md opacity-0 group-hover/media:opacity-100 transition-all transform scale-90 group-hover/media:scale-100">
                                      <Download className="w-5 h-5 text-white drop-shadow-md" onClick={(e) => { e.stopPropagation(); handleDownload(msg.attachment.data, msg.attachment.name, msg.id); }} />
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            {msg.attachment.type === 'video' && (
                              <div 
                                className="relative cursor-pointer overflow-hidden rounded-2xl" 
                                onClick={() => setPreviewMedia({url: msg.attachment.data, type: 'video', name: msg.attachment.name, id: msg.id})}
                              >
                                <video src={msg.attachment.data} className="max-w-full h-auto max-h-64 object-cover" />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/media:bg-black/30 transition-colors">
                                  <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 shadow-lg group-hover/media:scale-110 transition-transform">
                                    <Play className="w-5 h-5 text-white fill-white ml-1" />
                                  </div>
                                </div>
                              </div>
                            )}
                            {msg.attachment.type === 'file' && (
                              <div 
                                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all active:scale-[0.98] ${
                                  isMe 
                                    ? 'bg-white/10 hover:bg-white/20 border border-white/20' 
                                    : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600'
                                }`}
                                onClick={() => setFileAction({url: msg.attachment.data, name: msg.attachment.name, type: 'file', id: msg.id})}
                              >
                                <div className={`p-2.5 rounded-lg shrink-0 ${isMe ? 'bg-white/20 text-white' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-500'}`}>
                                  <FileText className="w-6 h-6" />
                                </div>
                                <div className="flex flex-col min-w-0 flex-1 max-w-[120px]">
                                  <span className="text-xs font-bold truncate">
                                    {msg.attachment.name.length > 12 
                                      ? `${msg.attachment.name.split('.').slice(0, -1).join('.').substring(0, 6)}...${msg.attachment.name.split('.').pop()}`
                                      : msg.attachment.name
                                    }
                                  </span>
                                  <span className={`text-[9px] font-medium uppercase tracking-tighter ${isMe ? 'text-white/60' : 'text-gray-400'}`}>
                                    {msg.attachment.name.split('.').pop()?.toUpperCase() || 'FILE'}
                                  </span>
                                </div>
                                <div className="shrink-0 pl-2">
                                  {downloadingId === msg.id ? (
                                    <Loader2 className={`w-5 h-5 animate-spin ${isMe ? 'text-white' : 'text-gray-400'}`} />
                                  ) : downloadedIds.has(msg.id) ? (
                                    <Check className={`w-5 h-5 ${isMe ? 'text-white' : 'text-green-500'}`} />
                                  ) : (
                                    <Download className={`w-5 h-5 ${isMe ? 'text-white/70' : 'text-gray-400'}`} />
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      {msg.text && <p className={`text-[15px] leading-relaxed whitespace-pre-wrap break-words ${(!msg.text && msg.attachment && msg.attachment.type !== 'file') ? 'hidden' : ''}`}>{msg.text}</p>}
                    </div>
                    <div className="flex items-center gap-1 mt-1 px-1 min-h-[12px]">
                      {isMe && isLastReadByFriend && (
                        <span className="text-[9px] font-bold text-orange-500 uppercase tracking-tighter animate-in fade-in slide-in-from-bottom-1 duration-500">
                          Seen
                        </span>
                      )}
                      {msg.isEdited && <span className="text-[9px] text-gray-400 italic">(edited)</span>}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </motion.div>
    </div>

      {/* Full Screen Media Preview */}
      <AnimatePresence>
        {previewMedia && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl"
            onClick={() => setPreviewMedia(null)}
          >
            <div 
              className="absolute top-0 left-0 right-0 p-4 pt-safe flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <button 
                  onClick={() => setPreviewMedia(null)} 
                  className="p-2 text-white hover:bg-white/20 rounded-full transition-colors"
                  title="Close"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="text-white font-medium text-sm truncate drop-shadow-md">
                  {previewMedia.name}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button 
                  onClick={() => handleDownload(previewMedia.url, previewMedia.name, previewMedia.id)} 
                  className="p-2 text-white hover:bg-white/20 rounded-full transition-colors relative"
                  title="Download"
                  disabled={downloadingId === previewMedia.id}
                >
                  {downloadingId === previewMedia.id ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : downloadedIds.has(previewMedia.id) ? (
                    <Check className="w-6 h-6 text-green-400" />
                  ) : (
                    <Download className="w-6 h-6" />
                  )}
                </button>
              </div>
            </div>
            <motion.div 
              className="w-full h-full flex items-center justify-center" 
              onClick={(e) => e.stopPropagation()}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.8}
              onDragEnd={(e, info) => {
                if (Math.abs(info.offset.y) > 100) {
                  setPreviewMedia(null);
                }
              }}
            >
              {previewMedia.type === 'image' ? (
                <motion.img 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  src={previewMedia.url} 
                  alt="Preview" 
                  className="w-full h-full object-contain cursor-grab active:cursor-grabbing" 
                />
              ) : (
                <motion.video 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  src={previewMedia.url} 
                  controls 
                  autoPlay={false}
                  playsInline
                  className="w-full h-full object-contain cursor-grab active:cursor-grabbing" 
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File Action Bottom Sheet / Popup */}
      <AnimatePresence>
        {fileAction && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={() => setFileAction(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 400 }}
              className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-[2rem] p-6 w-full max-w-[320px] shadow-2xl border border-white/20 dark:border-gray-700/30 flex flex-col items-center text-center"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/40 dark:to-orange-800/20 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
                <FileText className="w-8 h-8 text-orange-500" />
              </div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-white w-full truncate px-2 mb-1">
                {fileAction.name.length > 20 
                  ? `${fileAction.name.split('.').slice(0, -1).join('.').substring(0, 12)}...${fileAction.name.split('.').pop()}`
                  : fileAction.name
                }
              </h3>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-6">{fileAction.type} Document</p>
              
              <div className="flex flex-col gap-2.5 w-full">
                <button 
                  onClick={() => { window.open(fileAction.url, '_blank'); setFileAction(null); }}
                  className="w-full py-3.5 px-4 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 shadow-md shadow-orange-500/20 active:scale-[0.98]"
                >
                  <ExternalLink className="w-5 h-5" /> Open / Preview
                </button>
                <button 
                  onClick={() => { handleDownload(fileAction.url, fileAction.name, fileAction.id); setFileAction(null); }}
                  disabled={downloadingId === fileAction.id}
                  className="w-full py-3.5 px-4 bg-gray-100/80 dark:bg-gray-700/80 text-gray-900 dark:text-white font-semibold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70"
                >
                  {downloadingId === fileAction.id ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Downloading...</>
                  ) : downloadedIds.has(fileAction.id) ? (
                    <><Check className="w-5 h-5 text-green-500" /> Downloaded</>
                  ) : (
                    <><Download className="w-5 h-5" /> Download File</>
                  )}
                </button>
                <button 
                  onClick={() => setFileAction(null)}
                  className="w-full py-3.5 px-4 bg-transparent text-gray-500 dark:text-gray-400 font-semibold rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center active:scale-[0.98] mt-1"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attachment Preview (Before Sending) */}
      <AnimatePresence>
        {attachment && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-[160px] left-4 right-4 bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 z-30 flex items-center gap-3"
          >
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden shrink-0">
              {attachment.type === 'image' ? <img src={attachment.data} alt="preview" className="w-full h-full object-cover" /> :
               attachment.type === 'video' ? <FileVideo className="w-6 h-6 text-gray-500" /> :
               <FileText className="w-6 h-6 text-gray-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {attachment.name.length > 15 
                  ? `${attachment.name.split('.').slice(0, -1).join('.').substring(0, 8)}...${attachment.name.split('.').pop()}`
                  : attachment.name
                }
              </p>
              <p className="text-xs text-gray-500 uppercase">{attachment.type}</p>
            </div>
            <button onClick={() => setAttachment(null)} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              <X className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reply Banner */}
      <AnimatePresence>
        {replyingTo && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-[160px] left-4 right-4 bg-gray-50 dark:bg-gray-800 p-3 rounded-2xl shadow-lg border-l-4 border-l-orange-500 border border-gray-100 dark:border-gray-700 z-30 flex items-start justify-between"
          >
            <div className="flex-1 min-w-0 pr-4">
              <p className="text-xs font-bold text-orange-500 mb-0.5">
                Replying to {replyingTo.senderId === user?.uid ? 'yourself' : friendProfile?.name}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                {replyingTo.attachment ? `[${replyingTo.attachment.type}]` : replyingTo.text}
              </p>
            </div>
            <button onClick={() => setReplyingTo(null)} className="p-1.5 bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
              <X className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className="fixed bottom-24 left-4 right-4 z-40">
        {editingMessage ? (
          <form onSubmit={handleEditMessage} className="max-w-4xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-100 dark:border-gray-700 p-2 flex items-center gap-2 transition-colors duration-300">
              <div className="flex-1 flex items-center gap-3 px-4">
                <Edit2 className="w-4 h-4 text-orange-500 shrink-0" />
                <input
                  type="text"
                  value={editMessageText}
                  onChange={(e) => setEditMessageText(e.target.value)}
                  className="flex-1 bg-transparent border-none py-3 outline-none text-sm text-gray-900 dark:text-white placeholder:text-gray-400"
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-1">
                <button 
                  type="button" 
                  onClick={() => { setEditingMessage(null); setEditMessageText(''); }}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <button 
                  type="submit" 
                  disabled={!editMessageText.trim()}
                  className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-600 disabled:opacity-50 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-green-500/20"
                >
                  <Check className="w-5 h-5" />
                </button>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto">
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,video/*,.pdf,.doc,.docx,.txt" />
            
            <div className="bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-100 dark:border-gray-700 p-2 flex items-center gap-2 transition-colors duration-300">
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 hover:text-orange-500 transition-colors shrink-0"
                title="Attach File"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              
              <input
                type="text"
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  handleTyping();
                }}
                onPaste={handlePaste}
                placeholder="Message..."
                className="flex-1 bg-transparent border-none px-2 py-3 outline-none text-sm text-gray-900 dark:text-white placeholder:text-gray-400"
              />
              
              <button 
                type="submit" 
                disabled={!newMessage.trim() && !attachment}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 ${
                  newMessage.trim() || attachment
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:scale-105 active:scale-95'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            style={{ 
              position: 'fixed', 
              top: Math.min(contextMenu.y, window.innerHeight - 220), 
              left: Math.min(contextMenu.x, window.innerWidth - 180),
              zIndex: 50 
            }}
            className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 py-1.5 min-w-[160px] overflow-hidden"
          >
            {contextMenu.msg.text && (
              <button 
                onClick={() => handleCopyText(contextMenu.msg.text)}
                className="w-full px-4 py-2.5 text-left text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-3 transition-colors"
              >
                <Copy className="w-4 h-4" /> Copy
              </button>
            )}
            <button 
              onClick={() => {
                setReplyingTo(contextMenu.msg);
                setContextMenu(null);
              }}
              className="w-full px-4 py-2.5 text-left text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-3 transition-colors"
            >
              <CornerUpLeft className="w-4 h-4" /> Reply
            </button>
            
            {contextMenu.msg.senderId === user?.uid && (
              <>
                {contextMenu.msg.text && (
                  <button 
                    onClick={() => {
                      setEditingMessage(contextMenu.msg);
                      setEditMessageText(contextMenu.msg.text);
                      setContextMenu(null);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-3 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" /> Edit
                  </button>
                )}
                <div className="h-px bg-gray-200/50 dark:bg-gray-700/50 my-1 mx-2" />
                <button 
                  onClick={() => {
                    handleDeleteMessage(contextMenu.msg.id);
                    setContextMenu(null);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-3 transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Unsend
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
