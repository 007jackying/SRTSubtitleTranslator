import { SubtitleItem } from '../types';

export const parseSRT = (data: string): SubtitleItem[] => {
  const normalizedData = data.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalizedData.split(/\n\n+/);
  
  const items: SubtitleItem[] = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue; // Basic validation

    // 1
    // 00:00:01,000 --> 00:00:04,000
    // Text line 1
    // Text line 2
    
    const id = parseInt(lines[0], 10);
    const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2}[,.]\d{3}) --> (\d{2}:\d{2}:\d{2}[,.]\d{3})/);
    
    if (timeMatch) {
      const startTime = timeMatch[1].replace('.', ',');
      const endTime = timeMatch[2].replace('.', ',');
      const text = lines.slice(2).join('\n');
      
      if (!isNaN(id)) {
        items.push({
          id,
          startTime,
          endTime,
          originalText: text
        });
      }
    }
  }

  return items;
};

export const generateSRT = (items: SubtitleItem[]): string => {
  return items.map(item => {
    return `${item.id}\n${item.startTime} --> ${item.endTime}\n${item.translatedText || item.originalText}`;
  }).join('\n\n');
};

export const downloadFile = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
