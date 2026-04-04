import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, getAvatarUrl } from '../App';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, query, onSnapshot, doc, getDoc, addDoc, 
  setDoc, updateDoc, deleteDoc, serverTimestamp, orderBy 
} from 'firebase/firestore';
import { 
  ArrowLeft, Send, Paperclip, X, Edit2, Trash2, 
  Image as ImageIcon, FileText, Check, FileVideo, 
  Download, Play, CornerUpLeft, ExternalLink, 
  Loader2, Copy, Mic, MoreVertical, User, Pencil 
} from 'lucide-react';
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
  const [isListening, setIsListening] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [nicknames, setNicknames] = useState<{ [key: string]: string }>({});
  const [tempNickname, setTempNickname] = useState('');
  const [nicknameTarget, setNicknameTarget] = useState<'me' | 'friend' | null>(null);

  // Sync Nicknames
  useEffect(() => {
    if (!user || !friendId) return;
    const chatId = [user.uid, friendId].sort().join('_');
    return onSnapshot(doc(db, 'chats', chatId), (docSnap) => {
      if (docSnap.exists()) {
        setNicknames(docSnap.data().nicknames || {});
      }
    });
  }, [user, friendId]);

  // Fetch Friend Profile
  useEffect(() => {
    if (!friendId) return;
    return onSnapshot(doc(db, 'publicProfiles', friendId), (docSnap) => {
      if (docSnap.exists()) {
        setFriendProfile(docSnap.data());
      }
      setLoading(false);
    });
  }, [friendId]);

  // Listen for Messages
  useEffect(() => {
    if (!user || !friendId) return;
    const chatId = [user.uid, friendId].sort().join('_');
    const q = query(collection(db, `chats/${chatId}/messages`), orderBy('createdAt', 'asc'));

    return onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })));
    });
  }, [user, friendId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !friendId || (!newMessage.trim() && !attachment)) return;

    const chatId = [user.uid, friendId].sort().join('_');
    const msgData = {
      senderId: user.uid,
      text: newMessage.trim(),
      attachment,
      replyTo: replyingTo ? { 
        id: replyingTo.id, 
        text: replyingTo.text, 
        senderName: replyingTo.senderName 
      } : null,
      createdAt: serverTimestamp(),
    };

    setNewMessage('');
    setAttachment(null);
    setReplyingTo(null);

    try {
      await setDoc(doc(db, 'chats', chatId), {
        lastMessage: attachment ? `[${attachment.type}]` : msgData.text,
        lastMessageAt: serverTimestamp(),
        participants: [user.uid, friendId].sort()
      }, { merge: true });
      await addDoc(collection(db, `chats/${chatId}/messages`), msgData);
    } catch (err) {
      toast.error("Failed to send");
    }
  };

  const handleDownload = (url: string, name: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#FDFBF7] dark:bg-gray-900"><Loader2 className="animate-spin text-orange-500" /></div>;

  return (
    <div className="flex flex-col h-screen bg-[#FDFBF7] dark:bg-gray-900 overflow-hidden relative">
      {/* Header */}
      <header className="px-4 py-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-700 z-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"><ArrowLeft className="w-5 h-5"/></button>
          <div className="flex items-center gap-3">
            <img src={getAvatarUrl(friendProfile)} className="w-10 h-10 rounded-full border border-orange-500/20" alt="Avatar" />
            <div>
              <h2 className="text-sm font-bold dark:text-white">{nicknames[friendId!] || friendProfile?.name}</h2>
              <span className="text-[10px] text-green-500 font-bold uppercase tracking-widest">{friendProfile?.isOnline ? 'Online' : 'Offline'}</span>
            </div>
          </div>
        </div>
        <button onClick={() => setShowMenu(!showMenu)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"><MoreVertical className="w-5 h-5 dark:text-gray-400"/></button>
      </header>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
        {messages.map((msg, i) => {
          const isMe = msg.senderId === user?.uid;
          return (
            <motion.div 
              key={msg.id} 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[75%] px-4 py-2.5 rounded-2xl shadow-sm ${
                  isMe ? 'bg-orange-500 text-white rounded-tr-none' : 'bg-white dark:bg-gray-800 dark:text-white rounded-tl-none border border-gray-100 dark:border-gray-700'
                }`}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ msg, x: e.clientX, y: e.clientY });
                }}
              >
                {msg.replyTo && (
                  <div className="mb-2 p-2 rounded-lg bg-black/5 dark:bg-white/5 border-l-2 border-orange-400 text-[11px] opacity-80">
                    <span className="font-bold block">{msg.replyTo.senderName}</span>
                    <span className="truncate block">{msg.replyTo.text}</span>
                  </div>
                )}
                {msg.attachment?.type === 'image' && <img src={msg.attachment.data} className="rounded-lg mb-2 max-h-60 w-full object-cover" onClick={() => setPreviewMedia({...msg.attachment, id: msg.id})} />}
                {msg.text && <p className="text-[15px] leading-relaxed">{msg.text}</p>}
                <span className={`text-[9px] block mt-1 opacity-60 ${isMe ? 'text-right' : 'text-left'}`}>
                  {format(msg.createdAt, 'h:mm a')}
                </span>
              </div>
            </motion.div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Centered Input Container */}
      <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none pb-6">
        {/* Modern Backdrop Blur */}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#FDFBF7] dark:from-gray-900 to-transparent backdrop-blur-[2px] pointer-events-none" />

        <div className="relative w-full max-w-2xl mx-auto px-4 pointer-events-auto">
          {/* Reply Banner */}
          <AnimatePresence>
            {replyingTo && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="mb-2 bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold text-orange-500 uppercase">Reply to {replyingTo.senderName}</p>
                  <p className="text-xs text-gray-500 truncate">{replyingTo.text}</p>
                </div>
                <button onClick={() => setReplyingTo(null)} className="p-1 bg-gray-100 dark:bg-gray-700 rounded-full"><X className="w-3 h-3"/></button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Input Box */}
          <form onSubmit={handleSendMessage} className="flex items-center gap-2 bg-white dark:bg-gray-900/90 rounded-full p-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 dark:border-gray-800">
            <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => setAttachment({ type: file.type.split('/')[0], data: ev.target?.result as string, name: file.name });
                reader.readAsDataURL(file);
              }
            }} />
            
            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2.5 text-gray-400 hover:text-orange-500 transition-colors">
              <Paperclip className="w-5 h-5" />
            </button>

            <input 
              type="text" 
              value={newMessage} 
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Message..." 
              className="flex-1 bg-transparent border-none px-2 outline-none text-[15px] dark:text-white"
            />

            <button type="submit" disabled={!newMessage.trim() && !attachment} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${newMessage.trim() || attachment ? 'bg-orange-500 text-white shadow-lg active:scale-90' : 'text-gray-300'}`}>
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Media Preview Modal */}
      <AnimatePresence>
        {previewMedia && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4">
            <button onClick={() => setPreviewMedia(null)} className="absolute top-6 left-6 p-2 bg-white/10 rounded-full text-white"><X /></button>
            <img src={previewMedia.url} className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl" />
            <button onClick={() => handleDownload(previewMedia.url, previewMedia.name)} className="absolute bottom-10 px-8 py-3 bg-white rounded-full font-bold flex items-center gap-2"><Download className="w-4 h-4"/> Download</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
