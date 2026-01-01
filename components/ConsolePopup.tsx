import React, { useEffect, useRef } from 'react';

interface ConsolePopupProps {
  logs: string[];
  isOpen: boolean;
  onClose: () => void;
  onClear: () => void;
}

export const ConsolePopup: React.FC<ConsolePopupProps> = ({ logs, isOpen, onClose, onClear }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-fade-in-up">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
        <div className="bg-slate-900 border border-slate-700 rounded-t-xl shadow-2xl flex flex-col max-h-[400px]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-slate-800 rounded-t-xl border-b border-slate-700">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="ml-2 text-xs font-mono text-slate-400 font-bold">Debug Console</span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={onClear}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 hover:bg-slate-700 rounded transition-colors"
              >
                Clear
              </button>
              <button 
                onClick={onClose}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Logs Area */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-950 font-mono text-xs md:text-sm text-slate-300 space-y-2">
            {logs.length === 0 ? (
              <div className="text-slate-600 italic">No errors logged.</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="border-b border-slate-900 pb-1 last:border-0 break-words">
                  <span className="text-red-400 mr-2">❯</span>
                  {log}
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      </div>
    </div>
  );
};