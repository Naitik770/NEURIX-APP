import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  setDoc, 
  serverTimestamp,
  limit,
  Timestamp
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Message, User, ChatState } from '../types';

const ChatContext = createContext<ChatState | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userData: User = {
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || 'Anonymous',
          photoURL: firebaseUser.photoURL || null,
          lastSeen: new Date().toISOString(),
          isTyping: false
        } as User;
        setUser(userData);
        await setDoc(doc(db, 'users', firebaseUser.uid), userData, { merge: true });
      } else {
        setUser(null);
      }
    });
    return unsubscribe;
  }, []);

  // Messages Sync
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'messages'), orderBy('createdAt', 'asc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        msgs.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt
        } as Message);
      });
      setMessages(msgs);
    });
    return unsubscribe;
  }, [user]);

  // Users Sync
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersMap: Record<string, User> = {};
      snapshot.forEach((doc) => {
        usersMap[doc.id] = doc.data() as User;
      });
      setUsers(usersMap);
    });
    return unsubscribe;
  }, [user]);

  const sendMessage = useCallback(async (text: string) => {
    if (!user) return;
    const msgData = {
      senderId: user.uid,
      text,
      createdAt: serverTimestamp(),
      replyToMessageId: replyingTo?.id || null,
      status: 'sent'
    };
    await addDoc(collection(db, 'messages'), msgData);
    setReplyingTo(null);
  }, [user, replyingTo]);

  const markAsSeen = useCallback(async (messageId: string) => {
    if (!user) return;
    await updateDoc(doc(db, 'messages', messageId), { status: 'seen' });
  }, [user]);

  const setTyping = useCallback(async (isTyping: boolean) => {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid), { isTyping });
  }, [user]);

  const value = {
    user,
    messages,
    users,
    replyingTo,
    setReplyingTo,
    setTyping,
    sendMessage,
    markAsSeen
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}

export async function login() {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
}
