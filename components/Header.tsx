import React from 'react';

interface HeaderProps {
  onClearKey?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onClearKey }) => {
  return (
    <header className="w-full py-6 px-8 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
            G
          </div>
          <h1 className="text-xl font-semibold text-slate-100 tracking-tight">
            Gemini <span className="text-indigo-400">SRT Translator</span>
          </h1>
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-400">
          <span className="hidden sm:inline">Powered by Gemini 3 Pro</span>
          {onClearKey && (
            <button 
              onClick={onClearKey}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 bg-slate-800/50 hover:bg-slate-800 hover:text-white rounded-md transition-colors border border-slate-700 hover:border-slate-600"
              title="Clear API Key"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <span>Reset Key</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};