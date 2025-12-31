import React from 'react';

interface LanguageSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const LANGUAGES = [
  "Simplified Chinese",
  "Traditional Chinese",
  "English",
  "Japanese",
  "Korean",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Russian",
  "Portuguese",
  "Vietnamese",
  "Thai",
  "Indonesian"
];

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ value, onChange, className = '' }) => {
  return (
    <div className={`relative ${className}`}>
      <label className="block text-xs font-medium text-slate-400 mb-1 ml-1">Target Language</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none w-full bg-slate-950 border border-slate-700 text-slate-200 py-2 pl-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm cursor-pointer hover:bg-slate-900 transition-colors"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang} value={lang}>
            {lang}
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