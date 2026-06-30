import { create } from 'zustand';

export type PipelineState = 'idle' | 'thinking' | 'speaking' | 'error';

export interface ChatUIState {
  currentMessage: string;
  interimTranscript: string;
  pipelineState: PipelineState;
  
  setPipelineState: (state: PipelineState) => void;
  setInterimTranscript: (text: string) => void;
  
  _buffer: string;
  _frameRef: number | null;
  pushDelta: (chunk: string) => void;
  commitFinal: () => void;
  resetStream: () => void;
}

export const useChatUIStore = create<ChatUIState>((set, get) => ({
  currentMessage: '',
  interimTranscript: '',
  pipelineState: 'idle',
  
  setPipelineState: (state) => set({ pipelineState: state }),
  setInterimTranscript: (text) => set({ interimTranscript: text }),
  
  _buffer: '',
  _frameRef: null,
  
  pushDelta: (chunk: string) => {
    const state = get();
    const newBuffer = state._buffer + chunk;
    set({ _buffer: newBuffer });
    
    if (state._frameRef === null) {
      const frameRef = requestAnimationFrame(() => {
        set((s) => ({ currentMessage: s._buffer, _frameRef: null }));
      });
      set({ _frameRef: frameRef });
    }
  },
  
  commitFinal: () => {
    const state = get();
    if (state._frameRef !== null) {
      cancelAnimationFrame(state._frameRef);
    }
    set({ currentMessage: '', _buffer: '', _frameRef: null });
  },
  
  resetStream: () => {
    const state = get();
    if (state._frameRef !== null) {
      cancelAnimationFrame(state._frameRef);
    }
    set({ currentMessage: '', interimTranscript: '', _buffer: '', _frameRef: null, pipelineState: 'idle' });
  }
}));
