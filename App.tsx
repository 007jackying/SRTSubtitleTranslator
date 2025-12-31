import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { JobCard } from './components/JobCard';
import { ApiKeyInput } from './components/ApiKeyInput';
import { LanguageSelector } from './components/LanguageSelector';
import { parseSRT } from './utils/srtParser';
import { translateBatch } from './services/geminiService';
import { SubtitleItem, FileJob, JobStatus } from './types';

const BATCH_SIZE = 15;
const MAX_CONCURRENT_JOBS = 3;

function App() {
  const [jobs, setJobs] = useState<FileJob[]>([]);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState<string>('Simplified Chinese');
  
  // Ref to track which jobs are currently running to manage concurrency
  const activeJobsRef = useRef<Set<string>>(new Set());
  const stopRef = useRef(false);

  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) {
      setApiKey(storedKey);
    }
  }, []);

  // Queue Manager: Watch jobs and start new ones if slots are available
  useEffect(() => {
    if (stopRef.current || !apiKey) return;

    const pendingJobs = jobs.filter(j => j.status === JobStatus.PENDING);
    const processingCount = activeJobsRef.current.size;
    const slotsAvailable = MAX_CONCURRENT_JOBS - processingCount;

    if (slotsAvailable > 0 && pendingJobs.length > 0) {
      const jobsToStart = pendingJobs.slice(0, slotsAvailable);
      jobsToStart.forEach(job => {
        startJob(job);
      });
    }
  }, [jobs, apiKey]); // Re-run when jobs list updates

  const handleSaveKey = (key: string) => {
    localStorage.setItem('gemini_api_key', key);
    setApiKey(key);
  };

  const handleClearKey = () => {
    localStorage.removeItem('gemini_api_key');
    setApiKey(null);
    setJobs([]);
  };

  const handleFilesSelect = (files: File[]) => {
    stopRef.current = false;
    const newJobs: FileJob[] = files.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      filename: file.name.replace('.srt', ''),
      status: JobStatus.PENDING,
      subtitles: [],
      progress: 0,
      currentLineId: 0,
      targetLanguage: targetLanguage // Bake in the current language setting
    }));

    setJobs(prev => [...prev, ...newJobs]);
  };

  const handleRemoveJob = (jobId: string) => {
    setJobs(prev => prev.filter(j => j.id !== jobId));
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
    setJobs(prev => prev.map(job => 
      (job.status === JobStatus.TRANSLATING || job.status === JobStatus.PENDING || job.status === JobStatus.PARSING)
        ? { ...job, status: JobStatus.STOPPED } 
        : job
    ));
    activeJobsRef.current.clear();
  };

  const updateJobState = (id: string, updates: Partial<FileJob>) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, ...updates } : j));
  };

  const startJob = async (job: FileJob) => {
    const key = localStorage.getItem('gemini_api_key');
    if (!key) return;

    activeJobsRef.current.add(job.id);
    
    // 1. Parsing Phase
    updateJobState(job.id, { status: JobStatus.PARSING });
    
    // Use the passed job object directly instead of trying to fetch it from state asynchronously
    const reader = new FileReader();
    reader.onload = async (e) => {
      if (stopRef.current) {
          updateJobState(job.id, { status: JobStatus.STOPPED });
          activeJobsRef.current.delete(job.id);
          return;
      }

      const content = e.target?.result as string;
      if (content) {
        const parsed = parseSRT(content);
        updateJobState(job.id, { 
            status: JobStatus.TRANSLATING, 
            subtitles: parsed 
        });
        
        // 2. Translating Phase
        await processTranslationLoop(job.id, parsed, key, job.targetLanguage);
      } else {
        updateJobState(job.id, { status: JobStatus.ERROR, error: 'Empty file' });
        activeJobsRef.current.delete(job.id);
      }
    };
    reader.onerror = () => {
        updateJobState(job.id, { status: JobStatus.ERROR, error: 'Failed to read file' });
        activeJobsRef.current.delete(job.id);
    };
    reader.readAsText(job.file);
  };

  const processTranslationLoop = async (jobId: string, items: SubtitleItem[], apiKey: string, lang: string) => {
    let processedCount = 0;
    const total = items.length;
    // Work on a local copy of items to accumulate results, but we must update state frequently for UI
    const localItems = [...items];

    // If file is empty or no items parsed
    if (total === 0) {
        updateJobState(jobId, { status: JobStatus.COMPLETED, progress: 100 });
        activeJobsRef.current.delete(jobId);
        return;
    }

    for (let i = 0; i < total; i += BATCH_SIZE) {
      if (stopRef.current) {
        updateJobState(jobId, { status: JobStatus.STOPPED });
        break;
      }

      const batchEnd = Math.min(i + BATCH_SIZE, total);
      const batch = localItems.slice(i, batchEnd);
      
      updateJobState(jobId, { currentLineId: batch[0].id });

      const textsToTranslate = batch.map(b => b.originalText);
      
      try {
        const translations = await translateBatch(textsToTranslate, apiKey, lang);
        
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

        // Update state with new subtitles and progress
        setJobs(prev => prev.map(j => {
            if (j.id === jobId) {
                return { 
                    ...j, 
                    subtitles: [...localItems],
                    progress: progress
                };
            }
            return j;
        }));

      } catch (err) {
        console.error(`Batch failed for job ${jobId}`, err);
        // On error, we might want to continue or stop? For now, we continue but stats might look weird if we don't handle it.
        // We'll just leave the original text if translation fails (handled in service, but service returns [FAILED] or original).
      }
    }

    if (!stopRef.current) {
        updateJobState(jobId, { status: JobStatus.COMPLETED, progress: 100 });
    }
    activeJobsRef.current.delete(jobId);
  };

  const hasActiveJobs = jobs.some(j => j.status === JobStatus.TRANSLATING || j.status === JobStatus.PENDING || j.status === JobStatus.PARSING);

  return (
    <div className="min-h-screen flex flex-col">
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
                    Batch Subtitle Translator
                  </h2>
                  <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
                    Translate multiple SRT files automatically. 
                    <br/>
                    <span className="text-indigo-400">Auto-detects source</span> language.
                  </p>
                </div>
                <FileUpload 
                  onFileSelect={handleFilesSelect} 
                  targetLanguage={targetLanguage}
                  onLanguageChange={setTargetLanguage}
                />
              </div>
            ) : (
              <div className="space-y-8 animate-fade-in-up">
                
                {/* Dashboard Controls */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                    <div>
                        <h2 className="text-xl font-bold text-white">Translation Queue</h2>
                        <p className="text-sm text-slate-400">
                            Processing {activeJobsRef.current.size} active (Max {MAX_CONCURRENT_JOBS}) • {jobs.length} total files
                        </p>
                    </div>
                    <div className="flex items-end gap-3">
                         <LanguageSelector 
                            value={targetLanguage}
                            onChange={setTargetLanguage}
                            className="w-48"
                         />
                         
                         <label className="cursor-pointer px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors text-sm font-medium shadow-lg shadow-indigo-500/20 h-[38px] flex items-center mt-6">
                            Add Files
                            <input 
                                type="file" 
                                multiple 
                                accept=".srt" 
                                className="hidden" 
                                onChange={(e) => {
                                    if(e.target.files && e.target.files.length > 0) 
                                        handleFilesSelect(Array.from(e.target.files));
                                }} 
                            />
                         </label>
                         
                         {hasActiveJobs && (
                            <button 
                                onClick={handleStopAll}
                                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-colors text-sm font-medium h-[38px] mt-6"
                            >
                                Stop All
                            </button>
                         )}
                    </div>
                </div>

                {/* Job List */}
                <div className="grid grid-cols-1 gap-6">
                    {jobs.map(job => (
                        <JobCard 
                            key={job.id} 
                            job={job} 
                            onUpdateSubtitle={handleUpdateSubtitle}
                            onRemove={handleRemoveJob}
                        />
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;