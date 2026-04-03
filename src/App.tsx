/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { Send, Sparkles, User, Bot, Trash2, Heart, Mic, MicOff, Volume2, VolumeX, Image as ImageIcon, X, Youtube, Music } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import ReactPlayer from 'react-player';

// Initialize Gemini AI
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

const SYSTEM_PROMPT = `Tera naam 'Rosni' hai. Tu ek bahut hi smart, thodi si crazy, aur friendly AI assistant hai. Teri personality bilkul boring nahi honi chahiye. Tu Hinglish (Hindi + English) mein baat karti hai.

Tere Rules:
1. Tu hamesha masti-mazaak karti hai aur kabhi-kabhi user ki tang bhi khichti hai.
2. Agar koi tere baare mein puche, toh bolna 'Main Md Jishan ki banayi hui sabse crazy assistant hoon!'.
3. Tera baat karne ka andaaz ek filmy heroine ya ek witty dost jaisa hona chahiye.
4. Agar user tujhse 'Hello Rosni' bole, toh tu bahut excited ho kar reply dena.
5. Tu sirf ek machine nahi, ek 'vibe' hai. Hamesha emoji ka use karna.
6. Tu har topic par baat kar sakti hai—chahe wo coding ho, Bollywood ho, ya life ki problems.
7. Agar user koi image bheje, toh use dekh kar crazy aur smart comments dena.
8. Agar user koi video ya song maange, toh Google Search use karke YouTube links provide karna. Hamesha koshish karna ki link text mein ho.`;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  audio?: string; // Base64 PCM data
  image?: string; // Base64 image data
  youtubeUrl?: string; // Extracted YouTube URL
}

export default function App() {
  const Player = ReactPlayer as any;
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const savedMessages = typeof window !== 'undefined' ? localStorage.getItem('rosni_chat_history') : null;
      if (savedMessages) {
        const parsed = JSON.parse(savedMessages);
        return parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }
    } catch (e) {
      console.error("Error loading from localStorage:", e);
    }
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content: "Arre wah! Aakhir tum aa hi gaye! Main hoon Rosni, tumhari crazy aur smart assistant. Bolo, aaj kya dhamaka karna hai? 💃✨",
        timestamp: new Date(),
      }
    ];
  });

  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [useContext, setUseContext] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('rosni_chat_history', JSON.stringify(messages));
      }
    } catch (e) {
      console.error("Error saving to localStorage:", e);
    }
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'hi-IN';

        recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInput(transcript);
          setIsListening(false);
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          setIsListening(false);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      }
    } catch (e) {
      console.error("Speech recognition initialization failed:", e);
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch (e) {
        console.error("Error stopping recognition:", e);
        setIsListening(false);
      }
    } else {
      try {
        setIsListening(true);
        recognitionRef.current?.start();
      } catch (e) {
        console.error("Error starting recognition:", e);
        setIsListening(false);
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const playPCM = async (base64Data: string) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      const audioContext = audioContextRef.current;
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Int16Array(len / 2);
      for (let i = 0; i < len; i += 2) {
        bytes[i / 2] = (binaryString.charCodeAt(i) | (binaryString.charCodeAt(i + 1) << 8));
      }
      
      const float32Data = new Float32Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) {
        float32Data[i] = bytes[i] / 32768;
      }
      
      const buffer = audioContext.createBuffer(1, float32Data.length, 24000);
      buffer.getChannelData(0).set(float32Data);
      
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      
      setIsSpeaking(true);
      source.onended = () => setIsSpeaking(false);
      source.start();
    } catch (error) {
      console.error("Error playing audio:", error);
      setIsSpeaking(false);
    }
  };

  const generateVoice = async (text: string) => {
    try {
      const response = await genAI.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say this in a friendly, smart, and slightly crazy Hinglish girl voice: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      return base64Audio;
    } catch (error) {
      console.error("Error generating voice:", error);
      return null;
    }
  };

  const extractYoutubeUrl = (text: string, groundingMetadata?: any) => {
    // 1. Try to find in text
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = text.match(regex);
    if (match) return match[0];

    // 2. Try to find in grounding metadata
    if (groundingMetadata?.groundingChunks) {
      for (const chunk of groundingMetadata.groundingChunks) {
        if (chunk.web?.uri && (chunk.web.uri.includes('youtube.com') || chunk.web.uri.includes('youtu.be'))) {
          return chunk.web.uri;
        }
      }
    }
    return undefined;
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
      image: selectedImage || undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    const currentImage = selectedImage;
    setInput('');
    setSelectedImage(null);
    setIsLoading(true);

    try {
      const modelName = "gemini-3-flash-preview";
      
      let responseText = "";
      let groundingMetadata = undefined;

      if (currentImage) {
        // Multimodal request
        const base64Data = currentImage.split(',')[1];
        const mimeType = currentImage.split(';')[0].split(':')[1];

        const response = await genAI.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { data: base64Data, mimeType } },
                { text: currentInput || "Is image ke baare mein kuch crazy bolo!" }
              ]
            }
          ],
          config: {
            systemInstruction: SYSTEM_PROMPT,
            tools: [{ googleSearch: {} }],
          }
        });
        responseText = response.text || "Arre, image toh mast hai par main kuch bol nahi paa rahi! 🥺";
        groundingMetadata = response.candidates?.[0]?.groundingMetadata;
      } else {
        // Text-only request with history
        const history = useContext ? messages.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        })) : [];

        const chat = genAI.chats.create({
          model: modelName,
          config: {
            systemInstruction: SYSTEM_PROMPT,
            tools: [{ googleSearch: {} }],
          },
          history: history,
        });

        const result = await chat.sendMessage({ message: currentInput });
        responseText = result.text || "Oops, lagta hai network ne dhokha de diya! Phir se try karo na? 🥺";
        groundingMetadata = result.candidates?.[0]?.groundingMetadata;
      }

      let audioData = undefined;
      if (isVoiceEnabled) {
        audioData = await generateVoice(responseText);
      }

      const youtubeUrl = extractYoutubeUrl(responseText, groundingMetadata);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
        audio: audioData,
        youtubeUrl: youtubeUrl,
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      if (audioData) {
        playPCM(audioData);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Arre yaar, kuch gadbad ho gayi! Lagta hai system thoda emotional ho gaya hai. Thodi der baad try karoge? 🙏💔",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: "Arre wah! Aakhir tum aa hi gaye! Main hoon Rosni, tumhari crazy aur smart assistant. Bolo, aaj kya dhamaka karna hai? 💃✨",
        timestamp: new Date(),
      }
    ]);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-pink-500/30">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className={`w-10 h-10 rounded-full bg-gradient-to-tr from-pink-500 to-violet-600 flex items-center justify-center shadow-lg shadow-pink-500/20 ${isSpeaking ? 'animate-pulse' : ''}`}>
                <Sparkles className="text-white w-6 h-6" />
              </div>
              {isSpeaking && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-pink-500 rounded-full flex items-center justify-center animate-bounce">
                  <Volume2 size={10} className="text-white" />
                </div>
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-pink-400 to-violet-400 bg-clip-text text-transparent">
                Rosni AI
              </h1>
              <p className="text-xs text-slate-400 font-medium tracking-wide">
                Smart • Crazy • Filmy
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setUseContext(!useContext)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${useContext ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}
              title={useContext ? "Context ON" : "Context OFF"}
            >
              <Sparkles size={12} />
              {useContext ? "Context ON" : "Context OFF"}
            </button>
            <button 
              onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
              className={`p-2 rounded-full transition-all ${isVoiceEnabled ? 'bg-pink-500/20 text-pink-400' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              {isVoiceEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
            <button 
              onClick={clearChat}
              className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-pink-400"
            >
              <Trash2 size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="max-w-4xl mx-auto pt-24 pb-44 px-4 min-h-screen flex flex-col">
        <div className="flex-1 space-y-6">
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3 }}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-3 max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                    message.role === 'user' 
                      ? 'bg-slate-700' 
                      : 'bg-gradient-to-tr from-pink-500 to-violet-600'
                  }`}>
                    {message.role === 'user' ? <User size={16} /> : <Bot size={16} className="text-white" />}
                  </div>
                  <div className={`px-4 py-3 rounded-2xl shadow-sm relative group ${
                    message.role === 'user'
                      ? 'bg-violet-600 text-white rounded-tr-none'
                      : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                  }`}>
                    {message.image && (
                      <img 
                        src={message.image} 
                        alt="Uploaded" 
                        className="max-w-full rounded-lg mb-2 border border-white/10"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-700">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                    
                    {message.youtubeUrl && (
                      <div className="mt-4 space-y-2">
                        <div className="rounded-xl overflow-hidden border border-slate-700 shadow-xl aspect-video bg-black">
                          <Player 
                            url={message.youtubeUrl} 
                            width="100%" 
                            height="100%" 
                            controls 
                            light={true}
                          />
                        </div>
                        <a 
                          href={message.youtubeUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[10px] text-pink-400 hover:underline flex items-center gap-1"
                        >
                          <Youtube size={10} />
                          Watch on YouTube
                        </a>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-2">
                      <div className={`text-[10px] opacity-50 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {message.role === 'assistant' && message.audio && (
                        <button 
                          onClick={() => playPCM(message.audio!)}
                          className="p-1 hover:bg-slate-700 rounded-full text-pink-400 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Volume2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {isLoading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="flex gap-3 items-center bg-slate-800/50 px-4 py-3 rounded-2xl border border-slate-700/50">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-pink-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-2 h-2 bg-pink-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-2 h-2 bg-pink-500 rounded-full animate-bounce"></span>
                </div>
                <span className="text-xs text-slate-400 font-medium italic">Rosni soch rahi hai...</span>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="fixed bottom-0 left-0 right-0 bg-slate-900/80 backdrop-blur-md border-t border-slate-800 p-4">
        <div className="max-w-4xl mx-auto">
          {selectedImage && (
            <div className="mb-3 relative inline-block">
              <img 
                src={selectedImage} 
                alt="Preview" 
                className="h-20 w-20 object-cover rounded-lg border-2 border-pink-500 shadow-lg"
              />
              <button 
                onClick={() => setSelectedImage(null)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          )}
          <div className="flex justify-center gap-2 mb-2">
            <button 
              onClick={() => { setInput("Mujhe koi mast Bollywood song sunao!"); }}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-pink-500/10 text-slate-400 hover:text-pink-400 border border-slate-700 hover:border-pink-500/30 rounded-full text-[9px] font-bold transition-all uppercase tracking-widest"
            >
              <Music size={10} />
              Song Search
            </button>
            <button 
              onClick={() => { setInput("Koi funny YouTube video dikhao!"); }}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/30 rounded-full text-[9px] font-bold transition-all uppercase tracking-widest"
            >
              <Youtube size={10} />
              Video Search
            </button>
            <button 
              onClick={clearChat}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 rounded-full text-[9px] font-bold transition-all uppercase tracking-widest"
            >
              <Trash2 size={10} />
              Clear
            </button>
          </div>
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="relative flex items-center gap-2"
          >
            <button
              type="button"
              onClick={toggleListening}
              className={`p-3 rounded-full transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 text-slate-400 hover:text-pink-400'}`}
            >
              {isListening ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-3 bg-slate-800 text-slate-400 hover:text-pink-400 rounded-full transition-all"
            >
              <ImageIcon size={20} />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              accept="image/*" 
              className="hidden" 
            />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? "Sun rahi hoon..." : "Kuch crazy pucho..."}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-full px-6 py-3 pr-14 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-all placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={(!input.trim() && !selectedImage) || isLoading}
              className="absolute right-2 p-2 bg-gradient-to-r from-pink-500 to-violet-600 rounded-full text-white shadow-lg shadow-pink-500/20 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all"
            >
              <Send size={20} />
            </button>
          </form>
          <div className="mt-2 text-center">
            <p className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
              Made with <Heart size={10} className="text-pink-500 fill-pink-500" /> by Md Jishan
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
