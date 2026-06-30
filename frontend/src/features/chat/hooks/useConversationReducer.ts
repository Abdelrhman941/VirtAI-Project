import { useReducer, Dispatch } from 'react';

export interface ConversationState {
  currentMessage: string;
  pipelineState: 'idle' | 'thinking' | 'speaking' | 'error';
  error: string | null;
  activeMessageId: string | null;
}

const initialState: ConversationState = {
  currentMessage: '',
  pipelineState: 'idle',
  error: null,
  activeMessageId: null,
};

type Action =
  | { type: 'CHAT_DELTA'; payload: { delta: string } }
  | { type: 'CHAT_FINAL'; payload?: any }
  | { type: 'PIPELINE_STATE'; payload: { state: ConversationState['pipelineState']; message_id?: string } }
  | { type: 'USER_MESSAGE'; payload: { message_id: string; text: string } }
  | { type: 'ERROR'; payload: { message: string } }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RESET' };

function conversationReducer(state: ConversationState, action: Action): ConversationState {
  switch (action.type) {
    case 'CHAT_DELTA':
      return {
        ...state,
        currentMessage: state.currentMessage + action.payload.delta,
      };
    case 'CHAT_FINAL':
      return {
        ...state,
        currentMessage: '',
        activeMessageId: null,
      };
    case 'PIPELINE_STATE':
      if (
        action.payload.message_id &&
        state.activeMessageId &&
        action.payload.message_id !== state.activeMessageId
      ) {
        return state;
      }
      return {
        ...state,
        pipelineState: action.payload.state,
        error: action.payload.state === 'error' ? state.error : null,
      };
    case 'USER_MESSAGE':
      return {
        ...state,
        activeMessageId: action.payload.message_id,
        currentMessage: '',
        error: null,
      };
    case 'ERROR':
      return {
        ...state,
        error: action.payload.message,
        pipelineState: 'error',
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
        pipelineState: state.pipelineState === 'error' ? 'idle' : state.pipelineState,
      };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

export function useConversationReducer(): [ConversationState, Dispatch<Action>] {
  const [state, dispatch] = useReducer(conversationReducer, initialState);
  return [state, dispatch];
}

export default useConversationReducer;
