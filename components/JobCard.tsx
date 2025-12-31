import React, { useState } from 'react';
import { FileJob, JobStatus } from '../types';
import { ProgressBar } from './ProgressBar';
import { SubtitleList } from './SubtitleList';
import { generateSRT, downloadFile } from '../utils/srtParser';

interface JobCardProps {
  job: FileJob;
  onUpdateSubtitle: (jobId: string, subId: number, text: string) => void;
  onRemove: (jobId: string) => void;
}

export const JobCard: React.FC<JobCardProps> = ({ job, onUpdateSubtitle, onRemove }) => {
  const [expanded, setExpanded] = useState(false);

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const content = generateSRT(job.subtitles);
    downloadFile(`${job.filename}_zh.srt`, content);
  };

  const getStatusColor = (status: JobStatus) => {
    switch (status) {
      case JobStatus.COMPLETED: return 'text-green-400';
      case JobStatus.ERROR: return 'text-red-400';
      case JobStatus.TRANSLATING: return 'text-indigo-400 animate-pulse';
      case JobStatus.STOPPED: return 'text-orange-400';
      default: return 'text-slate-400';
    }
  };

  const isProcessing = job.status === JobStatus.TRANSLATING || job.status === JobStatus.PARSING || job.status === JobStatus.PENDING;

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-lg transition-all hover:border-slate-700">
      <div 
        className="p-5 cursor-pointer hover:bg-slate-800/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${job.status === JobStatus.TRANSLATING ? 'bg-indigo-500 animate-ping' : 'bg-slate-600'}`}></div>
            <h3 className="font-medium text-slate-200 truncate max-w-md" title={job.filename}>
              {job.filename}.srt
            </h3>
          </div>
          <div className="flex items-center gap-4">
            <span className={`text-xs font-medium uppercase tracking-wider ${getStatusColor(job.status)}`}>
              {job.status}
            </span>
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
               {job.status === JobStatus.COMPLETED && (
                  <button 
                    onClick={handleDownload}
                    className="p-2 bg-green-600/10 hover:bg-green-600 text-green-500 hover:text-white rounded-lg transition-colors"
                    title="Download"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
               )}
               {/* Only allow removing if not currently active to avoid state race conditions, or if stopped/error/completed */}
               {!isProcessing && (
                   <button 
                     onClick={() => onRemove(job.id)}
                     className="p-2 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                     title="Remove"
                   >
                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                     </svg>
                   </button>
               )}
               <button 
                 onClick={() => setExpanded(!expanded)}
                 className={`p-2 rounded-lg transition-colors ${expanded ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
               >
                 <svg className={`w-4 h-4 transform transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                 </svg>
               </button>
            </div>
          </div>
        </div>

        <ProgressBar progress={job.progress} />
      </div>

      {expanded && (
        <div className="border-t border-slate-800 bg-slate-950/30 p-4 animate-fade-in-down">
            <SubtitleList 
              items={job.subtitles} 
              currentId={job.currentLineId}
              onUpdateSubtitle={(id, text) => onUpdateSubtitle(job.id, id, text)}
            />
        </div>
      )}
    </div>
  );
};