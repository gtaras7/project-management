import React, { useState, useRef, useEffect } from 'react';
import { PHPDatabaseConfig, Project, Task } from '../types';
import { MessageSquare, Loader, CornerDownLeft, Sparkles, BookOpen, User, HelpCircle, AlertCircle } from 'lucide-react';

interface GeminiAssistantProps {
  dbConfig: PHPDatabaseConfig;
  projectsCount: number;
  tasksCount: number;
}

export default function GeminiAssistant({ dbConfig, projectsCount, tasksCount }: GeminiAssistantProps) {
  const [messages, setMessages] = useState<{ sender: 'user' | 'bot'; text: string }[]>([
    {
      sender: 'bot',
      text: "👋 Hi! I am your AI PHP Class Assistant. Need help writing PDO prepared parameters, connecting your dashboard to a local XAMPP/MAMP server, or writing MySQL tables? Ask me anything or select one of the core academic helper topics below!"
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const consoleEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendPrompt = async (promptText: string) => {
    if (!promptText.trim() || isLoading) return;

    // Append user message
    const userMessage = promptText.trim();
    setMessages((prev) => [...prev, { sender: 'user', text: userMessage }]);
    setInputText('');
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/chat-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          textInput: userMessage,
          dbConfig,
          projectsCount,
          tasksCount,
        }),
      });

      if (!res.ok) {
        const errObj = await res.json().catch(() => ({}));
        throw new Error(errObj.error || `HTTP error ${res.status}`);
      }

      const data = await res.json();
      setMessages((prev) => [...prev, { sender: 'bot', text: data.answer || "I parsed an empty text response. Try asking me something else!" }]);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'An error occurred while contacting the AI server.');
      setMessages((prev) => [
        ...prev,
        { 
          sender: 'bot', 
          text: `⚠️ **Connection Failure**: I'm unable to reach the assistant server. Please ensure your dev server is active and the database variables are set appropriately.` 
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    handleSendPrompt(inputText);
  };

  const academicTopics = [
    {
      label: 'SQL Injection Defense',
      prompt: 'Explain how PDO prepared statements prevent SQL Injection vulnerability, and show a code comparison of a vulnerable query vs a secure query in PHP.'
    },
    {
      label: 'XAMPP CORS Solver',
      prompt: 'How do I solve \"Access-Control-Allow-Origin\" CORS errors when running my React frontend on port 3000 and my PHP backend API script in XAMPP on port 80?'
    },
    {
      label: 'Write Input Sanitizer',
      prompt: 'Show me an industry standard input sanitization function in PHP that wraps htmlspecialchars and filter_var to keep MySQL forms safe.'
    },
    {
      label: 'Validate Password Hash',
      prompt: 'Explain the password_hash() and password_verify() methods in PHP for storing credentials, and show sample register and login PHP snippets.'
    }
  ];

  return (
    <div id="ai-assistant-panel" className="bg-white rounded-xl shadow-sm border border-slate-150 p-6 flex flex-col h-[520px]">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
        <div>
          <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
            <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
            PHP Assistant Academic Tutor
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Powered by Gemini to answer complex database, syntax & course assignment questions.
          </p>
        </div>
        <BookOpen className="w-4 h-4 text-slate-400" />
      </div>

      {/* Messages Scrollbox */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 min-h-0 select-text">
        {messages.map((msg, index) => (
          <div
            id={`chat-msg-${index}`}
            key={index}
            className={`flex gap-2.5 items-start ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.sender === 'bot' && (
              <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 mt-0.5 text-indigo-600 font-bold text-[10px]">
                AI
              </div>
            )}
            <div
              className={`rounded-xl p-3 text-xs max-w-[85%] leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-slate-900 text-white font-medium self-end rounded-tr-none'
                  : 'bg-slate-50 text-slate-800 border border-slate-100 self-start rounded-tl-none whitespace-pre-wrap'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-2.5 items-center text-slate-500 text-xs italic pl-8">
            <Loader className="w-3.5 h-3.5 animate-spin text-indigo-600" />
            Analyzing code patterns...
          </div>
        )}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-100 p-2.5 rounded-lg text-rose-700 text-[11px] flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        <div ref={consoleEndRef} />
      </div>

      {/* Recommended Topics Row */}
      <div className="shrink-0 mb-3 space-y-1.5">
        <span className="text-[9px] uppercase font-bold tracking-wider text-slate-500 block">Click Academic Helper Cards:</span>
        <div className="flex gap-2 overflow-x-auto pb-1 max-w-full">
          {academicTopics.map((topic, i) => (
            <button
              id={`hot-topic-${i}`}
              key={i}
              onClick={() => handleSendPrompt(topic.prompt)}
              disabled={isLoading}
              className="text-[10px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2.5 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors shrink-0 text-left cursor-pointer"
            >
              {topic.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input query form */}
      <form onSubmit={handleFormSubmit} className="flex gap-2 shrink-0 border-t border-slate-100 pt-3">
        <input
          id="assistant-prompt-input"
          type="text"
          placeholder="Ask a question about database connectivity, PHP, PDO..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={isLoading}
          className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
        />
        <button
          id="submit-prompt-btn"
          type="submit"
          disabled={isLoading || !inputText.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg px-3.5 flex items-center justify-center transition-colors"
        >
          <CornerDownLeft className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
