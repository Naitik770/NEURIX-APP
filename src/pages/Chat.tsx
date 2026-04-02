import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, getAvatarUrl } from '../App';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, onSnapshot, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { ArrowLeft, Send, Paperclip, X, Edit2, Trash2, Image as ImageIcon, FileText, Check, FileVideo, Download, Play, CornerUpLeft, ExternalLink, Loader2, Copy, MoreVertical, User, Edit3 } from 'lucide-react';
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [attachment, setAttachment] = useState<{ type: string, data: string, name: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ msg: any, x: number, y: number } | null>(null);
  const [editingMessage, setEditingMessage] = useState<any>(null);
  const [editMessageText, setEditMessageText] = useState('');
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [previewMedia, setPreviewMedia] = useState<{url: string, type: string, name: string, id: string} | null>(null);
  const [fileAction, setFileAction] = useState<{url: string, name: string, type: string, id: string} | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [showMenu, setShowMenu] = useState(false);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [chatMetadata, setChatMetadata] = useState<any>(null);
  const [tempMyNickname, setTempMyNickname] = useState('');
  const [tempFriendNickname, setTempFriendNickname] = useState('');

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

  // Fetch messages
  useEffect(() => {
    if (!user || !friendId) return;
    const chatId = [user.uid, friendId].sort().join('_');
    const q = query(collection(db, `chats/${chatId}/messages`), orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date() 
      })));
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `chats/${chatId}/messages`));

    return () => unsubscribe();
  }, [user, friendId]);

  // Listen for other user typing
  useEffect(() => {
    if (!user || !friendId) return;
    const chatId = [user.uid, friendId].sort().join('_');
    const chatRef = doc(db, 'chats', chatId);
    
    const unsubscribe = onSnapshot(chatRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const typing = data.typing || {};
        setOtherUserTyping(!!typing[friendId]);
      }
    });

    return () => unsubscribe();
  }, [user, friendId]);

  // Fetch chat metadata (for nicknames)
  useEffect(() => {
    if (!user || !friendId) return;
    const chatId = [user.uid, friendId].sort().join('_');
    const chatRef = doc(db, 'chats', chatId);
    
    const unsubscribe = onSnapshot(chatRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setChatMetadata(data);
        const nicknames = data.nicknames || {};
        setTempMyNickname(nicknames[user.uid] || '');
        setTempFriendNickname(nicknames[friendId] || '');
      }
    });

    return () => unsubscribe();
  }, [user, friendId]);

  // Mark messages as seen
  useEffect(() => {
    if (!user || !friendId || messages.length === 0) return;
    
    const chatId = [user.uid, friendId].sort().join('_');
    const unreadMessages = messages.filter(msg => msg.senderId !== user.uid && !msg.isSeen);
    
    if (unreadMessages.length > 0) {
      unreadMessages.forEach(async (msg) => {
        try {
          const msgRef = doc(db, `chats/${chatId}/messages`, msg.id);
          await updateDoc(msgRef, {
            isSeen: true,
            seenAt: serverTimestamp()
          });
        } catch (error) {
          console.error("Error marking message as seen:", error);
        }
      });

      // Update chat metadata to mark last message as seen if it was from friend
      const chatRef = doc(db, 'chats', chatId);
      updateDoc(chatRef, {
        isLastMessageSeen: true
      }).catch(() => {});
    }
  }, [user, friendId, messages]);

  // Handle current user typing status
  const updateTypingStatus = async (isTyping: boolean) => {
    if (!user || !friendId) return;
    const chatId = [user.uid, friendId].sort().join('_');
    const chatRef = doc(db, 'chats', chatId);
    try {
      await updateDoc(chatRef, {
        [`typing.${user.uid}`]: isTyping
      });
    } catch (error) {
      // If document doesn't exist, we might need to set it first
      // But usually it's created when a message is sent or when the chat starts
    }
  };

  const saveNicknames = async () => {
    if (!user || !friendId) return;
    const chatId = [user.uid, friendId].sort().join('_');
    const chatRef = doc(db, 'chats', chatId);
    
    try {
      await setDoc(chatRef, {
        nicknames: {
          [user.uid]: tempMyNickname,
          [friendId]: tempFriendNickname
        }
      }, { merge: true });
      
      // Also update Friend document for the friends page
      const myFriendDocRef = doc(db, `users/${user.uid}/friends`, friendId);
      await updateDoc(myFriendDocRef, {
        nickname: tempFriendNickname
      }).catch(() => {});

      // Update my nickname in friend's friend list
      const friendsMeDocRef = doc(db, `users/${friendId}/friends`, user.uid);
      await updateDoc(friendsMeDocRef, {
        nickname: tempMyNickname
      }).catch(() => {});

      setShowNicknameModal(false);
      toast.success("Nicknames updated!");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `chats/${chatId}`);
    }
  };

  const getSeenStatusText = (seenAt: any) => {
    if (!seenAt) return 'Seen';
    const date = seenAt.toDate ? seenAt.toDate() : new Date(seenAt);
    const diffInSeconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Seen now';
    
    const distance = formatDistanceToNow(date)
      .replace('about ', '')
      .replace('less than a minute', 'now')
      .replace(' minutes', 'm')
      .replace(' minute', 'm')
      .replace(' hours', 'h')
      .replace(' hour', 'h')
      .replace(' days', 'd')
      .replace(' day', 'd')
      .replace(' months', 'mo')
      .replace(' month', 'mo')
      .replace(' years', 'y')
      .replace(' year', 'y');
      
    return distance === 'now' ? 'Seen now' : `Seen ${distance} ago`;
  };

  const handleTyping = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    } else {
      updateTypingStatus(true);
    }

    typingTimeoutRef.current = setTimeout(() => {
      updateTypingStatus(false);
      typingTimeoutRef.current = null;
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        updateTypingStatus(false);
      }
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
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be less than 10MB.");
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
    const items = e.clipboardData?.items;
    const files = e.clipboardData?.files;

    // Try files first (often used by mobile keyboards for GIFs)
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        handlePastedFile(file);
        return;
      }
    }

    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          handlePastedFile(file);
          break;
        }
      }
    }
  };

  const handlePastedFile = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be less than 10MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result as string;
      setAttachment({ 
        type: 'image', 
        data, 
        name: file.name || `pasted-image-${Date.now()}.${file.type.split('/')[1] || 'png'}` 
      });
    };
    reader.readAsDataURL(file);
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
      senderName: replyingTo.senderId === user.uid 
        ? (chatMetadata?.nicknames?.[user.uid] || 'You') 
        : (chatMetadata?.nicknames?.[friendId] || friendProfile?.name || 'User'),
      attachment: replyingTo.attachment ? { type: replyingTo.attachment.type } : null
    } : null;

    setNewMessage('');
    setAttachment(null);
    setReplyingTo(null);
    updateTypingStatus(false);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const chatRef = doc(db, 'chats', chatId);
      await setDoc(chatRef, {
        participants: [user.uid, friendId],
        lastMessage: currentAttachment ? `[${currentAttachment.type}]` : messageText,
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessageSenderId: user.uid,
        isLastMessageSeen: false
      }, { merge: true });

      await addDoc(collection(db, `chats/${chatId}/messages`), {
        senderId: user.uid,
        text: messageText,
        attachment: currentAttachment,
        replyTo: replyData,
        createdAt: serverTimestamp(),
        isEdited: false,
        isSeen: false
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chats/${chatId}/messages`);
    }
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

  const shortenFileName = (name: string, maxLength: number = 20) => {
    if (!name) return '';
    if (name.length <= maxLength) return name;
    const extension = name.split('.').pop();
    const baseName = name.substring(0, name.lastIndexOf('.'));
    if (baseName.length > maxLength - 5) {
      return baseName.substring(0, maxLength - 8) + '...' + (extension ? '.' + extension : '');
    }
    return name;
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-[#FDFBF7] dark:bg-gray-900 items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#FDFBF7] dark:bg-gray-900 overflow-hidden relative">
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
                <h2 className="font-bold text-gray-900 dark:text-white leading-tight text-sm">
                  {chatMetadata?.nicknames?.[friendId] || friendProfile.name}
                </h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {otherUserTyping ? (
                    <p className="text-[10px] text-orange-500 font-bold animate-pulse">Typing...</p>
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

        <div className="relative">
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          <AnimatePresence>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 py-2 z-40"
                >
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowNicknameModal(true);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3"
                  >
                    <Edit3 className="w-4 h-4 text-orange-500" />
                    Set Nickname
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      navigate(`/friend/${friendId}`);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3"
                  >
                    <User className="w-4 h-4 text-orange-500" />
                    View Profile
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 pb-32 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed opacity-90">
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
                const isLastMessageInChat = msg.id === messages[messages.length - 1].id;
                const showSeenStatus = isMe && isLastMessageInChat && msg.isSeen;
                
                const prevMsg = index > 0 ? group[index - 1] : null;
                const nextMsg = index < group.length - 1 ? group[index + 1] : null;
                
                const isFirstInSequence = !prevMsg || prevMsg.senderId !== msg.senderId;
                const isLastInSequence = !nextMsg || nextMsg.senderId !== msg.senderId;
                
                const spacingClass = isLastInSequence ? 'mb-4' : 'mb-1';

                const handleSwipeReply = (event: any, info: any) => {
                  const threshold = 60;
                  const x = info.offset.x;
                  
                  if (isMe) {
                    // Swipe left (negative x)
                    if (x < -threshold) {
                      setReplyingTo(msg);
                    }
                  } else {
                    // Swipe right (positive x)
                    if (x > threshold) {
                      setReplyingTo(msg);
                    }
                  }
                };

                let bubbleShape = '';
                if (isMe) {
                  bubbleShape = `rounded-2xl ${isFirstInSequence ? 'rounded-tr-2xl' : 'rounded-tr-sm'} ${isLastInSequence ? 'rounded-br-2xl' : 'rounded-br-sm'}`;
                } else {
                  bubbleShape = `rounded-2xl ${isFirstInSequence ? 'rounded-tl-2xl' : 'rounded-tl-sm'} ${isLastInSequence ? 'rounded-bl-2xl' : 'rounded-bl-sm'}`;
                }

                return (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    key={msg.id} 
                    id={`msg-${msg.id}`}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'} items-end gap-2 transition-colors duration-500 px-1 ${spacingClass}`}
                    onContextMenu={(e) => handleContextMenu(e, msg)}
                    onTouchStart={(e) => {
                      const timer = setTimeout(() => handleContextMenu(e, msg), 500);
                      e.currentTarget.dataset.timer = timer.toString();
                    }}
                    onTouchEnd={(e) => clearTimeout(Number(e.currentTarget.dataset.timer))}
                    onTouchMove={(e) => clearTimeout(Number(e.currentTarget.dataset.timer))}
                  >
                    {!isMe && (
                      <div className="w-6 h-6 shrink-0 mb-1">
                        {isLastInSequence && (
                          <div className="w-full h-full rounded-full bg-orange-100 dark:bg-orange-900/30 overflow-hidden">
                            <img src={getAvatarUrl(friendProfile)} alt="Avatar" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>
                    )}

                    <div className={`relative flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%]`}>
                      <motion.div 
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.6}
                        onDragEnd={handleSwipeReply}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} w-full cursor-grab active:cursor-grabbing`}
                      >
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
                                  <div className="flex flex-col min-w-0 flex-1 max-w-[180px] sm:max-w-[220px]">
                                    <span className="text-sm font-semibold truncate">{shortenFileName(msg.attachment.name)}</span>
                                    <span className={`text-[10px] uppercase tracking-wider ${isMe ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>
                                      Document
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
                        <div className="flex items-center gap-1 mt-1 px-1">
                          <span className="text-[9px] text-gray-400">
                            {showSeenStatus ? getSeenStatusText(msg.seenAt) : formatMessageDate(msg.createdAt)}
                          </span>
                          {msg.isEdited && <span className="text-[9px] text-gray-400 italic">(edited)</span>}
                        </div>
                      </motion.div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
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
                  {shortenFileName(previewMedia.name, 30)}
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
              <h3 className="font-bold text-lg text-gray-900 dark:text-white w-full truncate px-2 mb-1">{shortenFileName(fileAction.name, 25)}</h3>
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
            className="absolute bottom-[80px] left-6 right-6 bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 z-30 flex items-center gap-3"
          >
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden shrink-0">
              {attachment.type === 'image' ? <img src={attachment.data} alt="preview" className="w-full h-full object-cover" /> :
               attachment.type === 'video' ? <FileVideo className="w-6 h-6 text-gray-500" /> :
               <FileText className="w-6 h-6 text-gray-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{shortenFileName(attachment.name)}</p>
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
            className="absolute bottom-[80px] left-6 right-6 bg-gray-50 dark:bg-gray-800 p-3 rounded-2xl shadow-2xl border-l-4 border-l-orange-500 border border-gray-100 dark:border-gray-700 z-30 flex items-start justify-between"
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
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-transparent z-40">
        {editingMessage ? (
          <form onSubmit={handleEditMessage} className="flex flex-col gap-2 max-w-4xl mx-auto bg-white dark:bg-gray-800 p-4 rounded-[2rem] shadow-2xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-semibold text-orange-500 flex items-center gap-1"><Edit2 className="w-3 h-3"/> Editing message</span>
              <button type="button" onClick={() => { setEditingMessage(null); setEditMessageText(''); }} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4"/></button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editMessageText}
                onChange={(e) => setEditMessageText(e.target.value)}
                className="flex-1 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-5 py-3.5 outline-none focus:ring-2 focus:ring-orange-500/50 text-sm text-gray-900 dark:text-white transition-all"
                autoFocus
              />
              <button type="submit" disabled={!editMessageText.trim()} className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white hover:bg-green-600 disabled:opacity-50 transition-all shadow-lg shadow-green-500/20 active:scale-95">
                <Check className="w-5 h-5" />
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSendMessage} className="flex items-end gap-2 max-w-4xl mx-auto">
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,video/*,.pdf,.doc,.docx,.txt" />
            
            <div className="flex-1 flex items-center bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-700 p-1.5 transition-all focus-within:border-orange-500/30">
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                className="w-11 h-11 rounded-full flex items-center justify-center text-gray-400 hover:text-orange-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shrink-0"
                title="Attach File"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              
              <textarea
                ref={textareaRef}
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  handleTyping();
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onPaste={handlePaste}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e as any);
                  }
                }}
                placeholder="Message..."
                enterKeyHint="send"
                className="flex-1 bg-transparent border-none px-3 py-3 outline-none text-sm text-gray-900 dark:text-white max-h-32 resize-none custom-scrollbar placeholder:text-gray-400"
                rows={1}
              />
              
              <button 
                type="submit" 
                disabled={!newMessage.trim() && !attachment}
                className="w-11 h-11 rounded-full bg-gray-900 dark:bg-orange-500 text-white flex items-center justify-center hover:bg-black dark:hover:bg-orange-600 disabled:opacity-30 disabled:grayscale transition-all shrink-0 active:scale-95 shadow-md"
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
      {/* Nickname Modal */}
      <AnimatePresence>
        {showNicknameModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNicknameModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Set Nicknames</h3>
                  <button onClick={() => setShowNicknameModal(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 px-1">Your Nickname</label>
                    <input
                      type="text"
                      value={tempMyNickname}
                      onChange={(e) => setTempMyNickname(e.target.value)}
                      placeholder="Enter your nickname..."
                      className="w-full bg-gray-50 dark:bg-gray-900/50 border-none rounded-2xl px-4 py-4 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 px-1">{friendProfile?.name}'s Nickname</label>
                    <input
                      type="text"
                      value={tempFriendNickname}
                      onChange={(e) => setTempFriendNickname(e.target.value)}
                      placeholder={`Enter ${friendProfile?.name}'s nickname...`}
                      className="w-full bg-gray-50 dark:bg-gray-900/50 border-none rounded-2xl px-4 py-4 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-8">
                  <button
                    onClick={() => setShowNicknameModal(false)}
                    className="flex-1 py-4 rounded-2xl text-sm font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveNicknames}
                    className="flex-1 py-4 rounded-2xl bg-orange-500 text-white text-sm font-bold shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all active:scale-95"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
