import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Dimensions, ProcessingState, RESOLUTIONS, VideoConfig, AspectRatio, ScaleMode } from '../types';
import { generateBackgroundImage } from '../services/geminiService';
import { Download, Loader2, Play, RefreshCw, Wand2, Ratio, Settings2, Maximize2, Pause, Volume2, VolumeX, SkipBack, Link as LinkIcon, Maximize } from 'lucide-react';

interface VideoEditorProps {
  file: File;
  config: VideoConfig;
  onConfigChange: (config: VideoConfig) => void;
  onReset: () => void;
  t: any; // Using any for simplicity with the translations object
}

const VideoEditor: React.FC<VideoEditorProps> = ({ file, config, onConfigChange, onReset, t }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  
  // Refs for loop control to avoid closure staleness
  const processingStateRef = useRef<ProcessingState>(ProcessingState.IDLE);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const [videoSrc, setVideoSrc] = useState<string>('');
  const [processingState, setProcessingState] = useState<ProcessingState>(ProcessingState.IDLE);
  const [progress, setProgress] = useState<number>(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [recordingMimeType, setRecordingMimeType] = useState<string>('');
  const [aiBgImage, setAiBgImage] = useState<HTMLImageElement | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Playback state
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  // Sync ref with state
  useEffect(() => {
    processingStateRef.current = processingState;
  }, [processingState]);

  // Helper to format time (e.g., 65s -> 01:05)
  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Helper to get effective dimensions
  const getTargetDimensions = useCallback((): Dimensions => {
    if (config.aspectRatio === AspectRatio.CUSTOM) {
        return {
            width: config.customWidth || 1920,
            height: config.customHeight || 1080
        };
    }
    return RESOLUTIONS[config.aspectRatio];
  }, [config.aspectRatio, config.customWidth, config.customHeight]);
  
  // Create object URL for the uploaded file
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Handle AI Background Generation
  const generateAIBackground = async () => {
    if (!config.aiPrompt.trim()) return;
    
    setProcessingState(ProcessingState.GENERATING_BACKGROUND);
    setErrorMsg(null);
    
    try {
      const base64Image = await generateBackgroundImage(config.aiPrompt + " texture, abstract background, high quality, seamless pattern style");
      const img = new Image();
      img.src = base64Image;
      await new Promise((resolve) => { img.onload = resolve; });
      setAiBgImage(img);
      setProcessingState(ProcessingState.IDLE);
    } catch (err) {
      setErrorMsg("Failed to generate background. Check API Key or try again.");
      setProcessingState(ProcessingState.IDLE);
    }
  };

  // Handle Custom Dimension Change with Aspect Ratio Lock
  const handleCustomDimensionChange = (dimension: 'width' | 'height', value: string) => {
    const numericValue = Number(value);
    if (isNaN(numericValue)) return;

    let newConfig = { ...config, [dimension === 'width' ? 'customWidth' : 'customHeight']: numericValue };

    if (config.maintainAspectRatio && videoRef.current) {
        const vid = videoRef.current;
        const ratio = vid.videoWidth / vid.videoHeight;
        
        if (dimension === 'width') {
            newConfig.customHeight = Math.round(numericValue / ratio);
        } else {
            newConfig.customWidth = Math.round(numericValue * ratio);
        }
    }
    
    onConfigChange(newConfig);
  };

  // Draw a single frame to the canvas
  const drawFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false }); // Optimize for no alpha
    if (!ctx) return;

    const targetDim = getTargetDimensions();
    
    // Clear canvas
    ctx.fillStyle = config.backgroundColor;
    ctx.fillRect(0, 0, targetDim.width, targetDim.height);

    if (config.scaleMode === ScaleMode.CONTAIN) {
        // Draw Background (Image or Color)
        if (config.useAIBackground && aiBgImage) {
            const scale = Math.max(targetDim.width / aiBgImage.width, targetDim.height / aiBgImage.height);
            const x = (targetDim.width / 2) - (aiBgImage.width / 2) * scale;
            const y = (targetDim.height / 2) - (aiBgImage.height / 2) * scale;
            ctx.drawImage(aiBgImage, x, y, aiBgImage.width * scale, aiBgImage.height * scale);
            
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(0, 0, targetDim.width, targetDim.height);
        } else {
            ctx.fillStyle = config.backgroundColor;
            ctx.fillRect(0, 0, targetDim.width, targetDim.height);
        }
    }

    let w = targetDim.width;
    let h = targetDim.height;
    let x = 0;
    let y = 0;

    if (config.scaleMode === ScaleMode.STRETCH) {
        w = targetDim.width;
        h = targetDim.height;
        x = 0;
        y = 0;
    } else if (config.scaleMode === ScaleMode.COVER) {
         const scale = Math.max(
            targetDim.width / video.videoWidth,
            targetDim.height / video.videoHeight
         );
         w = video.videoWidth * scale;
         h = video.videoHeight * scale;
         x = (targetDim.width - w) / 2;
         y = (targetDim.height - h) / 2;
    } else {
        // CONTAIN
        const scale = Math.min(
            targetDim.width / video.videoWidth,
            targetDim.height / video.videoHeight
         );
         w = video.videoWidth * scale;
         h = video.videoHeight * scale;
         x = (targetDim.width - w) / 2;
         y = (targetDim.height - h) / 2;

        ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 10;
    }

    ctx.drawImage(video, x, y, w, h);

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

  }, [getTargetDimensions, config.backgroundColor, config.useAIBackground, aiBgImage, config.scaleMode]);

  // Playback Loop Effect (For Preview Only)
  useEffect(() => {
    const video = videoRef.current;
    if (!isPlaying || !video || processingStateRef.current !== ProcessingState.IDLE) return;

    let animationFrameId: number;
    
    const loop = () => {
      if (video.paused || video.ended) {
        setIsPlaying(false);
        return;
      }
      drawFrame();
      animationFrameId = requestAnimationFrame(loop);
    };

    video.play().catch(e => {
        if (e.name !== 'AbortError') {
             console.error("Preview play error", e);
        }
        setIsPlaying(false);
    });
    
    loop();

    return () => {
      cancelAnimationFrame(animationFrameId);
      video.pause();
    };
  }, [isPlaying, drawFrame]);

  // Time Update Listener
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
        // Only update UI state if we are NOT recording to save performance
        if (processingStateRef.current === ProcessingState.IDLE) {
            setCurrentTime(video.currentTime);
        }
    };
    video.addEventListener('timeupdate', onTimeUpdate);
    return () => video.removeEventListener('timeupdate', onTimeUpdate);
  }, [videoSrc]);

  // Initial Draw Preview & Seek to Middle
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const handleMetadata = () => {
      const targetDim = getTargetDimensions();
      canvas.width = targetDim.width;
      canvas.height = targetDim.height;
      setVideoDuration(video.duration);
      
      if (Number.isFinite(video.duration) && video.duration > 0 && !isPlaying && processingState === ProcessingState.IDLE) {
        video.currentTime = video.duration / 2;
        setCurrentTime(video.duration / 2);
      }
    };

    video.addEventListener('loadedmetadata', handleMetadata);
    video.addEventListener('seeked', drawFrame);

    if (video.readyState >= 1) {
       handleMetadata();
       if (video.readyState >= 2) drawFrame();
    }

    return () => {
      video.removeEventListener('loadedmetadata', handleMetadata);
      video.removeEventListener('seeked', drawFrame);
    };
  }, [getTargetDimensions, drawFrame, videoSrc]);


  const startProcessing = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    
    setIsPlaying(false); // Update React state immediately

    if (config.scaleMode === ScaleMode.CONTAIN && config.useAIBackground && !aiBgImage && config.aiPrompt) {
        await generateAIBackground();
    }

    setProcessingState(ProcessingState.RECORDING);
    setDownloadUrl(null);
    setProgress(0);
    setErrorMsg(null);

    // Prioritize WebM for stability
    const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4'
    ];
    const selectedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';
    setRecordingMimeType(selectedMimeType);

    const stream = canvas.captureStream(30);
    
    // Improved Audio Capture
    try {
        const videoEl = video as any;
        const audioStream = videoEl.captureStream ? videoEl.captureStream() : 
                           videoEl.mozCaptureStream ? videoEl.mozCaptureStream() : null;
        
        if (audioStream) {
            const audioTracks = audioStream.getAudioTracks();
            if (audioTracks.length > 0) {
                stream.addTrack(audioTracks[0]);
            }
        }
    } catch (e) {
        console.warn("Could not capture audio track:", e);
    }

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: selectedMimeType,
      videoBitsPerSecond: 8000000 // 8 Mbps for high quality
    });
    
    mediaRecorderRef.current = mediaRecorder;

    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
          chunks.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: selectedMimeType });
      if (blob.size === 0) {
          setErrorMsg("Recording failed (0 bytes). Try a different browser or file.");
          setProcessingState(ProcessingState.IDLE);
          return;
      }
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setProcessingState(ProcessingState.COMPLETED);
      
      // Restore video state
      video.currentTime = video.duration / 2; 
      video.volume = volume; // Restore user volume
      video.muted = isMuted; // Restore user mute preference
      setIsPlaying(false);
    };

    // Start recording with timeslice
    mediaRecorder.start(1000);

    // Prepare video for recording
    video.currentTime = 0;
    
    // IMPORTANT: We need audio to capture it, but we don't want to blast the user.
    // Setting volume to very low allows capture in most browsers without annoyance.
    video.muted = false; 
    video.volume = 0.01; 
    
    await new Promise(r => setTimeout(r, 200)); // buffer
    
    try {
        await video.play();
    } catch (e) {
        console.error("Auto-play failed during recording:", e);
        setErrorMsg("Could not play video for recording.");
        setProcessingState(ProcessingState.IDLE);
        return;
    }
    
    // OPTIMIZED RENDER LOOP
    const renderLoop = (now: number, metadata: VideoFrameCallbackMetadata) => {
        if (processingStateRef.current !== ProcessingState.RECORDING) return;

        drawFrame();
        
        // Update progress bar
        const pct = (metadata.mediaTime / video.duration) * 100;
        setProgress(pct);

        if (video.ended) {
             // Finish up
             setTimeout(() => {
                 if (mediaRecorder.state === 'recording') mediaRecorder.stop();
             }, 500);
             return;
        }

        // Schedule next frame
        if ('requestVideoFrameCallback' in video) {
            video.requestVideoFrameCallback(renderLoop);
        } else {
            // Fallback for browsers without rVFC
            requestAnimationFrame(() => renderLoop(performance.now(), { mediaTime: video.currentTime } as any));
        }
    };
    
    if ('requestVideoFrameCallback' in video) {
        video.requestVideoFrameCallback(renderLoop);
    } else {
        requestAnimationFrame(() => renderLoop(performance.now(), { mediaTime: 0 } as any));
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && previewContainerRef.current) {
        previewContainerRef.current.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
  };

  const toggleMute = () => {
      if (videoRef.current) {
          const newMuted = !isMuted;
          videoRef.current.muted = newMuted;
          setIsMuted(newMuted);
      }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVolume = parseFloat(e.target.value);
      setVolume(newVolume);
      if (videoRef.current) {
          videoRef.current.volume = newVolume;
          if (isMuted && newVolume > 0) {
              videoRef.current.muted = false;
              setIsMuted(false);
          }
      }
  };

  const handleSeekReset = () => {
      if (videoRef.current) {
          videoRef.current.currentTime = 0;
          if (!isPlaying) drawFrame();
      }
  };
  
  const currentDim = getTargetDimensions();

  // Helper to determine file extension based on selected MIME type
  const fileExtension = recordingMimeType.includes('mp4') ? 'mp4' : 'webm';

  const isProcessing = processingState === ProcessingState.RECORDING || processingState === ProcessingState.GENERATING_BACKGROUND;

  return (
    <div className="flex flex-col h-full w-full max-w-6xl mx-auto p-4 gap-6">
      
      {/* Top Bar */}
      <div className="flex justify-between items-center bg-gray-800 p-4 rounded-xl shadow-lg border border-gray-700">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
           <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
           {t.previewExport}
        </h2>
        <div className="flex gap-3">
            <button 
                onClick={onReset}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm font-medium transition-colors"
                disabled={isProcessing}
            >
                {t.startOver}
            </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 h-full">
        {/* Left: Canvas / Preview */}
        <div ref={previewContainerRef} className="flex-1 bg-gray-950 rounded-xl overflow-hidden shadow-2xl relative flex items-center justify-center min-h-[400px] border border-gray-800 group/preview">
           {/* The actual source video (hidden but playing) */}
           <video 
             ref={videoRef} 
             src={videoSrc} 
             className="absolute opacity-0 pointer-events-none w-1 h-1" 
             crossOrigin="anonymous"
             playsInline
             muted={isMuted}
           />
           
           {/* The Canvas showing the composition */}
           <canvas 
             ref={canvasRef}
             className="max-w-full max-h-[70vh] w-auto h-auto object-contain shadow-2xl"
             style={{ aspectRatio: currentDim.width / currentDim.height }}
           />

           {/* Fullscreen Button */}
           <button
             onClick={toggleFullscreen}
             className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg backdrop-blur-sm transition-all z-20 opacity-0 group-hover/preview:opacity-100"
             title="Fullscreen Preview"
           >
             <Maximize className="w-5 h-5 hover:scale-110 transition-transform" />
           </button>

           {/* Loading Overlay - HIGHER Z-INDEX */}
           {processingState === ProcessingState.RECORDING && (
             <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center z-50">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                <p className="text-white font-medium text-lg animate-pulse">{t.renderingVideo}</p>
                <p className="text-gray-400 text-sm mt-2">{t.waitMoment}</p>
                <div className="w-64 h-2 bg-gray-800 rounded-full mt-4 overflow-hidden border border-gray-700">
                    <div className="h-full bg-blue-500 transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
                </div>
                <p className="text-blue-400 font-mono mt-2">{Math.round(progress)}%</p>
             </div>
           )}

           {processingState === ProcessingState.GENERATING_BACKGROUND && (
             <div className="absolute inset-0 bg-gray-900/95 flex flex-col items-center justify-center z-50 backdrop-blur-sm">
                <Wand2 className="w-12 h-12 text-purple-500 animate-pulse mb-4" />
                <p className="text-white font-medium">{t.dreamingBackground}</p>
             </div>
           )}
        </div>

        {/* Right: Actions */}
        <div className="w-full lg:w-80 flex flex-col gap-4">
             {/* Settings Card */}
             <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                <div className="flex justify-between items-center mb-4">
                     <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider">{t.settings}</h3>
                </div>
                
                <div className="space-y-4">
                    {/* Ratio Selector */}
                    <div>
                        <label className="text-xs text-gray-400 mb-2 block flex items-center gap-2">
                            <Ratio className="w-3 h-3" /> {t.targetAspectRatio}
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {Object.values(AspectRatio).map((ratio) => (
                                <button
                                    key={ratio}
                                    onClick={() => onConfigChange({ ...config, aspectRatio: ratio })}
                                    disabled={processingState !== ProcessingState.IDLE}
                                    className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-all ${
                                        config.aspectRatio === ratio
                                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/50'
                                        : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 disabled:opacity-50'
                                    }`}
                                >
                                    {t.ratios[ratio as keyof typeof t.ratios]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Custom Inputs */}
                    {config.aspectRatio === AspectRatio.CUSTOM && (
                        <div className="bg-gray-700/50 p-2 rounded-lg border border-gray-600 space-y-2">
                            <div className="flex items-center gap-2 text-xs text-gray-400 uppercase font-bold tracking-wider">
                                <Settings2 className="w-3 h-3" /> {t.customDimensions}
                            </div>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <input 
                                        type="number" 
                                        value={config.customWidth}
                                        disabled={processingState !== ProcessingState.IDLE}
                                        onChange={(e) => handleCustomDimensionChange('width', e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none transition-colors"
                                        placeholder="W"
                                    />
                                </div>
                                <div className="flex-1">
                                    <input 
                                        type="number" 
                                        value={config.customHeight}
                                        disabled={processingState !== ProcessingState.IDLE}
                                        onChange={(e) => handleCustomDimensionChange('height', e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none transition-colors"
                                        placeholder="H"
                                    />
                                </div>
                            </div>
                            
                            {/* Maintain Aspect Ratio Toggle */}
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <div className="relative">
                                    <input 
                                        type="checkbox"
                                        checked={config.maintainAspectRatio}
                                        onChange={(e) => onConfigChange({...config, maintainAspectRatio: e.target.checked})}
                                        disabled={processingState !== ProcessingState.IDLE}
                                        className="peer sr-only"
                                    />
                                    <div className="w-8 h-4 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[0px] after:left-[0px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                </div>
                                <span className={`text-xs select-none flex items-center gap-1.5 ${config.maintainAspectRatio ? 'text-blue-400' : 'text-gray-400 group-hover:text-gray-300'}`}>
                                    <LinkIcon className="w-3 h-3" /> {t.maintainRatio}
                                </span>
                            </label>
                        </div>
                    )}

                    {/* Resize Mode Selector */}
                    <div>
                        <label className="text-xs text-gray-400 mb-2 block flex items-center gap-2">
                            <Maximize2 className="w-3 h-3" /> {t.resizeMode}
                        </label>
                        <div className="flex gap-2">
                            {Object.values(ScaleMode).map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => onConfigChange({ ...config, scaleMode: mode })}
                                    disabled={processingState !== ProcessingState.IDLE}
                                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border transition-all ${
                                        config.scaleMode === mode
                                        ? 'bg-blue-600 border-blue-500 text-white'
                                        : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 disabled:opacity-50'
                                    }`}
                                >
                                    {t.modes[mode as keyof typeof t.modes]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-between text-xs text-gray-500 border-t border-gray-700 pt-3">
                         <span>{t.output}:</span>
                         <span className="text-white font-mono">{currentDim.width}x{currentDim.height}</span>
                    </div>
                </div>
             </div>
            
            {/* Playback Controls (Media Player Style) */}
            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-md">
                {/* Progress Bar */}
                <div className="w-full bg-gray-700 h-1.5 rounded-full mb-4 overflow-hidden relative cursor-pointer group">
                    <div 
                        className="bg-blue-500 h-full absolute top-0 left-0 transition-all duration-100 ease-linear"
                        style={{ width: `${(currentTime / (videoDuration || 1)) * 100}%` }}
                    />
                </div>

                <div className="flex items-center justify-between">
                    <div className="text-xs font-mono text-gray-400 w-16">
                        {formatTime(currentTime)}
                    </div>

                    <div className="flex items-center gap-4">
                        <button 
                            onClick={handleSeekReset}
                            disabled={isProcessing}
                            className="text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={t.resetStart}
                        >
                            <SkipBack className="w-5 h-5" />
                        </button>

                        <button 
                            onClick={() => setIsPlaying(!isPlaying)}
                            disabled={isProcessing}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                isPlaying 
                                ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30' 
                                : 'bg-white hover:bg-gray-200 text-black shadow-lg shadow-white/10'
                            }`}
                        >
                            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                        </button>

                         <div className="flex items-center gap-2 group">
                             <button 
                                onClick={toggleMute}
                                disabled={isProcessing}
                                className={`text-gray-400 hover:text-white transition-colors disabled:opacity-30 ${isMuted ? 'text-red-400' : ''}`}
                            >
                                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                            </button>
                            <input 
                                type="range" 
                                min="0" 
                                max="1" 
                                step="0.05" 
                                disabled={isProcessing}
                                value={isMuted ? 0 : volume} 
                                onChange={handleVolumeChange}
                                className="w-20 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 disabled:opacity-30"
                            />
                         </div>
                    </div>

                    <div className="text-xs font-mono text-gray-500 w-16 text-right">
                        {formatTime(videoDuration)}
                    </div>
                </div>
            </div>

             {errorMsg && (
                <div className="bg-red-900/50 border border-red-500/50 text-red-200 p-3 rounded-lg text-sm">
                    {errorMsg}
                </div>
             )}

             {/* Main Action Button */}
             {processingState === ProcessingState.COMPLETED && downloadUrl ? (
                <a 
                    href={downloadUrl}
                    download={`resized-video-pro.${fileExtension}`}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-green-900/20 transition-all transform hover:scale-[1.02]"
                >
                    <Download className="w-5 h-5" />
                    {t.downloadVideo}
                </a>
             ) : (
                <button 
                    onClick={startProcessing}
                    disabled={processingState !== ProcessingState.IDLE}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
                >
                    {processingState === ProcessingState.IDLE ? (
                        <>
                           <Download className="w-5 h-5" />
                           {t.downloadVideo}
                        </>
                    ) : (
                        <>{t.processingDownload}</>
                    )}
                </button>
             )}

            {processingState === ProcessingState.COMPLETED && (
                <button 
                    onClick={() => {
                        setDownloadUrl(null);
                        setProcessingState(ProcessingState.IDLE);
                        setProgress(0);
                        // Seek back to middle for preview
                        if (videoRef.current) {
                            videoRef.current.currentTime = videoRef.current.duration / 2;
                        }
                    }}
                    className="py-3 text-gray-400 hover:text-white flex items-center justify-center gap-2 text-sm"
                >
                    <RefreshCw className="w-4 h-4" /> {t.generateAnother}
                </button>
            )}

        </div>
      </div>
    </div>
  );
};

export default VideoEditor;