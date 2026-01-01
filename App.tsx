import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { JobCard } from './components/JobCard';
import { ApiKeyInput } from './components/ApiKeyInput';
import { ConsolePopup } from './components/ConsolePopup';
import { parseSRT } from './utils/srtParser';
import { translateBatch } from './services/geminiService';
import { SubtitleItem, FileJob, JobStatus } from './types';

// Reduced batch size to 50 to balance throughput with reliability (avoiding 429s and truncation)
const BATCH_SIZE = 50;

function App() {
  // Queue State
  const [jobs, setJobs] = useState<FileJob[]>([]);
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);
  
  // Config State
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

  // Queue Watcher: Automatically starts next job if idle
  useEffect(() => {
    if (processingJobId || stopRef.current || !apiKey) return;

    const nextJob = jobs.find(j => j.status === JobStatus.PENDING);
    if (nextJob) {
        startJob(nextJob);
    }
  }, [jobs, processingJobId, apiKey]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev]);
    if (message.includes('Error') || message.includes('Failed')) {
        setIsConsoleOpen(true);
    }
  };

  const handleSaveKey = (key: string) => {
    localStorage.setItem('gemini_api_key', key);
    setApiKey(key);
  };

  const handleClearKey = () => {
    localStorage.removeItem('gemini_api_key');
    setApiKey(null);
    setJobs([]);
    setProcessingJobId(null);
    setLogs([]);
  };

  const handleFilesSelect = (files: File[]) => {
    stopRef.current = false;
    // Don't clear logs here so users can see history across multiple adds
    
    const newJobs: FileJob[] = files.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      filename: file.name.replace('.srt', ''),
      status: JobStatus.PENDING,
      subtitles: [],
      progress: 0,
      currentLineId: 0,
      targetLanguage: targetLanguage,
      model: selectedModel
    }));

    setJobs(prev => [...prev, ...newJobs]);
  };

  const handleRemoveJob = (id: string) => {
    if (id === processingJobId) {
        stopRef.current = true;
    }
    setJobs(prev => prev.filter(j => j.id !== id));
  };

  const handleUpdateSubtitle = useCallback((jobId: string, subId: number, text: string) => {
    setJobs(prev => prev.map(job => {
      if (job.id === jobId) {
        return {
          ...job,
          subtitles: job.subtitles.map(sub => 
            sub.id === subId ? { ...sub, translatedText: text } : sub
          )
        };
      }
      return job;
    }));
  }, []);

  const handleStopAll = () => {
    stopRef.current = true;
    addLog('User stopped the queue.');
    
    // Mark current processing job as stopped
    if (processingJobId) {
        updateJobState(processingJobId, { status: JobStatus.STOPPED });
        setProcessingJobId(null);
    }
  };

  const handleClearCompleted = () => {
    setJobs(prev => prev.filter(j => j.status !== JobStatus.COMPLETED));
  };

  const updateJobState = (jobId: string, updates: Partial<FileJob>) => {
    setJobs(prev => prev.map(job => job.id === jobId ? { ...job, ...updates } : job));
  };

  const startJob = async (currentJob: FileJob) => {
    const key = localStorage.getItem('gemini_api_key');
    if (!key) {
        addLog('Missing API Key.');
        return;
    }

    setProcessingJobId(currentJob.id);
    addLog(`Starting job: ${currentJob.filename}`);

    // 1. Parsing Phase
    updateJobState(currentJob.id, { status: JobStatus.PARSING });
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      if (stopRef.current) {
          updateJobState(currentJob.id, { status: JobStatus.STOPPED });
          setProcessingJobId(null);
          return;
      }

      const content = e.target?.result as string;
      if (content) {
        try {
            const parsed = parseSRT(content);
            if (parsed.length === 0) {
                throw new Error("Parsed SRT has 0 subtitles.");
            }
            updateJobState(currentJob.id, { 
                status: JobStatus.TRANSLATING, 
                subtitles: parsed 
            });
            
            // 2. Translating Phase
            await processTranslationLoop(currentJob.id, parsed, key, currentJob.targetLanguage, currentJob.model);
        } catch (parseError: any) {
            updateJobState(currentJob.id, { status: JobStatus.ERROR, error: 'File parsing failed' });
            addLog(`Parsing Error (${currentJob.filename}): ${parseError.message || parseError}`);
        }
      } else {
        updateJobState(currentJob.id, { status: JobStatus.ERROR, error: 'Empty file' });
        addLog(`Error (${currentJob.filename}): Uploaded file is empty.`);
      }
      
      // Job finished (or error), release the lock to allow next job
      setProcessingJobId(null);
    };

    reader.onerror = () => {
        updateJobState(currentJob.id, { status: JobStatus.ERROR, error: 'Failed to read file' });
        addLog(`FileReader Error (${currentJob.filename}): Failed to read content.`);
        setProcessingJobId(null);
    };
    reader.readAsText(currentJob.file);
  };

  const processTranslationLoop = async (jobId: string, items: SubtitleItem[], apiKey: string, lang: string, model: string) => {
    let processedCount = 0;
    const total = items.length;
    // We maintain a local copy to modify batch by batch, but state updates go to global `jobs`
    const localItems = [...items];

    if (total === 0) {
        updateJobState(jobId, { status: JobStatus.COMPLETED, progress: 100 });
        return;
    }

    for (let i = 0; i < total; i += BATCH_SIZE) {
      if (stopRef.current) {
        updateJobState(jobId, { status: JobStatus.STOPPED });
        break;
      }

      const batchEnd = Math.min(i + BATCH_SIZE, total);
      const batch = localItems.slice(i, batchEnd);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      
      updateJobState(jobId, { currentLineId: batch[0].id });

      const textsToTranslate = batch.map(b => b.originalText);
      
      try {
        const translations = await translateBatch(
            textsToTranslate, 
            apiKey, 
            lang, 
            model,
            (statusMsg) => addLog(`[${jobId.substr(0,4)}...] Batch ${batchNumber}: ${statusMsg}`)
        );
        
        for (let j = 0; j < batch.length; j++) {
           const originalIndex = i + j;
           const transText = translations[j] !== undefined ? translations[j] : batch[j].originalText; 
           
           localItems[originalIndex] = {
             ...localItems[originalIndex],
             translatedText: transText
           };
        }

        if (translations.length !== batch.length) {
            addLog(`Warning (${jobId}): Batch ${batchNumber} requested ${batch.length} lines but got ${translations.length}.`);
        }

        processedCount += batch.length;
        const progress = (processedCount / total) * 100;

        setJobs(prev => prev.map(job => {
            if (job.id === jobId) {
                return { 
                    ...job, 
                    subtitles: [...localItems],
                    progress: progress
                };
            }
            return job;
        }));

      } catch (err: any) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`Batch failed for job ${jobId}`, err);
        addLog(`Request Failed (${jobId}) [Lines ${batch[0].id}-${batch[batch.length-1].id}]: ${errorMsg}`);
        updateJobState(jobId, { status: JobStatus.ERROR, error: errorMsg });
        
        // Critical error in loop, we stop this job but allow the queue to proceed (in startJob finally block)
        return; 
      }
    }

    if (!stopRef.current) {
        // Double check status before marking complete (e.g. if error occurred above)
        setJobs(prev => {
            const current = prev.find(j => j.id === jobId);
            if (current && current.status !== JobStatus.ERROR && current.status !== JobStatus.STOPPED) {
                return prev.map(job => job.id === jobId ? { ...job, status: JobStatus.COMPLETED, progress: 100 } : job);
            }
            return prev;
        });
    }
  };

  // Global Progress Calculation
  const totalJobs = jobs.length;
  const completedJobs = jobs.filter(j => j.status === JobStatus.COMPLETED).length;
  const activeJob = jobs.find(j => j.id === processingJobId);
  const activeProgress = activeJob ? activeJob.progress : 0;
  
  // Calculate weighted progress: (Completed * 100 + CurrentJobProgress) / Total * 100
  const globalProgress = totalJobs > 0 
    ? ((completedJobs * 100) + (activeJob ? activeProgress : 0)) / totalJobs 
    : 0;

  return (
    <div className="min-h-screen flex flex-col pb-20">
      <Header onClearKey={apiKey ? handleClearKey : undefined} />
      
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!apiKey ? (
          <ApiKeyInput onSave={handleSaveKey} />
        ) : (
          <>
            {jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[70vh]">
                <div className="text-center mb-12">
                  <h2 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 mb-6">
                    SRT Translator
                  </h2>
                  <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
                    Queue multiple SRT files for automatic translation.
                    <br/>
                    <span className="text-indigo-400">Auto-detects source</span> language.
                  </p>
                </div>
                <FileUpload 
                  onFileSelect={handleFilesSelect} 
                  targetLanguage={targetLanguage}
                  onLanguageChange={setTargetLanguage}
                  selectedModel={selectedModel}
                  onModelChange={setSelectedModel}
                />
                
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
              <div className="space-y-6 animate-fade-in-up">
                
                {/* Global Queue Status & Progress */}
                <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm sticky top-24 z-40 shadow-xl">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                Job Queue 
                                <span className="text-sm font-normal text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                                    {completedJobs}/{totalJobs} Completed
                                </span>
                            </h2>
                            <p className="text-sm text-slate-400 mt-1">
                                {processingJobId ? 'Processing queue...' : 'Queue idle'}
                            </p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                             <button 
                                onClick={handleStopAll}
                                disabled={!processingJobId}
                                className={`px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${!processingJobId ? 'opacity-50 cursor-not-allowed border-slate-700 text-slate-500' : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20'}`}
                             >
                                Stop Queue
                             </button>
                             <button 
                                onClick={handleClearCompleted}
                                disabled={completedJobs === 0}
                                className={`px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm font-medium transition-colors ${completedJobs === 0 ? 'opacity-50 cursor-not-allowed text-slate-500' : 'hover:bg-slate-700 text-slate-300'}`}
                             >
                                Clear Done
                             </button>
                        </div>
                    </div>

                    {/* Global Progress Bar */}
                    <div className="w-full bg-slate-800 rounded-full h-2 mb-1 overflow-hidden">
                        <div 
                           className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500 ease-out"
                           style={{ width: `${globalProgress}%` }}
                        ></div>
                    </div>
                    {processingJobId && (
                        <div className="text-xs text-indigo-300 text-right animate-pulse">
                            Processing active job...
                        </div>
                    )}
                </div>

                {/* Job List */}
                <div className="grid grid-cols-1 gap-6 pb-20">
                    {jobs.map(job => (
                        <JobCard 
                            key={job.id} 
                            job={job} 
                            onUpdateSubtitle={handleUpdateSubtitle}
                            onRemove={handleRemoveJob}
                        />
                    ))}
                    
                    {/* Add More Button */}
                    <div className="flex justify-center pt-4">
                         <div className="relative">
                            <input 
                                type="file" 
                                id="add-more" 
                                multiple 
                                accept=".srt"
                                className="hidden" 
                                onChange={(e) => {
                                    if(e.target.files && e.target.files.length > 0) 
                                        handleFilesSelect(Array.from(e.target.files));
                                }}
                            />
                            <label 
                                htmlFor="add-more"
                                className="cursor-pointer px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl transition-all flex items-center gap-2 shadow-lg"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Add More Files
                            </label>
                        </div>
                    </div>
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