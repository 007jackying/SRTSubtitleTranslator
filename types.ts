
export interface SubtitleItem {
  id: number;
  startTime: string; // Format: 00:00:00,000
  endTime: string;   // Format: 00:00:00,000
  originalText: string;
  translatedText?: string;
}

export enum AppState {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING', // General state when any job is running
}

export enum JobStatus {
  PENDING = 'PENDING',
  PARSING = 'PARSING',
  TRANSLATING = 'TRANSLATING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
  STOPPED = 'STOPPED'
}

export interface FileJob {
  id: string; // Unique ID (e.g., timestamp + filename)
  file: File;
  filename: string;
  status: JobStatus;
  subtitles: SubtitleItem[];
  progress: number;
  currentLineId: number;
  error?: string;
}

export interface ProcessingStats {
  totalLines: number;
  processedLines: number;
  currentBatch: number;
  totalBatches: number;
  startTime: number;
}
