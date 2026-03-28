import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { collection, query, onSnapshot, addDoc, serverTimestamp, orderBy, limit, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Bell, Search, Mic, Send, User, RotateCcw, CloudSun, X, Activity, Plus, MessageSquare, Thermometer, Wind, Droplets, History, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function Coach() {
  const { user, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionId = searchParams.get('session');
  const { t, i18n } = useTranslation();

  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<{role: string, text: string}[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [liveText, setLiveText] = useState('User Experience (UX) design is the process of creating products, systems, or services that offer meaningful, efficient, and enjoyable experiences for users.');
  const [weather, setWeather] = useState<string | null>(null);
  const [showWeatherModal, setShowWeatherModal] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchWeather = async () => {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Today is ${new Date().toLocaleString()}. What is the weather like in my current location? Provide a detailed report including temperatures, conditions, and a summary table if applicable. Start with a very short 1-sentence summary first.`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });
      setWeather(response.text || 'Weather unavailable');
    } catch (error) {
      console.error(error);
      setWeather('Weather unavailable');
    }
  };

  useEffect(() => {
    fetchWeather();
  }, []);
  
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Fetch recent sessions (limit 2)
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/chatSessions`), orderBy('updatedAt', 'desc'), limit(2));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecentSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/chatSessions`));
    return () => unsubscribe();
  }, [user]);

  // Load messages if sessionId is present
  useEffect(() => {
    if (!user || !sessionId) {
      setMessages([]);
      setShowChat(false);
      return;
    }

    setShowChat(true);
    const q = query(collection(db, `users/${user.uid}/chatSessions/${sessionId}/messages`), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ role: doc.data().role, text: doc.data().text })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/chatSessions/${sessionId}/messages`));

    return () => unsubscribe();
  }, [user, sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || !user) return;
    const userMsg = inputText;
    setInputText('');
    
    let currentSessionId = sessionId;
    
    // Create new session if none exists
    if (!currentSessionId) {
      try {
        const sessionRef = await addDoc(collection(db, `users/${user.uid}/chatSessions`), {
          uid: user.uid,
          title: userMsg.slice(0, 50) + (userMsg.length > 50 ? '...' : ''),
          lastMessage: userMsg,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        });
        currentSessionId = sessionRef.id;
        setSearchParams({ session: currentSessionId });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/chatSessions`);
        return;
      }
    } else {
      // Update existing session
      try {
        await updateDoc(doc(db, `users/${user.uid}/chatSessions`, currentSessionId), {
          lastMessage: userMsg,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        console.error("Failed to update session", error);
      }
    }

    // Save user message
    try {
      await addDoc(collection(db, `users/${user.uid}/chatSessions/${currentSessionId}/messages`), {
        role: 'user',
        text: userMsg,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/chatSessions/${currentSessionId}/messages`);
    }

    setIsTyping(true);
    setShowChat(true);

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userMsg,
        config: {
          systemInstruction: `You are NEURIX, a supportive and intelligent AI life coach. The current date and time is ${new Date().toLocaleString()}. Keep responses concise, motivating, and helpful. Always use Google Search for up-to-date information on current events, news, or real-time data. IMPORTANT: You MUST reply in the following language: ${i18n.language === 'hi' ? 'Hindi' : 'English'}.`,
          tools: [{ googleSearch: {} }],
        }
      });
      
      const modelText = response.text || 'I am here to help.';
      
      // Save model response
      await addDoc(collection(db, `users/${user.uid}/chatSessions/${currentSessionId}/messages`), {
        role: 'model',
        text: modelText,
        createdAt: serverTimestamp()
      });

      // Update session last message
      await updateDoc(doc(db, `users/${user.uid}/chatSessions`, currentSessionId), {
        lastMessage: modelText,
        updatedAt: serverTimestamp()
      });

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: 'Sorry, I encountered an error.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/chatSessions`, id));
      if (sessionId === id) {
        setSearchParams({});
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/chatSessions/${id}`);
    }
  };

  const startLiveSession = async () => {
    try {
      setIsRecording(true);
      setLiveText('Listening...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      const sessionPromise = ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onopen: () => {
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcm16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                pcm16[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
              }
              const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
              sessionPromise.then((session) =>
                session.sendRealtimeInput({
                  audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                })
              );
            };
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && audioContextRef.current) {
              const binary = atob(base64Audio);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
              }
              try {
                const audioBuffer = await audioContextRef.current.decodeAudioData(bytes.buffer);
                const sourceNode = audioContextRef.current.createBufferSource();
                sourceNode.buffer = audioBuffer;
                sourceNode.connect(audioContextRef.current.destination);
                sourceNode.start();
              } catch (e) {
                console.error("Audio decode error", e);
              }
            }
            if (message.serverContent?.modelTurn?.parts[0]?.text) {
              setLiveText(message.serverContent.modelTurn.parts[0].text);
            }
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: `You are NEURIX, a supportive AI life coach. The current date and time is ${new Date().toLocaleString()}. Keep responses concise and motivating. Use up-to-date information. IMPORTANT: You MUST reply in the following language: ${i18n.language === 'hi' ? 'Hindi' : 'English'}.`,
        },
      });

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error("Live session error:", err);
      setIsRecording(false);
      setLiveText('Failed to connect to voice assistant.');
    }
  };

  const stopLiveSession = () => {
    setIsRecording(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (sessionRef.current) {
      sessionRef.current.close();
    }
  };

  useEffect(() => {
    return () => {
      stopLiveSession();
    };
  }, []);

  return (
    <div className="p-6 pt-12 min-h-screen bg-[#FDFBF7] dark:bg-gray-900 relative pb-32 text-gray-900 dark:text-white transition-colors duration-300">
      <header className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 overflow-hidden border-2 border-white dark:border-gray-800 shadow-sm transition-colors duration-300">
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.avatarSeed || profile?.uid}`} alt="Avatar" className="w-full h-full object-cover" />
          </div>
          <span className="font-medium text-gray-900 dark:text-white">{profile?.name || 'User'}</span>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setSearchParams({})}
            className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            <Search className="w-5 h-5" />
          </button>
        </div>
      </header>

      {showChat ? (
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`p-4 rounded-2xl ${msg.role === 'user' ? 'bg-orange-500 text-white ml-auto' : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'} max-w-[80%] transition-colors duration-300`}>
              {msg.text}
            </div>
          ))}
          {isTyping && <div className="p-4 rounded-2xl bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 shadow-sm transition-colors duration-300">{t('coach.thinking')}</div>}
          <div ref={messagesEndRef} />
        </div>
      ) : (
        <>
          <h1 className="text-4xl font-serif text-gray-900 dark:text-white mb-8 leading-tight transition-colors duration-300">
            {t('coach.title')} <br />
            <span className="italic font-light text-orange-500">{t('coach.subtitle')}</span> {t('coach.forEveryNeed')}
          </h1>

          {/* Voice Chat Card */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 mb-4 relative overflow-hidden text-gray-900 dark:text-white shadow-xl border border-transparent dark:border-gray-700 transition-colors duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center transition-colors duration-300">
                <div className="w-2 h-2 rounded-full bg-green-400" />
              </div>
              <span className="font-medium">{t('coach.voiceChat')}</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed max-w-[280px]">
              {t('coach.voiceDesc')}
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-50 dark:bg-gray-700 rounded-full px-4 py-3 text-sm text-gray-500 dark:text-gray-400 transition-colors duration-300">
                {t('coach.askChatbot')}
              </div>
              <button 
                onClick={() => setIsVoiceMode(true)}
                className="w-12 h-12 rounded-full bg-gray-50 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <Mic className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Grid Cards */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-transparent dark:border-gray-700 transition-colors duration-300">
              <div className="w-8 h-8 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center mb-4 text-orange-600 transition-colors duration-300">
                <User className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{t('coach.quickAccess')}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{t('coach.quickDesc')}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-transparent dark:border-gray-700 transition-colors duration-300">
              <div className="w-8 h-8 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center mb-4 text-orange-800 dark:text-orange-400 transition-colors duration-300">
                <RotateCcw className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{t('coach.recentChats')}</h3>
              <div className="space-y-2">
                {recentSessions.map((session) => (
                  <div key={session.id} className="flex items-center gap-1 group">
                    <button 
                      onClick={() => setSearchParams({ session: session.id })}
                      className="flex-1 text-left bg-gray-50 dark:bg-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors truncate"
                    >
                      {session.title}
                    </button>
                    <button 
                      onClick={(e) => handleDeleteSession(e, session.id)}
                      className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 transition-opacity hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/50 dark:hover:text-red-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <Link 
                  to="/chat-history"
                  className="flex items-center gap-1 text-[10px] font-bold text-orange-800 dark:text-orange-400 mt-2 hover:underline transition-colors duration-300"
                >
                  <History className="w-3 h-3" />
                  {t('coach.showAllHistory')}
                </Link>
              </div>
            </div>
          </div>

          {/* Weather Card */}
          <div 
            onClick={() => setShowWeatherModal(true)}
            className="w-full bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left cursor-pointer border border-transparent dark:border-gray-700"
          >
            <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-500 transition-colors duration-300">
              <CloudSun className="w-5 h-5" />
            </div>
            <div className="flex-1 overflow-hidden">
              <h3 className="font-semibold text-gray-900 dark:text-white">{t('coach.weatherUpdates')}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {weather ? weather.split('\n')[0] : t('coach.checkingForecast')}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button 
                onClick={(e) => { e.stopPropagation(); fetchWeather(); }}
                className="p-2 rounded-full bg-gray-50 dark:bg-gray-700 text-orange-600 dark:text-orange-400 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
              <div className="text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-full text-center transition-colors duration-300">
                {t('coach.details')}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Weather Modal */}
      <AnimatePresence>
        {showWeatherModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowWeatherModal(false)}
          >
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-t-[40px] sm:rounded-[40px] p-8 max-h-[85vh] overflow-y-auto relative shadow-2xl transition-colors duration-300"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-500 transition-colors duration-300">
                    <CloudSun className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('coach.localForecast')}</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('coach.poweredBy')}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowWeatherModal(false)}
                  className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="prose prose-sm prose-orange max-w-none text-gray-800 dark:text-gray-200">
                <div className="weather-report">
                  <ReactMarkdown>{weather || 'Loading...'}</ReactMarkdown>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-3 gap-3">
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-3xl text-center transition-colors duration-300">
                  <Droplets className="w-5 h-5 text-blue-500 mx-auto mb-2" />
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase">{t('coach.humidity')}</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">High</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-3xl text-center transition-colors duration-300">
                  <Thermometer className="w-5 h-5 text-orange-500 mx-auto mb-2" />
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase">{t('coach.temp')}</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Variable</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-3xl text-center transition-colors duration-300">
                  <Wind className="w-5 h-5 text-green-500 mx-auto mb-2" />
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase">{t('coach.wind')}</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Active</p>
                </div>
              </div>

              <button 
                onClick={() => setShowWeatherModal(false)}
                className="w-full mt-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-bold hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
              >
                {t('coach.gotIt')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Input Area (Fixed Bottom) */}
      <div className="fixed bottom-24 left-6 right-6 bg-white dark:bg-gray-800 rounded-full shadow-lg p-2 flex items-center gap-3 z-40 border border-transparent dark:border-gray-700 transition-colors duration-300">
        <input 
          type="text" 
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={t('coach.askChatbot')} 
          className="flex-1 bg-transparent px-4 py-2 outline-none text-sm text-gray-900 dark:text-white placeholder:text-gray-400"
        />
        <button 
          onClick={handleSend}
          className="w-10 h-10 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 flex items-center justify-center hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
        >
          <Send className="w-4 h-4 ml-1" />
        </button>
      </div>

      {/* Voice Mode Overlay */}
      <AnimatePresence>
        {isVoiceMode && (
          <motion.div 
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-gradient-to-b from-[#FFEFE5] to-[#FFD6C4] z-50 flex flex-col p-6"
          >
            <header className="flex justify-between items-center mb-12 pt-6">
              <button 
                onClick={() => setIsVoiceMode(false)}
                className="w-10 h-10 rounded-full bg-white/50 flex items-center justify-center text-gray-800 hover:bg-white/80 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <button className="w-10 h-10 rounded-full bg-white/50 flex items-center justify-center text-gray-800 hover:bg-white/80 transition-colors">
                <Bell className="w-5 h-5" />
              </button>
            </header>

            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <p className="text-gray-600 font-medium mb-12">{t('coach.goAhead')}</p>
              
              {/* Silver Blob Animation */}
              <motion.div 
                animate={{ 
                  scale: isRecording ? [1, 1.1, 0.9, 1.05, 1] : 1,
                  rotate: isRecording ? [0, 5, -5, 2, 0] : 0,
                  borderRadius: isRecording ? ["40%", "50%", "30%", "60%", "40%"] : "50%"
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="w-48 h-48 bg-gradient-to-br from-gray-200 via-gray-400 to-gray-600 shadow-2xl mb-16"
                style={{ 
                  boxShadow: 'inset 20px 20px 40px rgba(255,255,255,0.5), inset -20px -20px 40px rgba(0,0,0,0.2), 0 20px 40px rgba(0,0,0,0.1)' 
                }}
              />

              <div className="bg-white/40 backdrop-blur-md rounded-3xl p-6 text-sm text-gray-800 leading-relaxed text-left shadow-lg border border-white/50 max-w-sm">
                {liveText}
              </div>
            </div>

            <div className="flex justify-center gap-6 pb-8">
              <button className="w-14 h-14 rounded-full bg-white/50 flex items-center justify-center text-gray-800 hover:bg-white/80 transition-colors shadow-sm">
                <Activity className="w-6 h-6" />
              </button>
              <button 
                onClick={isRecording ? stopLiveSession : startLiveSession}
                className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-xl transition-transform hover:scale-105 ${isRecording ? 'bg-red-500 shadow-red-500/20' : 'bg-gray-900 shadow-gray-900/20'}`}
              >
                <Mic className="w-6 h-6" />
              </button>
              <button 
                onClick={() => {
                  stopLiveSession();
                  setIsVoiceMode(false);
                }}
                className="w-14 h-14 rounded-full bg-white/50 flex items-center justify-center text-gray-800 hover:bg-white/80 transition-colors shadow-sm"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
