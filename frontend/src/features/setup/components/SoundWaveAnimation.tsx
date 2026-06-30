import { useEffect, useReducer, useRef } from 'react';

const BAR_COUNT = 20;

/**
 * Animation state machine:
 *  'hidden'   – not rendered
 *  'playing'  – visible + animated
 *  'stopping' – visible + CSS exit class; transitions to 'hidden' after the animation delay
 */
function animReducer(state, action) {
  switch (action.type) {
    case 'PLAY':
      return 'playing';
    case 'STOP':
      return state === 'playing' ? 'stopping' : state;
    case 'HIDE':
      return state === 'stopping' ? 'hidden' : state;
    default:
      return state;
  }
}

export default function SoundWaveAnimation({ active }) {
  const [animState, dispatch] = useReducer(animReducer, active ? 'playing' : 'hidden');
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (active) {
      dispatch({ type: 'PLAY' });
    } else {
      dispatch({ type: 'STOP' });
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        dispatch({ type: 'HIDE' });
      }, 800);
    }

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [active]);

  if (animState === 'hidden') {
    return null;
  }

  return (
    <div
      className={`sound-wave-bars${animState === 'stopping' ? ' stopping' : ''}`}
      aria-hidden="true"
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <span key={i} className="sound-bar" />
      ))}
    </div>
  );
}
