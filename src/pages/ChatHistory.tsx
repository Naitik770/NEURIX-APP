import { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { collection, query, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { ArrowLeft, Trash2, MessageSquare, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

export default function ChatHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/chatSessions`), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSessions(fetched);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/chatSessions`));

    return () => unsubscribe();
  }, [user]);

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/chatSessions`, sessionId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/chatSessions/${sessionId}`);
    }
  };

  return (
    <div className="p-6 pt-12 min-h-screen bg-[#FDFBF7] dark:bg-gray-900 transition-colors duration-300">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors duration-300">Chat History</h1>
      </header>

      <div className="space-y-4">
        {sessions.map((session) => (
          <div 
            key={session.id} 
            onClick={() => navigate(`/coach?session=${session.id}`)}
            className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm flex items-center gap-4 group cursor-pointer hover:shadow-md transition-all duration-300 border border-transparent dark:border-gray-700"
          >
            <div className="w-12 h-12 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-500 transition-colors duration-300">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate transition-colors duration-300">{session.title}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate transition-colors duration-300">{session.lastMessage || 'No messages'}</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 transition-colors duration-300">
                {session.updatedAt?.toDate ? format(session.updatedAt.toDate(), 'MMM d, h:mm a') : 'Just now'}
              </p>
            </div>
            <button 
              onClick={(e) => handleDelete(e, session.id)}
              className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center transition-colors hover:bg-red-100 dark:hover:bg-red-900/40"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600 transition-colors duration-300" />
          </div>
        ))}

        {sessions.length === 0 && (
          <div className="text-center py-12">
            <MessageSquare className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-4 transition-colors duration-300" />
            <p className="text-gray-500 dark:text-gray-400 transition-colors duration-300">No chat history yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
