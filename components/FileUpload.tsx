import React, { useRef } from 'react';
import { LanguageSelector } from './LanguageSelector';

interface FileUploadProps {
  onFileSelect: (files: File[]) => void;
  targetLanguage: string;
  onLanguageChange: (lang: string) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, targetLanguage, onLanguageChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(Array.from(e.target.files));
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-10 p-8">
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative bg-slate-900 ring-1 ring-slate-800 rounded-xl p-12 flex flex-col items-center justify-center text-center space-y-6">
          
          <div 
            className="cursor-pointer flex flex-col items-center space-y-4 w-full"
            onClick={() => inputRef.current?.click()}
          >
            <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
            </div>
            <div>
                <h3 className="text-xl font-medium text-slate-200">Upload SRT Files</h3>
                <p className="text-slate-500 text-sm max-w-xs mt-2">
                    Select multiple .srt files to automatically translate them concurrently.
                </p>
            </div>
          </div>

          <div className="w-full max-w-xs border-t border-slate-800 pt-6">
            <LanguageSelector 
                value={targetLanguage} 
                onChange={onLanguageChange} 
                className="mb-4"
            />
            <button 
                onClick={() => inputRef.current?.click()}
                className="w-full px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-sm transition-colors shadow-lg shadow-indigo-500/20"
            >
                Select Files
            </button>
          </div>

          <input 
            type="file" 
            ref={inputRef} 
            onChange={handleChange} 
            accept=".srt" 
            className="hidden" 
            multiple
          />
        </div>
      </div>
    </div>
  );
};