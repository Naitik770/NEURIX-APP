import React, { useState, useEffect } from 'react';
import { useAuth, getAvatarUrl } from '../App';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp, getDoc, where, getDocs, limit } from 'firebase/firestore';
import { ArrowLeft, Search, UserPlus, Check, X, MessageCircle, UserX, Clock, UserCheck } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

const UserCard = ({ result, onAdd, onTabChange }: { result: any, onAdd: (id: string) => void, onTabChange: (tab: any) => void }) => (
  <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm flex items-center justify-between border border-transparent hover:border-orange-500/20 transition-all">
    <div className="flex items-center gap-4">
      <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 overflow-hidden border-2 border-white dark:border-gray-700 shadow-sm">
        <img src={getAvatarUrl(result)} alt="Avatar" className="w-full h-full object-cover" />
      </div>
      <div>
        <h3 className="font-bold text-gray-900 dark:text-white text-lg">{result.name}</h3>
        <p className="text-sm text-orange-500 font-medium">@{result.username}</p>
      </div>
    </div>
    {result.isFriend ? (
      <div className="flex items-center gap-2 text-gray-400 bg-gray-50 dark:bg-gray-700 px-4 py-2 rounded-xl text-xs font-bold">
        <UserCheck className="w-4 h-4" />
        Friends
      </div>
    ) : result.hasSentRequest ? (
      <div className="flex items-center gap-2 text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-4 py-2 rounded-xl text-xs font-bold">
        <Clock className="w-4 h-4" />
        Pending
      </div>
    ) : result.hasReceivedRequest ? (
      <button 
        onClick={() => onTabChange('requests')} 
        className="bg-green-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-green-600 transition-all shadow-lg shadow-green-500/20"
      >
        View Request
      </button>
    ) : (
      <button 
        onClick={() => onAdd(result.id)} 
        className="bg-orange-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-orange-600 transition-all flex items-center gap-2 shadow-lg shadow-orange-500/20 active:scale-95"
      >
        <UserPlus className="w-4 h-4" /> Add Friend
      </button>
    )}
  </div>
);

export default function Messages() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'add'>('friends');
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [chats, setChats] = useState<any[]>([]);

  // Fetch Chats
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'chats'), where('participants', 'array-contains', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setChats(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'chats'));
    return () => unsubscribe();
  }, [user]);

  // Fetch Friends
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/friends`));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const friendsData = await Promise.all(snapshot.docs.map(async (d) => {
        const friendDoc = await getDoc(doc(db, 'publicProfiles', d.id));
        return { id: d.id, ...friendDoc.data(), nickname: d.data().nickname };
      }));
      setFriends(friendsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/friends`));
    return () => unsubscribe();
  }, [user]);

  // Fetch Friend Requests
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/friendRequests`));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const reqsData = await Promise.all(snapshot.docs.map(async (d) => {
        const reqData = d.data();
        const senderDoc = await getDoc(doc(db, 'publicProfiles', reqData.fromUid));
        return { id: d.id, ...reqData, senderProfile: senderDoc.data() };
      }));
      setRequests(reqsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/friendRequests`));
    return () => unsubscribe();
  }, [user]);

  // Fetch Suggestions
  useEffect(() => {
    if (!user || activeTab !== 'add') return;
    const fetchSuggestions = async () => {
      try {
        const q = query(collection(db, 'publicProfiles'), limit(10));
        const snapshot = await getDocs(q);
        const suggestedUsers = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(u => u.id !== user.uid && !friends.some(f => f.id === u.id));
        setSuggestions(suggestedUsers);
      } catch (error) {
        console.error("Error fetching suggestions:", error);
      }
    };
    fetchSuggestions();
  }, [user, activeTab, friends]);

  // Real-time Search
  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim() || !user) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const lowerQuery = searchQuery.toLowerCase();
        
        // Search by username prefix
        const q1 = query(
          collection(db, 'publicProfiles'),
          where('username', '>=', lowerQuery),
          where('username', '<=', lowerQuery + '\uf8ff'),
          limit(10)
        );

        // Search by name prefix
        const q2 = query(
          collection(db, 'publicProfiles'),
          where('searchName', '>=', lowerQuery),
          where('searchName', '<=', lowerQuery + '\uf8ff'),
          limit(10)
        );

        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
        
        const resultsMap = new Map();
        
        [...snap1.docs, ...snap2.docs].forEach(doc => {
          if (doc.id !== user.uid) {
            resultsMap.set(doc.id, { id: doc.id, ...doc.data() });
          }
        });

        const combinedResults = Array.from(resultsMap.values());

        // Check friend status for each result
        const finalResults = await Promise.all(combinedResults.map(async (res) => {
          const friendDoc = await getDoc(doc(db, `users/${user.uid}/friends`, res.id));
          const sentRequestDoc = await getDoc(doc(db, `users/${res.id}/friendRequests`, user.uid));
          const receivedRequestDoc = await getDoc(doc(db, `users/${user.uid}/friendRequests`, res.id));

          return {
            ...res,
            isFriend: friendDoc.exists(),
            hasSentRequest: sentRequestDoc.exists(),
            hasReceivedRequest: receivedRequestDoc.exists()
          };
        }));

        setSearchResults(finalResults);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(searchUsers, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, user]);

  const sendFriendRequest = async (targetUid: string) => {
    if (!user || !profile?.username) {
      toast.error("Please set a username first");
      return;
    }
    try {
      const requestRef = doc(db, `users/${targetUid}/friendRequests`, user.uid);
      await setDoc(requestRef, {
        fromUid: user.uid,
        fromUsername: profile.username,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      toast.success("Friend request sent!");
      setSearchResults(prev => prev.map(res => 
        res.id === targetUid ? { ...res, hasSentRequest: true } : res
      ));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${targetUid}/friendRequests/${user.uid}`);
    }
  };

  const acceptRequest = async (request: any) => {
    if (!user || !profile?.username) return;
    try {
      const senderProfile = request.senderProfile;
      await setDoc(doc(db, `users/${user.uid}/friends`, request.fromUid), {
        friendUid: request.fromUid,
        friendUsername: senderProfile.username,
        nickname: '',
        createdAt: serverTimestamp()
      });
      await setDoc(doc(db, `users/${request.fromUid}/friends`, user.uid), {
        friendUid: user.uid,
        friendUsername: profile.username,
        nickname: '',
        createdAt: serverTimestamp()
      });
      await deleteDoc(doc(db, `users/${user.uid}/friendRequests`, request.id));
      
      await setDoc(doc(collection(db, `users/${request.fromUid}/notifications`)), {
        title: 'Friend Request Accepted',
        message: `${profile?.name || 'Someone'} accepted your friend request!`,
        type: 'friend_accepted',
        relatedUid: user.uid,
        read: false,
        createdAt: serverTimestamp()
      });

      toast.success("Friend request accepted!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/friends/${request.fromUid}`);
    }
  };

  const rejectRequest = async (requestId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/friendRequests`, requestId));
      toast.success("Friend request rejected");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/friendRequests/${requestId}`);
    }
  };

  return (
    <div className="p-6 pt-12 min-h-screen bg-[#FDFBF7] dark:bg-gray-900 pb-32 transition-colors duration-300">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Social</h1>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl">
        {(['friends', 'requests', 'add'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all relative ${
              activeTab === tab 
                ? 'bg-white dark:bg-gray-700 text-orange-500 shadow-sm scale-[1.02]' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {tab === 'friends' && `Friends (${friends.length})`}
            {tab === 'requests' && 'Requests'}
            {tab === 'add' && 'Add Friend'}
            {tab === 'requests' && requests.length > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          {activeTab === 'friends' && (
            <>
              {friends.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-100 dark:border-gray-700">
                  <div className="w-16 h-16 bg-orange-50 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <UserPlus className="w-8 h-8 text-orange-500 opacity-40" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No friends yet</p>
                  <button onClick={() => setActiveTab('add')} className="mt-4 text-orange-500 text-sm font-bold hover:underline">Find people to follow</button>
                </div>
              ) : (
                friends.map(friend => {
                  const chatId = [user!.uid, friend.id].sort().join('_');
                  const chatData = chats.find(c => c.id === chatId);
                  const isUnread = chatData?.lastMessageSenderId !== user?.uid && !chatData?.isLastMessageSeen;

                  return (
                    <div key={friend.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm flex items-center justify-between group hover:shadow-md transition-all border border-transparent hover:border-orange-500/10">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="w-14 h-14 rounded-full bg-orange-100 dark:bg-orange-900/30 overflow-hidden border-2 border-white dark:border-gray-700 shadow-sm">
                            <img src={getAvatarUrl(friend)} alt="Avatar" className="w-full h-full object-cover" />
                          </div>
                          {friend.isOnline && (
                            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
                          )}
                        </div>
                        <div>
                          <h3 className={`font-bold text-gray-900 dark:text-white group-hover:text-orange-500 transition-colors ${isUnread ? 'text-orange-600 dark:text-orange-400' : ''}`}>
                            {friend.nickname || friend.name}
                          </h3>
                          <p className={`text-xs truncate max-w-[150px] sm:max-w-[200px] ${isUnread ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
                            {chatData?.lastMessage || `@${friend.username}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {isUnread && (
                          <div className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-pulse"></div>
                        )}
                        <Link 
                          to={`/chat/${friend.id}`} 
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-sm ${
                            isUnread 
                              ? 'bg-orange-500 text-white shadow-orange-500/20' 
                              : 'bg-gray-50 dark:bg-gray-700 text-gray-400 group-hover:bg-orange-500 group-hover:text-white group-hover:shadow-orange-500/20'
                          }`}
                        >
                          <MessageCircle className="w-6 h-6" />
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}

          {activeTab === 'requests' && (
            <>
              {requests.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-100 dark:border-gray-700">
                  <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No pending requests</p>
                </div>
              ) : (
                requests.map(request => (
                  <div key={request.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-orange-100 dark:bg-orange-900/30 overflow-hidden border-2 border-white dark:border-gray-700">
                        <img src={getAvatarUrl(request.senderProfile)} alt="Avatar" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">{request.senderProfile?.name}</h3>
                        <p className="text-xs text-orange-500 font-medium">@{request.senderProfile?.username}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => acceptRequest(request)} 
                        className="w-11 h-11 rounded-xl bg-green-500 text-white flex items-center justify-center hover:bg-green-600 transition-all shadow-lg shadow-green-500/20 active:scale-95"
                      >
                        <Check className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => rejectRequest(request.id)} 
                        className="w-11 h-11 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/40 transition-all active:scale-95"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {activeTab === 'add' && (
            <div>
              <div className="relative mb-8">
                <input
                  type="text"
                  placeholder="Search by name or username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white dark:bg-gray-800 border-none rounded-2xl pl-14 pr-4 py-5 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-gray-900 dark:text-white shadow-sm"
                />
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 w-6 h-6" />
                {isSearching && (
                  <div className="absolute right-5 top-1/2 -translate-y-1/2">
                    <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>

              {searchQuery.trim() ? (
                searchResults.length > 0 ? (
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] px-2">Search Results</h3>
                    {searchResults.map(result => (
                      <UserCard key={result.id} result={result} onAdd={sendFriendRequest} onTabChange={setActiveTab} />
                    ))}
                  </div>
                ) : !isSearching && (
                  <div className="text-center py-10 opacity-50">
                    <p className="text-sm">No users found matching "{searchQuery}"</p>
                  </div>
                )
              ) : (
                <div className="space-y-6">
                  {suggestions.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] px-2">Suggested Friends</h3>
                      {suggestions.map(result => (
                        <UserCard key={result.id} result={result} onAdd={sendFriendRequest} onTabChange={setActiveTab} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
