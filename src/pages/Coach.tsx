import { useState, useEffect, useRef } from 'react';
import { useAuth, getAvatarUrl } from '../App';
import { collection, query, onSnapshot, addDoc, serverTimestamp, orderBy, limit, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Bell, Mic, Send, User, RotateCcw, CloudSun, X, Activity, Plus, MessageSquare, Thermometer, Wind, Droplets, History, Trash2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function Coach() {
  const { user, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionId = searchParams.get('session');
  const { t, i18n } = useTranslation();

  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<{id: number, role: string, text: string, isError?: boolean, userMsg?: string}[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [liveText, setLiveText] = useState('User Experience (UX) design is the process of creating products, systems, or services that offer meaningful, efficient, and enjoyable experiences for users.');
  const [weather, setWeather] = useState<string | null>(null);
  const [weatherData, setWeatherData] = useState<any | null>(null);
  const [showWeatherModal, setShowWeatherModal] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchWeather = async (force = false) => {
    if (!ai) return;
    if (!force) {
      const cachedWeather = localStorage.getItem('neurix_weather');
      const cachedTime = localStorage.getItem('neurix_weather_time');
      const now = new Date().getTime();
      
      // Cache for 4 hours
      if (cachedWeather && cachedTime && (now - parseInt(cachedTime)) < 14400000) {
        setWeather(cachedWeather);
        return;
      }
    }

    const getPosition = (): Promise<GeolocationPosition | null> => {
      return new Promise((resolve) => {
        if (!navigator.geolocation) {
          resolve(null);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos),
          () => resolve(null),
          { timeout: 5000, enableHighAccuracy: true }
        );
      });
    };

    try {
      const pos = await getPosition();
      if (!pos) {
        const errorMsg = 'Location access denied or unavailable.';
        setWeather(errorMsg);
        setWeatherData(null);
        return;
      }
      
      const { latitude, longitude } = pos.coords;
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,apparent_temperature&timezone=auto`
      );
      
      if (!weatherRes.ok) throw new Error('Failed to fetch weather');
      const data = await weatherRes.json();
      const current = data.current;
      
      // Detailed weather formatting
      const weatherText = `It is currently ${current.temperature_2m}Â°C (feels like ${current.apparent_temperature}Â°C) with a wind speed of ${current.wind_speed_10m} km/h and ${current.relative_humidity_2m}% humidity.`;
      
      setWeather(weatherText);
      setWeatherData(current);
      localStorage.setItem('neurix_weather', weatherText);
      localStorage.setItem('neurix_weather_time', new Date().getTime().toString());
    } catch (error: any) {
      console.error("Weather fetch error:", error);
      const errorMsg = error.message || String(error);
      let userFriendlyError = 'Weather unavailable. Please try again.';
      
      if (errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('invalid API key')) {
        userFriendlyError = 'Error: Invalid API Key.';
      } else if (errorMsg.includes('quota') || errorMsg.includes('429')) {
        userFriendlyError = 'Error: API Quota exceeded.';
      }
      
      setWeather(userFriendlyError);
      setWeatherData(null);
    }
  };

  useEffect(() => {
    fetchWeather();
  }, []);
  
  const apiKey = process.env.GEMINI_API_KEY;
  const isPlaceholderKey = apiKey === "MY_GEMINI_API_KEY" || apiKey === "undefined" || !apiKey;
  const ai = !isPlaceholderKey ? new GoogleGenAI({ apiKey: apiKey! }) : null;
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
      setMessages(snapshot.docs.map(doc => ({ id: Date.now() + Math.random(), role: doc.data().role, text: doc.data().text })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/chatSessions/${sessionId}/messages`));

    return () => unsubscribe();
  }, [user, sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (textToSend?: string) => {
    const userMsg = textToSend || inputText;
    if (!userMsg.trim() || !user || !ai) return;
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

    const callWithRetry = async (fn: () => Promise<any>, retries = 2): Promise<any> => {
      try {
        return await fn();
      } catch (err: any) {
        if (retries > 0 && (err.message?.includes('503') || err.message?.includes('high demand') || err.message?.includes('quota'))) {
          await new Promise(r => setTimeout(r, 2000));
          return callWithRetry(fn, retries - 1);
        }
        throw err;
      }
    };

    // Add empty message for streaming
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', text: userMsg }, { id: Date.now() + 1, role: 'model', text: '' }]);

    try {
      const needsSearch = /weather|news|current|today|now|latest|price|stock/i.test(userMsg);
      
      const stream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: userMsg,
        config: {
          systemInstruction: `You are NEURIX, a supportive and intelligent AI life coach.
The current date and time is ${new Date().toLocaleString()}.
User Profile: ${JSON.stringify(profile)}
Current Weather: ${weather || 'Unknown'}
Keep responses concise, motivating, and helpful.
IMPORTANT: You MUST reply in the language the user is using.
If the user says "talk to me in Hindi" or similar, switch to Hindi.
The current year is 2026.`,
          tools: needsSearch ? [{ googleSearch: {} }] : [],
        }
      });
      
      let fullResponse = "";
      for await (const chunk of stream) {
        fullResponse += chunk.text;
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].text = fullResponse;
          return newMessages;
        });
      }
      
      // Save model response
      await addDoc(collection(db, `users/${user.uid}/chatSessions/${currentSessionId}/messages`), {
        role: 'model',
        text: fullResponse,
        createdAt: serverTimestamp()
      });

      // Update session last message
      await updateDoc(doc(db, `users/${user.uid}/chatSessions`, currentSessionId), {
        lastMessage: fullResponse,
        updatedAt: serverTimestamp()
      });

    } catch (error: any) {
      console.error("AI Coach error:", error);
      const errorMsg = error.message || String(error);
      let userFriendlyError = 'Sorry, I encountered an error.';
      
      if (errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('invalid API key')) {
        userFriendlyError = 'Error: Invalid API Key. Please verify your GEMINI_API_KEY in Netlify.';
      } else if (errorMsg.includes('503') || errorMsg.includes('high demand')) {
        userFriendlyError = 'The AI service is currently experiencing high demand. Please try sending your message again in a few seconds.';
      } else if (errorMsg.includes('quota') || errorMsg.includes('429')) {
        userFriendlyError = 'Error: API Quota exceeded. Please try again in a moment.';
      } else if (errorMsg.includes('safety')) {
        userFriendlyError = 'I cannot respond to that due to safety guidelines.';
      } else {
        userFriendlyError = `Error: ${errorMsg.slice(0, 100)}...`;
      }
      
      setMessages(prev => [...prev, { id: Date.now(), role: 'model', text: userFriendlyError, isError: true, userMsg: userMsg }]);
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

  const [transcription, setTranscription] = useState('');
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const nextAudioTimeRef = useRef(0);

  const startLiveSession = async () => {
    if (!ai) {
      toast.error("Gemini API Key is missing. Please check your environment variables.");
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setLiveText('Microphone access is not supported by your browser.');
      return;
    }

    try {
      setLiveText(t('coach.connecting'));
      setTranscription('');
      
      // Create a session for the live chat
      if (user) {
        const sessionRef = await addDoc(collection(db, `users/${user.uid}/chatSessions`), {
          uid: user.uid,
          title: `Voice Session - ${format(new Date(), 'MMM d, HH:mm')}`,
          lastMessage: 'Voice session started...',
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          type: 'voice'
        });
        setLiveSessionId(sessionRef.id);
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsRecording(true); // Only set recording true AFTER permission is granted
      streamRef.current = stream;
      
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      // Use a larger buffer size to reduce main thread pressure
      const processor = audioContextRef.current.createScriptProcessor(8192, 1, 1);
      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      nextAudioTimeRef.current = audioContextRef.current.currentTime;

      const sessionPromise = ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onopen: () => {
            setLiveText(t('coach.listening'));
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcm16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                pcm16[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
              }
              const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
              sessionPromise.then((session) =>
                session.sendRealtimeInput({
                  audio: { data: base64Data, mimeType: 'audio/pcm;rate=24000' }
                })
              );
            };
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle audio output
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && audioContextRef.current) {
              setIsAiSpeaking(true);
              const binary = atob(base64Audio);
              const buffer = new Int16Array(binary.length / 2);
              const view = new DataView(new ArrayBuffer(binary.length));
              for (let i = 0; i < binary.length; i++) {
                view.setUint8(i, binary.charCodeAt(i));
              }
              for (let i = 0; i < buffer.length; i++) {
                buffer[i] = view.getInt16(i * 2, true);
              }

              const audioBuffer = audioContextRef.current.createBuffer(1, buffer.length, 24000);
              const channelData = audioBuffer.getChannelData(0);
              for (let i = 0; i < buffer.length; i++) {
                channelData[i] = buffer[i] / 32768;
              }

              const sourceNode = audioContextRef.current.createBufferSource();
              sourceNode.buffer = audioBuffer;
              sourceNode.connect(audioContextRef.current.destination);
              
              const startTime = Math.max(audioContextRef.current.currentTime, nextAudioTimeRef.current);
              sourceNode.start(startTime);
              nextAudioTimeRef.current = startTime + audioBuffer.duration;
              
              sourceNode.onended = () => {
                if (audioContextRef.current && audioContextRef.current.currentTime >= nextAudioTimeRef.current - 0.1) {
                  setIsAiSpeaking(false);
                }
              };
            }

            // Handle model transcription
            if (message.serverContent?.modelTurn?.parts[0]?.text) {
              const text = message.serverContent.modelTurn.parts[0].text;
              setTranscription(prev => prev + text);
              setLiveText(text);
              
              // Save model transcription to Firestore
              if (user && liveSessionId) {
                addDoc(collection(db, `users/${user.uid}/chatSessions/${liveSessionId}/messages`), {
                  role: 'model',
                  text: text,
                  createdAt: serverTimestamp()
                }).catch(e => console.error("Error saving model voice message", e));
                
                updateDoc(doc(db, `users/${user.uid}/chatSessions`, liveSessionId), {
                  lastMessage: text,
                  updatedAt: serverTimestamp()
                }).catch(e => console.error("Error updating session", e));
              }
            }

            // Handle user transcription
            if (message.serverContent?.inputTranscription?.text) {
              const text = message.serverContent.inputTranscription.text;
              setLiveText(text);
              
              // Save user transcription to Firestore
              if (user && liveSessionId) {
                addDoc(collection(db, `users/${user.uid}/chatSessions/${liveSessionId}/messages`), {
                  role: 'user',
                  text: text,
                  createdAt: serverTimestamp()
                }).catch(e => console.error("Error saving user voice message", e));
              }
            }

            if (message.serverContent?.interrupted) {
              // Stop current playback if interrupted
              nextAudioTimeRef.current = audioContextRef.current?.currentTime || 0;
              setIsAiSpeaking(false);
            }
          },
          onclose: () => {
            stopLiveSession();
          },
          onerror: (err: any) => {
            console.error("Live session error:", err);
            if (err.message?.toLowerCase().includes('permission denied')) {
              setLiveText('Microphone permission denied. Please check your browser settings.');
            }
            stopLiveSession();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
          },
          systemInstruction: `You are NEURIX, a supportive AI life coach. The current date and time is ${new Date().toLocaleString()}. Keep responses concise, motivating, and conversational. You are speaking directly to the user.
IMPORTANT: You MUST reply in the language the user is using. If the user says "talk to me in Hindi" or similar, switch to Hindi.
Current Language: ${i18n.language === 'hi' ? 'Hindi' : 'English'}.`,
        },
      });

      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      console.error("Live session error:", err);
      setIsRecording(false);
      
      let errorMessage = 'Failed to connect to voice assistant.';
      if (err.name === 'NotAllowedError' || err.message?.toLowerCase().includes('permission denied')) {
        errorMessage = 'Microphone permission denied. Please click the lock icon in your browser address bar to allow microphone access.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = 'No microphone found. Please connect a microphone and try again.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage = 'Microphone is already in use by another application.';
      }
      
      setLiveText(errorMessage);
    }
  };

  const stopLiveSession = () => {
    setIsRecording(false);
    setIsAiSpeaking(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopLiveSession();
    };
  }, []);

  if (isPlaceholderKey) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-6 text-center bg-[#FDFBF7] dark:bg-gray-900">
        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mb-6">
          <Activity className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Gemini API Key Missing or Invalid</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md">
          The AI Coach requires a valid Gemini API Key to function. 
          {apiKey === "MY_GEMINI_API_KEY" ? (
            <span> You are currently using the placeholder key from <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">.env.example</code>.</span>
          ) : (
            <span> Please ensure the <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">GEMINI_API_KEY</code> environment variable is set in your Netlify settings.</span>
          )}
        </p>
        <div className="space-y-4 w-full max-w-xs">
          <Link to="/" className="block w-full px-8 py-3 bg-orange-500 text-white rounded-2xl font-bold hover:bg-orange-600 transition-colors">
            Back to Home
          </Link>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest">
            Current Key: <span className="font-mono">{apiKey ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : 'None'}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 pt-12 min-h-screen bg-[#FDFBF7] dark:bg-gray-900 relative pb-32 text-gray-900 dark:text-white transition-colors duration-300">
      <header className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 overflow-hidden border-2 border-white dark:border-gray-800 shadow-sm transition-colors duration-300">
            <img src={getAvatarUrl(profile, user)} alt="Avatar" className="w-full h-full object-cover" />
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
        </div>
      </header>

      {showChat ? (
        <div className="space-y-6 pb-20">
          {messages.map((msg) => (
            <motion.div 
              key={msg.id} 
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`p-5 rounded-3xl max-w-[85%] shadow-sm transition-all duration-300 ${
                msg.role === 'user' 
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-br-lg' 
                  : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-lg border border-gray-100 dark:border-gray-700'
              } ${msg.isError ? 'border-red-200 bg-red-50' : ''}`}>
                <p className="text-sm leading-relaxed">{msg.text}</p>
                <span className={`text-[10px] mt-2 block opacity-50 ${msg.role === 'user' ? 'text-white/70' : 'text-gray-500'}`}>
                  {format(new Date(), 'HH:mm')}
                </span>
                {msg.isError && (
                  <button onClick={() => handleSend(msg.userMsg)} className="flex items-center gap-1 mt-3 text-xs text-red-500 hover:underline font-medium">
                    <RefreshCw className="w-3 h-3" /> Retry
                  </button>
                )}
              </div>
            </motion.div>
          ))}
          {isTyping && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="p-5 rounded-3xl rounded-bl-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" />
                <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce delay-150" />
                <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce delay-300" />
              </div>
            </motion.div>
          )}
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
                onClick={(e) => { e.stopPropagation(); fetchWeather(true); }}
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
                {weatherData ? (
                  <div className="space-y-2">
                    <p><strong>Temperature:</strong> {weatherData.temperature_2m}Â°C</p>
                    <p><strong>Feels Like:</strong> {weatherData.apparent_temperature}Â°C</p>
                    <p><strong>Humidity:</strong> {weatherData.relative_humidity_2m}%</p>
                    <p><strong>Wind Speed:</strong> {weatherData.wind_speed_10m} km/h</p>
                  </div>
                ) : (
                  <p>{weather || 'Loading...'}</p>
                )}
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
      <div className="fixed bottom-24 left-6 right-6 z-40">
        <div className="bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-100 dark:border-gray-700 p-2 flex items-center gap-2 transition-colors duration-300">
          <input 
            type="text" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={t('coach.askChatbot')} 
            className="flex-1 bg-transparent px-5 py-3 outline-none text-sm text-gray-900 dark:text-white placeholder:text-gray-400"
          />
          <button 
            onClick={() => handleSend()}
            className="w-10 h-10 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 flex items-center justify-center hover:bg-gray-800 dark:hover:bg-gray-100 transition-all hover:scale-105 active:scale-95"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </div>
      </div>

      {/* Voice Mode Overlay */}
      <AnimatePresence>
        {isVoiceMode && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col overflow-y-auto bg-[#0a0502] custom-scrollbar"
          >
            {/* Atmospheric Background - Optimized for performance */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <motion.div 
                animate={{ 
                  scale: [1, 1.1, 1],
                  opacity: [0.2, 0.3, 0.2]
                }}
                transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-[10%] -left-[10%] w-[120%] h-[120%] bg-[radial-gradient(circle_at_50%_50%,#3a1510_0%,transparent_60%)] blur-[40px] will-change-transform transform-gpu"
              />
              <motion.div 
                animate={{ 
                  scale: [1.1, 1, 1.1],
                  opacity: [0.15, 0.25, 0.15]
                }}
                transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -bottom-[10%] -right-[10%] w-[120%] h-[120%] bg-[radial-gradient(circle_at_50%_50%,#ff4e00_0%,transparent_60%)] blur-[40px] will-change-transform transform-gpu"
              />
            </div>

            <header className="relative z-10 flex justify-between items-center p-8">
              <button 
                onClick={() => {
                  stopLiveSession();
                  setIsVoiceMode(false);
                }}
                className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="flex flex-col items-center">
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold mb-1">NEURIX LIVE</span>
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${isRecording ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                  <span className="text-xs text-white/60 font-medium">{isRecording ? t('coach.online') : t('coach.offline')}</span>
                </div>
              </div>
              <button className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all">
                <Bell className="w-6 h-6" />
              </button>
            </header>

            <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 text-center overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
              {/* Organic Blob Animation */}
              <div className="relative w-48 h-48 md:w-64 md:h-64 mb-8 md:mb-16 flex-shrink-0">
                <AnimatePresence>
                  {isAiSpeaking && (
                    <motion.div 
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1.2, opacity: 0.4 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      transition={{ duration: 1, repeat: Infinity, repeatType: 'reverse' }}
                      className="absolute inset-0 bg-orange-500/30 rounded-full blur-2xl transform-gpu"
                    />
                  )}
                </AnimatePresence>
                
                <motion.div 
                  animate={{ 
                    scale: isAiSpeaking ? [1, 1.03, 1] : (isRecording ? [1, 1.01, 1] : 1),
                    borderRadius: ["40% 60% 70% 30% / 40% 50% 60% 50%", "50% 50% 50% 50% / 50% 50% 50% 50%"]
                  }}
                  transition={{ 
                    duration: isAiSpeaking ? 1.5 : 4, 
                    repeat: Infinity, 
                    ease: "easeInOut" 
                  }}
                  className="w-full h-full bg-white/10 border border-white/10 shadow-[0_0_30px_rgba(255,255,255,0.05)] flex items-center justify-center will-change-transform transform-gpu"
                  style={{ 
                    boxShadow: 'inset 0 0 20px rgba(255,255,255,0.05)'
                  }}
                >
                  <div className="flex gap-1.5 items-center">
                    {[...Array(5)].map((_, i) => (
                      <motion.div 
                        key={i}
                        animate={{ 
                          height: isAiSpeaking ? [12, 40, 12] : (isRecording ? [12, 24, 12] : 12)
                        }}
                        transition={{ 
                          duration: 0.6, 
                          repeat: Infinity, 
                          delay: i * 0.1,
                          ease: "easeInOut"
                        }}
                        className="w-1 bg-white/80 rounded-full"
                      />
                    ))}
                  </div>
                </motion.div>
              </div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md w-full"
              >
                <p className="text-white/40 text-[10px] uppercase tracking-[0.3em] font-bold mb-4">{isAiSpeaking ? 'NEURIX SPEAKING' : (isRecording ? 'LISTENING' : 'READY')}</p>
                <div className="max-h-[30vh] overflow-y-auto px-4 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                  <h2 className="text-xl md:text-2xl font-serif text-white leading-tight mb-4">
                    {liveText}
                  </h2>
                </div>
                {transcription && (
                  <div className="mt-4 p-4 bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 text-[10px] text-white/40 leading-relaxed text-left max-h-24 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                    {transcription}
                  </div>
                )}
              </motion.div>
            </div>

            <footer className="relative z-10 p-8 pb-12 flex flex-col items-center gap-8">
              <div className="flex justify-center gap-8">
                <button className="w-16 h-16 rounded-full bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all">
                  <Activity className="w-6 h-6" />
                </button>
                <button 
                  onClick={isRecording ? stopLiveSession : startLiveSession}
                  className={`w-20 h-20 rounded-full flex items-center justify-center text-white shadow-2xl transition-all hover:scale-105 active:scale-95 ${isRecording ? 'bg-white/10 border border-white/20' : 'bg-orange-600 shadow-orange-600/20'}`}
                >
                  {isRecording ? (
                    <div className="w-6 h-6 bg-white rounded-sm" />
                  ) : (
                    <Mic className="w-8 h-8" />
                  )}
                </button>
                <button 
                  onClick={() => {
                    stopLiveSession();
                    setIsVoiceMode(false);
                  }}
                  className="w-16 h-16 rounded-full bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <p className="text-[10px] text-white/20 uppercase tracking-[0.2em] font-bold">Tap to {isRecording ? 'stop' : 'start'} session</p>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
