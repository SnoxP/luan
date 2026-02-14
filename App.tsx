import React, { useState, useEffect } from 'react';
import { Upload, Video, Ratio, Palette, Sparkles, Image as ImageIcon, Info, Settings2, Maximize2, AlertCircle, Globe } from 'lucide-react';
import VideoEditor from './components/VideoEditor';
import { AspectRatio, ScaleMode, VideoConfig } from './types';
import { translations } from './translations';

const App = () => {
  const [file, setFile] = useState<File | null>(null);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [language, setLanguage] = useState<'en' | 'pt'>('pt'); // Default to PT as requested
  
  const t = translations[language];

  const [config, setConfig] = useState<VideoConfig>({
    aspectRatio: AspectRatio.PORTRAIT,
    scaleMode: ScaleMode.CONTAIN,
    backgroundColor: '#000000',
    useAIBackground: false,
    aiPrompt: 'Cosmic nebula with purple and blue hues',
    customWidth: 1920,
    customHeight: 1080,
    maintainAspectRatio: true,
  });

  // Helper to process file and extract dimensions
  const processAndSetFile = (videoFile: File) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = URL.createObjectURL(videoFile);
    
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      
      // Update config with video dimensions
      setConfig(prev => ({
        ...prev,
        customWidth: video.videoWidth,
        customHeight: video.videoHeight,
        maintainAspectRatio: true
      }));
      
      setFile(videoFile);
      setPasteError(null);
    };

    video.onerror = () => {
       setPasteError("Failed to load video metadata.");
       setTimeout(() => setPasteError(null), 4000);
    };
  };

  // Handle Ctrl+V (Paste) functionality
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Don't intercept if user is typing in an input
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      if (e.clipboardData && e.clipboardData.files.length > 0) {
        const pastedFile = e.clipboardData.files[0];
        
        if (pastedFile.type.startsWith('video/')) {
          processAndSetFile(pastedFile);
        } else {
          setPasteError("The pasted content is not a supported video file.");
          setTimeout(() => setPasteError(null), 4000);
        }
      } else {
         if (!file) {
             if (e.clipboardData?.items.length) {
                 setPasteError("No video file detected in clipboard.");
                 setTimeout(() => setPasteError(null), 4000);
             }
         }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [file]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processAndSetFile(e.target.files[0]);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPasteError(null);
    setConfig({
        aspectRatio: AspectRatio.PORTRAIT,
        scaleMode: ScaleMode.CONTAIN,
        backgroundColor: '#000000',
        useAIBackground: false,
        aiPrompt: 'Cosmic nebula with purple and blue hues',
        customWidth: 1920,
        customHeight: 1080,
        maintainAspectRatio: true,
    });
  };

  if (file) {
    return <VideoEditor file={file} config={config} onConfigChange={setConfig} onReset={handleReset} t={t} />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 flex flex-col items-center justify-center relative">
      
      {/* Language Toggle */}
      <div className="absolute top-6 right-6">
          <button 
            onClick={() => setLanguage(l => l === 'en' ? 'pt' : 'en')}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          >
              <Globe className="w-4 h-4 text-blue-400" />
              <span>{language === 'en' ? 'English' : 'Português'}</span>
          </button>
      </div>

      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        
        {/* Left Column: Branding & Intro */}
        <div className="space-y-6">
            <h1 className="text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                {t.appTitle}
            </h1>
            <p className="text-gray-400 text-lg leading-relaxed">
                {t.description}
            </p>

            <div className="flex gap-4 pt-4">
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                        <Video className="w-4 h-4" />
                    </div>
                    <span>{t.noCrop}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                        <Ratio className="w-4 h-4" />
                    </div>
                    <span>{t.multiFormat}</span>
                </div>
            </div>
        </div>

        {/* Right Column: Configuration & Upload */}
        <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700">
             
             {/* Step 1: Settings */}
             <div className="space-y-6 mb-8">
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                        <Ratio className="w-4 h-4" /> {t.targetAspectRatio}
                    </label>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                        {Object.values(AspectRatio).map((ratio) => (
                            <button
                                key={ratio}
                                onClick={() => setConfig({ ...config, aspectRatio: ratio })}
                                className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                                    config.aspectRatio === ratio
                                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/50'
                                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                                }`}
                            >
                                {t.ratios[ratio as keyof typeof t.ratios]}
                            </button>
                        ))}
                    </div>

                    {/* Custom Resolution Inputs */}
                    {config.aspectRatio === AspectRatio.CUSTOM && (
                        <div className="bg-gray-700/50 p-3 rounded-lg border border-gray-600 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center gap-2 text-xs text-gray-400 mb-2 uppercase font-bold tracking-wider">
                                <Settings2 className="w-3 h-3" /> {t.customDimensions}
                            </div>
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="block text-xs text-gray-400 mb-1">{t.width}</label>
                                    <input 
                                        type="number" 
                                        value={config.customWidth}
                                        onChange={(e) => setConfig({...config, customWidth: Number(e.target.value)})}
                                        className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none transition-colors"
                                        placeholder="1920"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs text-gray-400 mb-1">{t.height}</label>
                                    <input 
                                        type="number" 
                                        value={config.customHeight}
                                        onChange={(e) => setConfig({...config, customHeight: Number(e.target.value)})}
                                        className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none transition-colors"
                                        placeholder="1080"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                        <Maximize2 className="w-4 h-4" /> {t.resizeMode}
                    </label>
                    <div className="flex gap-2 mb-4">
                        {Object.values(ScaleMode).map((mode) => (
                            <button
                                key={mode}
                                onClick={() => setConfig({ ...config, scaleMode: mode })}
                                className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium border transition-all ${
                                    config.scaleMode === mode
                                    ? 'bg-blue-600 border-blue-500 text-white'
                                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                                }`}
                            >
                                {t.modes[mode as keyof typeof t.modes]}
                            </button>
                        ))}
                    </div>
                </div>
             </div>

             {/* Step 2: Upload */}
             <div className="space-y-4">
                <div className={`relative group transition-all ${pasteError ? 'animate-shake' : ''}`}>
                    <input 
                        type="file" 
                        accept="video/*" 
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors bg-gray-900/50 group-hover:bg-gray-800/80 ${
                        pasteError ? 'border-red-500/50 bg-red-900/10' : 'border-gray-600 group-hover:border-blue-500'
                    }`}>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors ${
                            pasteError ? 'bg-red-900/50 text-red-400' : 'bg-gray-800 group-hover:bg-blue-900/30 text-gray-400 group-hover:text-blue-400'
                        }`}>
                            {pasteError ? <AlertCircle className="w-6 h-6" /> : <Upload className="w-6 h-6" />}
                        </div>
                        <h3 className="text-lg font-medium text-white mb-1">
                            {pasteError ? t.invalidFile : t.uploadTitle}
                        </h3>
                        <p className="text-gray-500 text-sm text-center">
                            {t.dragDrop}
                        </p>
                        <p className="text-gray-600 text-xs mt-2">{t.fileType}</p>
                    </div>
                </div>
                
                {pasteError && (
                    <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 p-3 rounded-lg border border-red-500/20 animate-in fade-in slide-in-from-top-1">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{pasteError}</span>
                    </div>
                )}
             </div>

        </div>
      </div>
      
      <div className="mt-16 text-center text-gray-600 text-xs space-y-2">
         <p>{t.processingNote}</p>
         <p className="font-semibold text-gray-500 hover:text-blue-400 transition-colors cursor-default">Created by Snox</p>
      </div>

    </div>
  );
};

export default App;