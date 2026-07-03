import React, { useState } from 'react';
import { FiPlay, FiSend } from 'react-icons/fi';

interface SlideQuestionInputProps {
  onQuestion: (text: string) => void;
  onContinue: () => void;
}

export function SlideQuestionInput({ onQuestion, onContinue }: SlideQuestionInputProps) {
  const [text, setText] = useState('');

  const lastSubmitTime = React.useRef(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = Date.now();
    if (now - lastSubmitTime.current < 500) return;

    const cleanText = text.trim();
    if (cleanText) {
      lastSubmitTime.current = now;
      onQuestion(cleanText);
      setText('');
    }
  };

  return (
    <div className="flex flex-col gap-4 p-6 bg-card rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] mt-6 border border-primary/15">
      <div className="font-medium text-foreground m-0">
        <p>Pose a question about this slide content or proceed with the lecture presentation.</p>
      </div>
      <form className="flex gap-2" onSubmit={handleSubmit}>
        <input
          type="text"
          className="flex-1 px-5 py-3 border border-primary/20 bg-black/20 text-foreground rounded-full text-base outline-none transition-all duration-200 placeholder:text-muted-foreground focus:border-primary focus:shadow-[0_0_14px_rgba(180,171,139,0.15)]"
          placeholder="Type your academic question or inquiry..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          autoFocus
        />
        <button
          type="submit"
          className="flex items-center justify-center w-[42px] h-[42px] rounded-full border-none bg-primary text-[#0A0908] cursor-pointer transition-all duration-200 ease-out hover:bg-[#C9C0A0] hover:shadow-[0_0_12px_rgba(180,171,139,0.25)] hover:scale-105 disabled:bg-white/5 disabled:text-white/20 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
          disabled={!text.trim()}
          title="Send Question"
        >
          <FiSend />
        </button>
      </form>
      <div className="flex items-center gap-4 justify-end">
        <span className="text-muted-foreground text-sm">or</span>
        <button
          type="button"
          className="flex items-center gap-2 px-5 py-2.5 bg-transparent text-primary border border-primary rounded-full font-semibold cursor-pointer transition-all duration-200 ease-out hover:bg-primary/10 hover:border-[#c9c0a0] hover:shadow-[0_0_12px_rgba(180,171,139,0.15)] hover:scale-[1.02] active:scale-100"
          aria-label="Advance presentation"
          onClick={onContinue}
        >
          <FiPlay /> Advance presentation
        </button>
      </div>
    </div>
  );
}
