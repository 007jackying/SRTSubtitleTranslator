import React, { useState } from 'react';

interface ApiKeyInputProps {
  onSave: (key: string) => void;
}

export const ApiKeyInput: React.FC<ApiKeyInputProps> = ({ onSave }) => {
  const [key, setKey] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (key.trim()) {
      onSave(key.trim());
    }
  };

  return (
    <div className="w-full max-w-md mx-auto mt-20 p-8 animate-fade-in-up">
      <div className="bg-slate-900 ring-1 ring-slate-800 rounded-xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
        
        <div className="text-center mb-6">
            <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-500/20">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Enter Gemini API Key</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
                To start translating, please provide your Google Gemini API key. It will be stored securely in your browser's local storage.
            </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <input
                    type="password"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white placeholder-slate-600 outline-none transition-all font-mono text-sm"
                    required
                />
            </div>
            <button
                type="submit"
                className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg font-medium transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-95"
            >
                Save API Key
            </button>
        </form>
        <div className="mt-6 text-center">
            <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noreferrer"
                className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline transition-colors"
            >
                Get an API Key from Google AI Studio &rarr;
            </a>
        </div>
      </div>
    </div>
  );
};