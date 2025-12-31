# Gemini SRT Translator 🎬

[Demo link
](https://srt-subtitle-translator.vercel.app/)

A modern, high-performance web application designed to automatically translate Japanese `.srt` subtitles into Simplified Chinese using Google's state-of-the-art **Gemini 3 Pro** model.

> ✨ **Note:** This project was **vibe coded** with AI assistance. It prioritizes aesthetics, smooth UI/UX, and getting things done.

## Features

- **🚀 Concurrent Batch Processing**: Upload multiple SRT files at once. The app intelligently manages a queue, processing up to 3 files concurrently to maximize throughput without hitting rate limits.
- **✨ High-Quality Translation**: leverages the `gemini-3-pro-preview` model for nuanced, context-aware translations that respect subtitle formatting.
- **📝 Live Editor**: Review and edit translations in real-time as they stream in.
- **⏯️ Control Flow**: Stop specific jobs or halt the entire queue with a single click.
- **🔒 Secure**: Your API key is stored locally in your browser and never sent to our servers.
- **🎨 Modern UI**: Built with React, Tailwind CSS, and a dash of dark mode elegance.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite (implied)
- **Styling**: Tailwind CSS
- **AI Integration**: Google GenAI SDK (`@google/genai`)
- **State Management**: React Hooks & Refs

## Getting Started

1. **Clone the repo**
   ```bash
   git clone https://github.com/yourusername/gemini-srt-translator.git
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the development server**
   ```bash
   npm run dev
   ```

4. **Get an API Key**
   - Visit [Google AI Studio](https://aistudio.google.com/app/apikey) to generate a free Gemini API key.
   - Paste it into the app when prompted.

## License

MIT
