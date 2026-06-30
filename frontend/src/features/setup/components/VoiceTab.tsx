import SelectionCheckmark from '@/shared/components/SelectionCheckmark';
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
    <div className="voice-tab-scroll">
      <h2 className="setup-section-title">Select Speech Profile</h2>
      <p className="setup-section-subtitle">Choose the acoustic synthesis that best aligns with your instruction delivery.</p>

      <div className="voice-grid" role="radiogroup" aria-label="Voices">
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
                  const nextElem = grid.children[nextIdx] as HTMLElement;
                  if (nextElem) nextElem.focus();
                } else if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(voice);
                }
              }}
              key={voice.id}
              className={`voice-card${isSelected ? ' selected' : ''}`}
              onClick={() => onSelect(voice)}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: idx * 0.06 }}
              role="radio"
              aria-checked={isSelected}
              aria-label={`${voice.name} — ${voice.desc}`}
            >
              <div className="voice-card-info">
                <div className="voice-card-name truncate block w-full text-ellipsis overflow-hidden" dir="auto" title={voice.name}>
                  {voice.name}
                  <span className={`voice-gender-badge ${voice.gender}`}>{voice.gender}</span>
                  {isCurrentlyPlaying && (
                    <div className="mini-equalizer">
                      <span className="bar" />
                      <span className="bar" />
                      <span className="bar" />
                      <span className="bar" />
                    </div>
                  )}
                </div>
                <div className="voice-card-desc truncate block w-full text-ellipsis overflow-hidden" dir="auto" title={voice.desc}>{voice.desc}</div>
                <div className="voice-card-greeting truncate block w-full text-ellipsis overflow-hidden" dir="auto" title={voice.greeting}>&ldquo;{voice.greeting}&rdquo;</div>
              </div>

              <button
                type="button"
                className={`voice-play-btn${isCurrentlyPlaying ? ' playing' : ''}`}
                onClick={(e) => handlePlayToggle(e, voice)}
                aria-label={
                  isCurrentlyPlaying ? `Stop ${voice.name} preview` : `Play ${voice.name} preview`
                }
              >
                {isCurrentlyPlaying ? <HiStop size={16} /> : <HiPlay size={16} />}
              </button>

              <SelectionCheckmark
                isSelected={isSelected}
                className="voice-card-check"
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
