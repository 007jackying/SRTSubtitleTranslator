import React from 'react';

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const MODELS = [
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (Best Quality)' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Fast)' },
];

export const ModelSelector: React.FC<ModelSelectorProps> = ({ value, onChange, className = '' }) => {
  return (
    <div className={`relative ${className}`}>
      <label className="block text-xs font-medium text-slate-400 mb-1 ml-1">AI Model</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none w-full bg-slate-950 border border-slate-700 text-slate-200 py-2 pl-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm cursor-pointer hover:bg-slate-900 transition-colors"
      >
        {MODELS.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 top-6 flex items-center px-2 text-slate-400">
        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
          <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
        </svg>
      </div>
    </div>
  );
};