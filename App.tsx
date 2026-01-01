import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { JobCard } from './components/JobCard';
import { ApiKeyInput } from './components/ApiKeyInput';
import { ConsolePopup } from './components/ConsolePopup';
import { parseSRT } from './utils/srtParser';
import { translateBatch } from './services/geminiService';
import { SubtitleItem, FileJob, JobStatus } from './types';

const BATCH_SIZE = 15;

function App() {
  const [job, setJob] = useState<FileJob | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState<string>('Simplified Chinese');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3-pro-preview');
  
  // Console State
  const [logs, setLogs] = useState<string[]>([]);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  
  const stopRef = useRef(false);

  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) {
      setApiKey(storedKey);
    }
  }, []);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev]);
    setIsConsoleOpen(true); // Auto-open on error
  };

  const handleSaveKey = (key: string) => {
    localStorage.setItem('gemini_api_key', key);
    setApiKey(key);
  };

  const handleClearKey = () => {
    localStorage.removeItem('gemini_api_key');
    setApiKey(null);
    setJob(null);
    setLogs([]);
  };

  const handleFileSelect = (file: File) => {
    stopRef.current = false;
    setLogs([]); // Clear logs for new run
    const newJob: FileJob = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      filename: file.name.replace('.srt', ''),
      status: JobStatus.PENDING,
      subtitles: [],
      progress: 0,
      currentLineId: 0,
      targetLanguage: targetLanguage,
      model: selectedModel
    };

    setJob(newJob);
    startJob(newJob);
  };

  const handleRemoveJob = () => {
    stopRef.current = true;
    setJob(null);
  };

  const handleUpdateSubtitle = useCallback((jobId: string, subId: number, text: string) => {
    setJob(prev => {
      if (prev && prev.id === jobId) {
        return {
          ...prev,
          subtitles: prev.subtitles.map(sub => 
            sub.id === subId ? { ...sub, translatedText: text } : sub
          )
        };
      }
      return prev;
    });
  }, []);

  const handleStop = () => {
    stopRef.current = true;
    updateJobState({ status: JobStatus.STOPPED });
    addLog('User stopped the process.');
  };

  const updateJobState = (updates: Partial<FileJob>) => {
    setJob(prev => prev ? { ...prev, ...updates } : null);
  };

  const startJob = async (currentJob: FileJob) => {
    const key = localStorage.getItem('gemini_api_key');
    if (!key) {
        addLog('Missing API Key.');
        return;
    }

    // 1. Parsing Phase
    updateJobState({ status: JobStatus.PARSING });
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      if (stopRef.current) {
          updateJobState({ status: JobStatus.STOPPED });
          return;
      }

      const content = e.target?.result as string;
      if (content) {
        try {
            const parsed = parseSRT(content);
            if (parsed.length === 0) {
                throw new Error("Parsed SRT has 0 subtitles.");
            }
            updateJobState({ 
                status: JobStatus.TRANSLATING, 
                subtitles: parsed 
            });
            
            // 2. Translating Phase
            await processTranslationLoop(currentJob.id, parsed, key, currentJob.targetLanguage, currentJob.model);
        } catch (parseError: any) {
            updateJobState({ status: JobStatus.ERROR, error: 'File parsing failed' });
            addLog(`Parsing Error: ${parseError.message || parseError}`);
        }
      } else {
        updateJobState({ status: JobStatus.ERROR, error: 'Empty file' });
        addLog('Error: Uploaded file is empty.');
      }
    };
    reader.onerror = () => {
        updateJobState({ status: JobStatus.ERROR, error: 'Failed to read file' });
        addLog('FileReader Error: Failed to read the file content.');
    };
    reader.readAsText(currentJob.file);
  };

  const processTranslationLoop = async (jobId: string, items: SubtitleItem[], apiKey: string, lang: string, model: string) => {
    let processedCount = 0;
    const total = items.length;
    const localItems = [...items];

    if (total === 0) {
        updateJobState({ status: JobStatus.COMPLETED, progress: 100 });
        return;
    }

    for (let i = 0; i < total; i += BATCH_SIZE) {
      if (stopRef.current) {
        updateJobState({ status: JobStatus.STOPPED });
        break;
      }

      const batchEnd = Math.min(i + BATCH_SIZE, total);
      const batch = localItems.slice(i, batchEnd);
      
      updateJobState({ currentLineId: batch[0].id });

      const textsToTranslate = batch.map(b => b.originalText);
      
      try {
        const translations = await translateBatch(textsToTranslate, apiKey, lang, model);
        
        for (let j = 0; j < batch.length; j++) {
           const originalIndex = i + j;
           const transText = translations[j] || batch[j].originalText; 
           localItems[originalIndex] = {
             ...localItems[originalIndex],
             translatedText: transText
           };
        }

        processedCount += batch.length;
        const progress = (processedCount / total) * 100;

        setJob(prev => {
            if (prev && prev.id === jobId) {
                return { 
                    ...prev, 
                    subtitles: [...localItems],
                    progress: progress
                };
            }
            return prev;
        });

      } catch (err: any) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`Batch failed for job ${jobId}`, err);
        
        // Log to Console Popup
        addLog(`Request Failed [Lines ${batch[0].id}-${batch[batch.length-1].id}]: ${errorMsg}`);
        
        // Update Job Status to ERROR to stop spinners
        updateJobState({ status: JobStatus.ERROR, error: errorMsg });
        
        // Stop the loop on API error
        stopRef.current = true;
        break;
      }
    }

    if (!stopRef.current && job?.status !== JobStatus.ERROR) {
        updateJobState({ status: JobStatus.COMPLETED, progress: 100 });
    }
  };

  const isProcessing = job?.status === JobStatus.TRANSLATING || job?.status === JobStatus.PARSING || job?.status === JobStatus.PENDING;

  return (
    <div className="min-h-screen flex flex-col pb-20"> {/* pb-20 for bottom space if console is open */}
      <Header onClearKey={apiKey ? handleClearKey : undefined} />
      
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!apiKey ? (
          <ApiKeyInput onSave={handleSaveKey} />
        ) : (
          <>
            {!job ? (
              <div className="flex flex-col items-center justify-center h-[70vh]">
                <div className="text-center mb-12">
                  <h2 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 mb-6">
                    SRT Translator
                  </h2>
                  <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
                    Translate SRT files automatically. 
                    <br/>
                    <span className="text-indigo-400">Auto-detects source</span> language.
                  </p>
                </div>
                <FileUpload 
                  onFileSelect={handleFileSelect} 
                  targetLanguage={targetLanguage}
                  onLanguageChange={setTargetLanguage}
                  selectedModel={selectedModel}
                  onModelChange={setSelectedModel}
                />
                
                {/* Console Toggle for Idle State if there are logs from previous run */}
                {logs.length > 0 && (
                   <button 
                     onClick={() => setIsConsoleOpen(true)}
                     className="mt-8 text-sm text-slate-500 hover:text-slate-300 underline"
                   >
                     View Previous Logs
                   </button>
                )}
              </div>
            ) : (
              <div className="space-y-8 animate-fade-in-up">
                
                {/* Dashboard Controls */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                    <div>
                        <h2 className="text-xl font-bold text-white">Translation</h2>
                        <div className="flex items-center gap-2">
                            <p className="text-sm text-slate-400">
                                {job.status === JobStatus.COMPLETED ? 'Completed' : job.status === JobStatus.ERROR ? 'Failed' : 'Processing...'}
                            </p>
                            {/* Toggle Console Button */}
                            <button 
                                onClick={() => setIsConsoleOpen(!isConsoleOpen)}
                                className="text-xs px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded border border-slate-700"
                            >
                                {isConsoleOpen ? 'Hide Console' : 'Show Console'}
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                         {isProcessing && (
                            <button 
                                onClick={handleStop}
                                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-colors text-sm font-medium"
                            >
                                Stop
                            </button>
                         )}
                         <button 
                            onClick={handleRemoveJob}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-sm font-medium"
                         >
                            Start New
                         </button>
                    </div>
                </div>

                {/* Single Job Card */}
                <div className="grid grid-cols-1 gap-6">
                    <JobCard 
                        key={job.id} 
                        job={job} 
                        onUpdateSubtitle={handleUpdateSubtitle}
                        onRemove={handleRemoveJob}
                    />
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <ConsolePopup 
        logs={logs} 
        isOpen={isConsoleOpen} 
        onClose={() => setIsConsoleOpen(false)}
        onClear={() => setLogs([])}
      />
    </div>
  );
}

export default App;