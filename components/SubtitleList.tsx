import React, { useRef, useEffect, memo } from 'react';
import { SubtitleItem } from '../types';

interface SubtitleListProps {
  items: SubtitleItem[];
  currentId: number;
  onUpdateSubtitle: (id: number, text: string) => void;
}

// Separate component for individual row to optimize rendering
const SubtitleRow = memo(({ item, isCurrent, onUpdate }: { 
  item: SubtitleItem, 
  isCurrent: boolean, 
  onUpdate: (id: number, text: string) => void 
}) => {
  const isDone = item.translatedText !== undefined;

  // Calculate rows based on newlines to roughly auto-expand
  const calculateRows = (text: string | undefined) => {
    if (!text) return 1;
    return Math.max(1, text.split('\n').length);
  };

  return (
    <div 
        id={`sub-${item.id}`}
        className={`grid grid-cols-12 p-4 text-sm border-b border-slate-800/50 transition-colors duration-300 ${isCurrent ? 'bg-indigo-900/20 border-l-2 border-l-indigo-500' : 'hover:bg-slate-800/30'}`}
    >
      <div className="col-span-1 text-slate-500 font-mono">{item.id}</div>
      <div className="col-span-2 text-slate-500 font-mono text-xs flex flex-col justify-center">
        <span>{item.startTime}</span>
        <span className="opacity-50">↓</span>
        <span>{item.endTime}</span>
      </div>
      <div className="col-span-4 md:col-span-4 text-slate-300 pr-2 whitespace-pre-wrap leading-relaxed select-text">
        {item.originalText}
      </div>
      <div className="col-span-5 md:col-span-5 relative">
        {isDone ? (
             <textarea
                className="w-full h-full bg-transparent text-indigo-200 resize-none focus:outline-none focus:bg-slate-800/50 focus:ring-1 focus:ring-indigo-500/50 rounded px-2 py-1 transition-all leading-relaxed"
                value={item.translatedText || ''}
                onChange={(e) => onUpdate(item.id, e.target.value)}
                rows={calculateRows(item.translatedText || item.originalText)}
                placeholder="Translation..."
                spellCheck={false}
             />
        ) : (
             <div className={`whitespace-pre-wrap transition-opacity duration-500 ${isCurrent ? 'text-slate-600 opacity-50 italic animate-pulse' : 'text-slate-700 opacity-30 italic'}`}>
                {isCurrent ? 'Translating...' : 'Pending'}
             </div>
        )}
      </div>
    </div>
  );
}, (prev, next) => {
    // Custom comparison to prevent re-renders unless data changes
    return (
        prev.item.translatedText === next.item.translatedText && 
        prev.item.originalText === next.item.originalText &&
        prev.isCurrent === next.isCurrent
    );
});

export const SubtitleList: React.FC<SubtitleListProps> = ({ items, currentId, onUpdateSubtitle }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to keep processing item in view
  useEffect(() => {
    if (scrollRef.current) {
        // find element
        const element = document.getElementById(`sub-${currentId}`);
        if(element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
  }, [currentId]);

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-[600px]">
      <div className="grid grid-cols-12 bg-slate-800/50 p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700 z-10">
        <div className="col-span-1">#</div>
        <div className="col-span-2">Time</div>
        <div className="col-span-4 md:col-span-4">Japanese (Original)</div>
        <div className="col-span-5 md:col-span-5">Chinese (Editable)</div>
      </div>
      
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-0 scroll-smooth">
        {items.map((item) => (
            <SubtitleRow 
                key={item.id} 
                item={item} 
                isCurrent={item.id === currentId}
                onUpdate={onUpdateSubtitle}
            />
        ))}
        {items.length === 0 && (
             <div className="p-8 text-center text-slate-500">No subtitles loaded.</div>
        )}
      </div>
    </div>
  );
};