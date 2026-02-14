export enum AspectRatio {
  SQUARE = '1:1',
  PORTRAIT = '9:16',
  LANDSCAPE = '16:9',
  CLASSIC = '4:3',
  VERTICAL_4_5 = '4:5',
  CUSTOM = 'Custom'
}

export enum ScaleMode {
  CONTAIN = 'Contain (Pad)',
  STRETCH = 'Stretch (Fill)',
  COVER = 'Cover (Crop)'
}

export interface Dimensions {
  width: number;
  height: number;
}

export enum ProcessingState {
  IDLE = 'IDLE',
  GENERATING_BACKGROUND = 'GENERATING_BACKGROUND',
  RECORDING = 'RECORDING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface VideoConfig {
  aspectRatio: AspectRatio;
  scaleMode: ScaleMode;
  backgroundColor: string;
  useAIBackground: boolean;
  aiPrompt: string;
  customWidth?: number;
  customHeight?: number;
  maintainAspectRatio?: boolean;
}

export const RESOLUTIONS: Record<string, Dimensions> = {
  [AspectRatio.SQUARE]: { width: 1080, height: 1080 },
  [AspectRatio.PORTRAIT]: { width: 1080, height: 1920 },
  [AspectRatio.LANDSCAPE]: { width: 1920, height: 1080 },
  [AspectRatio.CLASSIC]: { width: 1440, height: 1080 },
  [AspectRatio.VERTICAL_4_5]: { width: 1080, height: 1350 },
};