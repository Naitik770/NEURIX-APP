import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, getAvatarUrl } from '../App';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, onSnapshot, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { ArrowLeft, Send, Paperclip, X, Edit2, Trash2, Image as ImageIcon, FileText, Check, FileVideo, Download, Play, CornerUpLeft, ExternalLink, Loader2, Copy, Mic, MoreVertical, User, Pencil } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [isListening, setIsListening] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [chatMetadata, setChatMetadata] = useState<any>(null);
  const [nicknames, setNicknames] = useState<{ [key: string]: string }>({});
  const [tempNickname, setTempNickname] = useState('');
  const [nicknameTarget, setNicknameTarget] = useState<'me' | 'friend' | null>(null);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());

  // Listen for Chat Metadata (Nicknames)
  useEffect(() => {
    if (!user || !friendId) return;
    const chatId = [user.uid, friendId].sort().join('_');
    const unsubscribe = onSnapshot(doc(db, 'chats', chatId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setChatMetadata(data);
        setNicknames(data.nicknames || {});
      }
    });
    return () => unsubscribe();
  }, [user, friendId]);

  // Fetch Friend Profile
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

  // Listen for Messages
  useEffect(() => {
    if (!user || !friendId) return;
    const chatId = [user.uid, friendId].sort().join('_');
    const q = query(
      collection(db, `chats/${chatId}/messages`),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {  
      setMessages(snapshot.docs.map(doc => ({  
        id: doc.id,  
        ...doc.data(),  
        createdAt: doc.data().createdAt?.toDate() || new Date()  
      })));  
    }, (error) => handleFirestoreError(error, OperationType.LIST, `chats/${chatId}/messages`));  

    return () => unsubscribe();

  }, [user, friendId]);

  // Auto Scroll to Bottom
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSetNickname = async () => {
    if (!user || !friendId || !nicknameTarget) return;
    const chatId = [user.uid, friendId].sort().join('_');
    const targetUid = nicknameTarget === 'me' ? user.uid : friendId;

    try {  
      const newNicknames = { ...nicknames, [targetUid]: tempNickname.trim() };  
      await setDoc(doc(db, 'chats', chatId), {  
        nicknames: newNicknames,  
        updatedAt: serverTimestamp(),  
        participants: [user.uid, friendId].sort()  
      }, { merge: true });  
        
      setShowNicknameModal(false);  
      setTempNickname('');  
      setNicknameTarget(null);  
      toast.success("Nickname updated!");  
    } catch (error) {  
      handleFirestoreError(error, OperationType.WRITE, `chats/${chatId}`);  
    }
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error("Speech recognition not supported.");
      return;
    }
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setNewMessage(prev => prev + (prev ? ' ' : '') + transcript);
    };
    recognition.start();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 800 * 1024) {
      toast.error("File size must be under 800KB.");
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

    try {  
      const chatRef = doc(db, 'chats', chatId);  
      await setDoc(chatRef, {  
        participants: [user.uid, friendId],  
        lastMessage: currentAttachment ? `[${currentAttachment.type}]` : messageText,  
        lastMessageAt: serverTimestamp(),  
        updatedAt: serverTimestamp()  
      }, { merge: true });  

      await addDoc(collection(db, `chats/${chatId}/messages`), {  
        senderId: user.uid,  
        text: messageText,  
        attachment: currentAttachment,  
        replyTo: replyData,  
        createdAt: serverTimestamp(),  
        isEdited: false  
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

  const handleDownload = async (dataUrl: string, filename: string, id: string) => {
    setDownloadingId(id);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setDownloadedIds(prev => new Set(prev).add(id));
      setTimeout(() => setDownloadedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      }), 2000);
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

  const shortenFileName = (name: string) => {
    if (name.length <= 12) return name;
    const ext = name.split('.').pop();
    return `${name.substring(0, 8)}...${ext}`;
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
  const isOnline = friendProfile?.isOnline;

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-[#FDFBF7] dark:bg-gray-900 items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#FDFBF7] dark:bg-gray-900 overflow-hidden relative">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-700 z-30">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>

          {friendProfile && (  
            <div className="flex items-center gap-3">  
              <div className="relative w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 overflow-hidden border border-orange-500/20">  
                <img src={getAvatarUrl(friendProfile)} alt="Avatar" className="w-full h-full object-cover" />  
              </div>  
              <div className="flex flex-col">  
                <h2 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">  
                  {nicknames[friendId!] || friendProfile.name}  
                </h2>  
                <div className="flex items-center gap-1.5 mt-0.5">  
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></span>  
                  <p className="text-[9px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider">  
                    {isOnline ? 'Online' : 'Offline'}  
                  </p>  
                </div>  
              </div>  
            </div>  
          )}  
        </div>  

        <div className="relative">  
          <button onClick={() => setShowMenu(!showMenu)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">  
            <MoreVertical className="w-5 h-5" />  
          </button>  
          <AnimatePresence>  
            {showMenu && (  
              <>  
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />  
                <motion.div initial={{ opacity: 0, scale: 0.95, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -10 }} className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 py-2 z-50 overflow-hidden">  
                  <button onClick={() => { setShowMenu(false); setNicknameTarget('friend'); setTempNickname(nicknames[friendId!] || ''); setShowNicknameModal(true); }} className="w-full px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors">  
                    <Pencil className="w-4 h-4 text-orange-500" /> Set Nickname  
                  </button>  
                  <button onClick={() => { setShowMenu(false); navigate(`/profile/${friendId}`); }} className="w-full px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors">  
                    <User className="w-4 h-4 text-orange-500" /> View Profile  
                  </button>  
                </motion.div>  
              </>  
            )}  
          </AnimatePresence>  
        </div>  
      </header>  

      {/* Messages Area */}  
      <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-x-none p-4 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed opacity-90 pb-36">  
        {messages.length === 0 ? (  
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-40">  
            <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center">  
              <Send className="w-8 h-8 text-orange-500" />  
            </div>  
            <p className="text-sm font-bold text-gray-900 dark:text-white">Say hi!</p>  
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
                  
                let bubbleShape = isMe   
                  ? `rounded-2xl ${isFirstInSequence ? 'rounded-tr-2xl' : 'rounded-tr-sm'} ${isLastInSequence ? 'rounded-br-2xl' : 'rounded-br-sm'}`  
                  : `rounded-2xl ${isFirstInSequence ? 'rounded-tl-2xl' : 'rounded-tl-sm'} ${isLastInSequence ? 'rounded-bl-2xl' : 'rounded-bl-sm'}`;  

                return (  
                  <div key={msg.id} id={`msg-${msg.id}`} className={`flex ${isMe ? 'justify-end' : 'justify-start'} items-end gap-2 px-1 ${isLastInSequence ? 'mb-4' : 'mb-1'} relative group`}>  
                    {!isMe && (  
                      <div className="w-6 h-6 shrink-0 mb-1">  
                        {isLastInSequence && (  
                          <div className="w-full h-full rounded-full bg-orange-100 dark:bg-orange-900/30 overflow-hidden">  
                            <img src={getAvatarUrl(friendProfile)} alt="Avatar" className="w-full h-full object-cover" />  
                          </div>  
                        )}  
                      </div>  
                    )}  

                    <motion.div   
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%] relative touch-pan-y`}  
                      drag="x" dragDirectionLock dragConstraints={{ left: 0, right: 0 }} dragElastic={0.6} dragMomentum={false}  
                      onDragEnd={(e, info) => {  
                        const threshold = 60;  
                        if ((!isMe && info.offset.x > threshold) || (isMe && info.offset.x < -threshold)) {  
                          setReplyingTo({  
                            id: msg.id, text: msg.text,  
                            senderName: isMe ? (nicknames[user?.uid!] || user?.displayName || 'You') : (nicknames[friendId!] || friendProfile?.name),  
                            attachment: msg.attachment  
                          });  
                        }  
                      }}  
                    >  
                      <motion.div style={{ position: 'absolute', top: '50%', y: '-50%', [isMe ? 'right' : 'left']: -45, opacity: 0 }} whileDrag={{ opacity: 1, x: isMe ? -15 : 15, transition: { duration: 0.1 } }} className="pointer-events-none">  
                        <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center shadow-lg">  
                          <CornerUpLeft className="w-4 h-4 text-white" />  
                        </div>  
                      </motion.div>  

                      <div   
                        className={`relative group select-none ${isMe ? `bg-orange-500 text-white shadow-sm ${bubbleShape}` : `bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm border border-gray-100 dark:border-gray-700 ${bubbleShape}`} ${(!msg.text && msg.attachment && msg.attachment.type !== 'file') ? 'p-1 bg-transparent border-none shadow-none' : 'px-4 py-2.5'}`}  
                        onContextMenu={(e) => handleContextMenu(e, msg)}  
                      >  
                        {msg.replyTo && (  
                          <div onClick={() => scrollToMessage(msg.replyTo.id)} className={`mb-2 p-2 rounded-xl text-xs border-l-2 cursor-pointer opacity-90 ${isMe ? 'bg-black/10 border-white/50 text-white' : 'bg-gray-50 dark:bg-gray-700/50 border-orange-500 text-gray-700 dark:text-gray-300'}`}>  
                            <span className="font-bold block mb-0.5">{msg.replyTo.senderName}</span>  
                            <p className="truncate opacity-80">{msg.replyTo.attachment ? `[${msg.replyTo.attachment.type}]` : msg.replyTo.text}</p>  
                          </div>  
                        )}  

                        {msg.attachment && (  
                          <div className={`mb-1 relative group/media ${(!msg.text && msg.attachment.type !== 'file') ? '' : 'rounded-xl overflow-hidden'}`}>  
                            {msg.attachment.type === 'image' && (  
                              <div className="relative cursor-pointer overflow-hidden rounded-2xl" onClick={() => setPreviewMedia({url: msg.attachment.data, type: 'image', name: msg.attachment.name, id: msg.id})}>  
                                <img src={msg.attachment.data} alt="attachment" className="max-w-full h-auto max-h-64 object-cover" />  
                              </div>  
                            )}  
                            {msg.attachment.type === 'video' && (  
                              <div className="relative cursor-pointer overflow-hidden rounded-2xl" onClick={() => setPreviewMedia({url: msg.attachment.data, type: 'video', name: msg.attachment.name, id: msg.id})}>  
                                <video src={msg.attachment.data} className="max-w-full h-auto max-h-64 object-cover" />  
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20"><Play className="w-10 h-10 text-white" /></div>  
                              </div>  
                            )}  
                            {msg.attachment.type === 'file' && (  
                              <div   
                                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer ${isMe ? 'bg-white/10' : 'bg-gray-50 dark:bg-gray-700/50'}`}  
                                onClick={() => setFileAction({url: msg.attachment.data, name: msg.attachment.name, type: 'file', id: msg.id})}  
                              >  
                                <FileText className="w-6 h-6 text-orange-500" />  
                                <div className="flex flex-col min-w-0 flex-1">  
                                  <span className="text-sm font-semibold truncate">{shortenFileName(msg.attachment.name)}</span>  
                                  <span className="text-[10px] opacity-70">FILE</span>  
                                </div>  
                                <Download className="w-4 h-4 opacity-50" />  
                              </div>  
                            )}  
                          </div>  
                        )}  
                        {msg.text && <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>}  
                      </div>  
                      <div className="flex items-center gap-1 mt-1 px-1">  
                        <span className="text-[9px] text-gray-400">{formatMessageDate(msg.createdAt)}</span>  
                        {msg.isEdited && <span className="text-[9px] text-gray-400 italic">(edited)</span>}  
                      </div>  
                    </motion.div>  
                  </div>  
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl" onClick={() => setPreviewMedia(null)}>  
            <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10" onClick={e => e.stopPropagation()}>  
              <button onClick={() => setPreviewMedia(null)} className="p-2 text-white bg-white/10 rounded-full"><ArrowLeft className="w-6 h-6" /></button>  
              <button onClick={() => handleDownload(previewMedia.url, previewMedia.name, previewMedia.id)} className="p-2 text-white bg-white/10 rounded-full"><Download className="w-6 h-6" /></button>  
            </div>  
            {previewMedia.type === 'image' ? <img src={previewMedia.url} className="max-w-full max-h-full object-contain" /> : <video src={previewMedia.url} controls autoPlay className="max-w-full max-h-full object-contain" />}  
          </motion.div>  
        )}  
      </AnimatePresence>  

      {/* File Action Bottom Sheet */}  
      <AnimatePresence>  
        {fileAction && (  
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setFileAction(null)}>  
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white dark:bg-gray-800 rounded-3xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>  
              <FileText className="w-12 h-12 text-orange-500 mx-auto mb-4" />  
              <h3 className="font-bold text-lg mb-6 truncate">{fileAction.name}</h3>  
              <div className="flex flex-col gap-2">  
                <button onClick={() => window.open(fileAction.url)} className="w-full py-4 bg-orange-500 text-white font-bold rounded-2xl">Open File</button>  
                <button onClick={() => { handleDownload(fileAction.url, fileAction.name, fileAction.id); setFileAction(null); }} className="w-full py-4 bg-gray-100 dark:bg-gray-700 font-bold rounded-2xl">Download</button>  
                <button onClick={() => setFileAction(null)} className="w-full py-4 text-gray-500">Cancel</button>  
              </div>  
            </motion.div>  
          </motion.div>  
        )}  
      </AnimatePresence>  

      {/* Reply/Attachment Banner */}  
      <AnimatePresence>  
        {(attachment || replyingTo) && (  
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute bottom-[95px] left-1/2 -translate-x-1/2 w-[calc(100%-48px)] max-w-2xl bg-white/95 dark:bg-gray-800/95 backdrop-blur-md p-3 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 z-[45] flex items-center gap-3">  
             <div className="flex-1 min-w-0 px-1">  
               <p className="text-[10px] font-bold text-orange-500 mb-0.5 uppercase tracking-wider">{attachment ? 'Attachment' : `Reply to ${replyingTo.senderName}`}</p>  
               <p className="text-sm text-gray-600 dark:text-gray-300 truncate">{attachment ? attachment.name : replyingTo.text}</p>  
             </div>  
             <button onClick={() => {setAttachment(null); setReplyingTo(null)}} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full transition-transform active:scale-90"><X className="w-4 h-4 text-gray-500"/></button>  
          </motion.div>  
        )}  
      </AnimatePresence>

      {/* Input Area - PERFECTLY CENTERED */}
      <div className="absolute bottom-0 w-full left-0 right-0 z-40 pointer-events-none">
        {/* Subtle Blur Background - Spans full width */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white via-white/80 to-transparent dark:from-gray-900 dark:via-gray-900/80 dark:to-transparent pointer-events-none" />

        {/* Input Container - Constrained and Centered */}  
        <div className="relative w-full max-w-2xl mx-auto px-4 pb-6 pointer-events-auto">  
          {editingMessage ? (  
            <motion.form   
              initial={{ y: 20, opacity: 0 }}   
              animate={{ y: 0, opacity: 1 }}  
              onSubmit={handleEditMessage}   
              className="flex flex-col gap-2 w-full bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700"  
            >  
              <div className="flex items-center justify-between px-2">  
                <span className="text-[10px] font-bold text-orange-500 flex items-center gap-1 uppercase tracking-wider">  
                  <Edit2 className="w-3 h-3"/> Editing Message  
                </span>  
                <button type="button" onClick={() => { setEditingMessage(null); setEditMessageText(''); }} className="text-gray-400 hover:text-gray-600">  
                  <X className="w-4 h-4"/>  
                </button>  
              </div>  
              <div className="flex items-center gap-2">  
                <input   
                  type="text"   
                  value={editMessageText}   
                  onChange={(e) => setEditMessageText(e.target.value)}  
                  className="flex-1 bg-gray-50 dark:bg-gray-900 border-none rounded-xl px-4 py-2.5 outline-none text-[14px] dark:text-white"  
                  autoFocus   
                />  
                <button type="submit" className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center text-white shadow-md active:scale-95 transition-transform">  
                  <Check className="w-4 h-4" />  
                </button>  
              </div>  
            </motion.form>  
          ) : (  
            <form onSubmit={handleSendMessage} className="flex items-center gap-2 w-full">  
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,video/*,.pdf,.doc,.docx,.txt" />  
                
              <div className="flex-1 flex items-center bg-white dark:bg-gray-800 rounded-full pl-2 pr-1.5 py-1.5 shadow-2xl border border-gray-100 dark:border-gray-700 transition-all focus-within:border-orange-500/50">  
                <button   
                  type="button"   
                  onClick={() => fileInputRef.current?.click()}   
                  className="p-2 text-gray-400 hover:text-orange-500 transition-colors shrink-0"  
                >  
                  <Paperclip className="w-5 h-5" />  
                </button>  

                <input   
                  type="text"   
                  value={newMessage}   
                  onChange={(e) => setNewMessage(e.target.value)}   
                  placeholder="Message..."  
                  className="flex-1 bg-transparent border-none px-2 py-1 outline-none text-[15px] text-gray-900 dark:text-white placeholder:text-gray-400 min-w-0"   
                />  

                <div className="flex items-center gap-0.5">  
                  <button   
                    type="button"   
                    onClick={startListening}   
                    className={`p-2 transition-colors shrink-0 ${isListening ? 'text-orange-500 animate-pulse' : 'text-gray-400 hover:text-orange-500'}`}  
                  >  
                    <Mic className="w-5 h-5" />  
                  </button>  

                  <button   
                    type="submit"   
                    disabled={!newMessage.trim() && !attachment}   
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 ${  
                      (newMessage.trim() || attachment)   
                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20 scale-100 active:scale-90'   
                        : 'bg-transparent text-gray-300 pointer-events-none'  
                    }`}  
                  >  
                    <Send className="w-4 h-4" />  
                  </button>  
                </div>  
              </div>  
            </form>  
          )}  
        </div>  
      </div>  

      {/* Nickname Modal */}  
      <AnimatePresence>  
        {showNicknameModal && (  
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">  
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowNicknameModal(false)} />  
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-sm bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-2xl">  
              <h3 className="text-xl font-bold mb-4 dark:text-white">Set Nickname</h3>  
              <div className="flex gap-2 mb-4">  
                <button onClick={() => {setNicknameTarget('friend'); setTempNickname(nicknames[friendId!] || '');}} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors ${nicknameTarget === 'friend' ? 'bg-orange-500 text-white shadow-lg' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>Friend</button>  
                <button onClick={() => {setNicknameTarget('me'); setTempNickname(nicknames[user?.uid!] || '');}} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors ${nicknameTarget === 'me' ? 'bg-orange-500 text-white shadow-lg' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>Me</button>  
              </div>  
              <input   
                type="text" value={tempNickname} onChange={(e) => setTempNickname(e.target.value)}   
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl px-4 py-4 mb-6 outline-none dark:text-white"   
                placeholder="Enter nickname..."   
              />  
              <div className="flex gap-3">  
                <button onClick={() => setShowNicknameModal(false)} className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 rounded-2xl font-bold text-gray-600 dark:text-gray-300">Cancel</button>  
                <button onClick={handleSetNickname} className="flex-1 py-4 bg-orange-500 text-white rounded-2xl font-bold shadow-lg shadow-orange-500/30 transition-transform active:scale-95">Save</button>  
              </div>  
            </motion.div>  
          </div>  
        )}  
      </AnimatePresence>  

      {/* Context Menu */}  
      <AnimatePresence>  
        {contextMenu && (  
          <>  
            <div className="fixed inset-0 z-[105]" onClick={() => setContextMenu(null)} />  
            <motion.div   
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}  
              style={{ position: 'fixed', top: Math.min(contextMenu.y, window.innerHeight - 220), left: Math.min(contextMenu.x, window.innerWidth - 180), zIndex: 110 }}  
              className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 py-1.5 min-w-[160px] overflow-hidden"  
            >  
              {contextMenu.msg.text && (  
                <button onClick={() => {navigator.clipboard.writeText(contextMenu.msg.text); toast.success('Copied to clipboard'); setContextMenu(null);}} className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">  
                  <Copy className="w-4 h-4 text-gray-400" /> Copy  
                </button>  
              )}  
              <button onClick={() => { setReplyingTo(contextMenu.msg); setContextMenu(null); }} className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">  
                <CornerUpLeft className="w-4 h-4 text-gray-400" /> Reply  
              </button>  
              {contextMenu.msg.senderId === user?.uid && (  
                <>  
                  {contextMenu.msg.text && (  
                    <button onClick={() => { setEditingMessage(contextMenu.msg); setEditMessageText(contextMenu.msg.text); setContextMenu(null); }} className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">  
                      <Edit2 className="w-4 h-4 text-gray-400" /> Edit  
                    </button>  
                  )}  
                  <button onClick={() => { handleDeleteMessage(contextMenu.msg.id); setContextMenu(null); }} className="w-full px-4 py-2.5 text-left text-sm text-red-500 flex items-center gap-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">  
                    <Trash2 className="w-4 h-4" /> Unsend  
                  </button>  
                </>  
              )}  
            </motion.div>  
          </>  
        )}  
      </AnimatePresence>  
    </div>
  );
}
