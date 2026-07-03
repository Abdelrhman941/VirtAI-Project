import SelectionCheckmark from '@/shared/components/indicators/SelectionCheckmark';
import { motion } from 'framer-motion';
import React, { memo } from 'react';
import { HiPlay, HiStop } from 'react-icons/hi2';
import { voices, Voice } from '../data/voices';

export interface VoiceTabProps {
  selected: Voice | null;
  onSelect: (voice: Voice) => void;
  avatarGender: string | undefined;
  onPlay: (voice: Voice) => void;
  onStop: () => void;
  isPlaying: boolean;
  playingVoiceId: string | null;
}

const VoiceTab = memo(function VoiceTab({ selected, onSelect, avatarGender, onPlay, onStop, isPlaying, playingVoiceId }: VoiceTabProps) {
  const filteredVoices = avatarGender ? voices.filter((v: Voice) => v.gender === avatarGender) : voices;

  const handlePlayToggle = (e: React.MouseEvent, voice: Voice) => {
    e.stopPropagation();
    if (playingVoiceId === voice.id && isPlaying) {
      onStop();
    } else {
      onPlay(voice);
    }
  };

  return (
    <div className="overflow-y-auto no-scrollbar h-full">
      <h2 className="setup-section-title">Select Speech Profile</h2>
      <p className="setup-section-subtitle">Choose the acoustic synthesis that best aligns with your instruction delivery.</p>

      <div className="flex flex-col gap-2 mt-5 max-w-[600px]" role="radiogroup" aria-label="Voices">
        {filteredVoices.map((voice: Voice, idx: number) => {
          const isSelected = selected?.id === voice.id;
          const isCurrentlyPlaying = playingVoiceId === voice.id && isPlaying;
          const isFocusable = isSelected || (!selected && idx === 0);

          return (
            <motion.div
              tabIndex={isFocusable ? 0 : -1}
              onKeyDown={(e: React.KeyboardEvent) => {
                let nextIdx: number | null = null;
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                  nextIdx = (idx + 1) % filteredVoices.length;
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                  nextIdx = (idx - 1 + filteredVoices.length) % filteredVoices.length;
                }

                if (nextIdx !== null) {
                  e.preventDefault();
                  onSelect(filteredVoices[nextIdx]);
                  const grid = e.currentTarget.parentNode;
                  const nextElem = (grid as HTMLElement)?.children[nextIdx] as HTMLElement;
                  if (nextElem) nextElem.focus();
                } else if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(voice);
                }
              }}
              key={voice.id}
              className={`relative flex items-center gap-3.5 px-4 py-3 border rounded-[10px] cursor-pointer transition-all duration-200 ease-out text-left
                ${isSelected
                  ? 'border-[#b4ab8b] bg-[#b4ab8b]/10 shadow-[0_4px_16px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(180,171,139,0.1)]'
                  : 'bg-transparent border-[#333] hover:bg-white/[0.03] hover:border-white/15'
                }`}
              onClick={() => onSelect(voice)}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: idx * 0.06 }}
              role="radio"
              aria-checked={isSelected}
              aria-label={`${voice.name} — ${voice.desc}`}
            >
              <div className="flex-1 min-w-0">
                <div className="font-display text-[17px] font-semibold text-white flex items-center gap-2 truncate block w-full text-ellipsis overflow-hidden" dir="auto" title={voice.name}>
                  {voice.name}
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-md uppercase tracking-[0.5px] bg-white/[0.08] text-[#b0b0b0]">{voice.gender}</span>
                  {isCurrentlyPlaying && (
                    <div className="flex items-end gap-[2px] h-[18px] ml-2">
                      {[0, 0.15, 0.3, 0.1].map((delay, i) => (
                        <span
                          key={i}
                          className="w-[3px] rounded-[1px] bg-gradient-to-t from-[#6d001a] to-[#9b0827] animate-[equalizer_0.6s_ease-in-out_infinite_alternate]"
                          style={{ height: ['40%', '70%', '50%', '80%'][i], animationDelay: `${delay}s` }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-[13px] text-muted-foreground mt-0.5 truncate block w-full text-ellipsis overflow-hidden" dir="auto" title={voice.desc}>{voice.desc}</div>
                <div className="text-[12px] text-[#b0b0b0] mt-1 italic opacity-70 truncate block w-full text-ellipsis overflow-hidden" dir="auto" title={voice.greeting}>&ldquo;{voice.greeting}&rdquo;</div>
              </div>

              <button
                type="button"
                className={`w-9 h-9 rounded-full border flex items-center justify-center cursor-pointer transition-all duration-200 ease-out shrink-0 text-[14px]
                  ${isCurrentlyPlaying
                    ? 'bg-[#b4ab8b] border-[#b4ab8b] text-[#121212]'
                    : 'bg-transparent border-white/15 text-white hover:bg-white/[0.05]'
                  }`}
                onClick={(e) => handlePlayToggle(e, voice)}
                aria-label={
                  isCurrentlyPlaying ? `Stop ${voice.name} preview` : `Play ${voice.name} preview`
                }
              >
                {isCurrentlyPlaying ? <HiStop size={16} /> : <HiPlay size={16} />}
              </button>

              <SelectionCheckmark
                isSelected={isSelected}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#b4ab8b] text-[#121212] flex items-center justify-center text-[12px]"
                size={12}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
});

export default VoiceTab;
