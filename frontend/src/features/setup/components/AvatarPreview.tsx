import { AnimatePresence, motion } from 'framer-motion';
import { HiOutlineUser, HiPlay, HiStop } from 'react-icons/hi2';
import SoundWaveAnimation from './SoundWaveAnimation';

export default function AvatarPreview({
  avatar,
  voice,
  isPlaying,
  onPlayPreview,
  onStopPreview,
  movementEnabled,
  onMovementToggle,
}: any) {
  const handlePlayToggle = () => {
    if (isPlaying) {
      onStopPreview();
    } else if (voice?.previewUrl) {
      onPlayPreview(voice);
    }
  };

  const handleMovementChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onMovementToggle?.(event.target.checked);
  };

  return (
    <div className="flex flex-col items-center py-6 px-4 gap-4 h-full max-lg:flex-row max-lg:p-0 max-lg:h-auto max-lg:w-full max-lg:justify-between max-md:flex-col max-md:justify-center max-md:items-center max-md:p-0 max-md:gap-0 max-md:h-full max-md:w-full">
      <span className="text-[12px] font-semibold uppercase tracking-[1.2px] text-muted-foreground max-lg:hidden">Preview</span>

      <div className={`relative w-[160px] h-[160px] flex items-center justify-center max-lg:w-[60px] max-lg:h-[60px] max-md:w-[56px] max-md:h-[56px] ${movementEnabled ? '' : '[&_img]:!animate-none'}`}>
        <AnimatePresence mode="wait">
          {avatar ? (
            <motion.img
              key={avatar.id}
              className={`w-[130px] h-[130px] rounded-full object-cover border-[3px] border-white/10 [animation:avatar-float_3s_ease-in-out_infinite] max-lg:w-[60px] max-lg:h-[60px] max-md:w-[56px] max-md:h-[56px] max-md:animate-none ${movementEnabled ? '' : '!animate-none'}`}
              src={avatar.image}
              alt={avatar.name}
              draggable={false}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.35 }}
            />
          ) : (
            <motion.div
              key="placeholder"
              className="w-[130px] h-[130px] rounded-full bg-white/[0.06] border-2 border-dashed border-white/15 flex flex-col items-center justify-center gap-2 text-muted-foreground text-[12px] p-4 text-center box-border max-lg:w-[60px] max-lg:h-[60px] max-md:w-[56px] max-md:h-[56px] max-md:animate-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <HiOutlineUser size={28} className="opacity-40" />
              <span className="max-lg:hidden">Select avatar</span>
            </motion.div>
          )}
        </AnimatePresence>

        {isPlaying && <SoundWaveAnimation active={isPlaying} />}
      </div>

      <div className="flex flex-col items-center gap-[2px] max-lg:items-start max-lg:flex-1 max-lg:min-w-0 max-md:hidden">
        <AnimatePresence mode="wait">
          {avatar && (
            <motion.span
              key={avatar.id}
              className="font-display text-[20px] font-semibold text-white text-center max-lg:text-[16px] max-lg:text-left max-lg:whitespace-nowrap max-lg:overflow-hidden max-lg:text-ellipsis max-lg:w-full max-md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {avatar.name}
            </motion.span>
          )}
        </AnimatePresence>

        {voice && <span className="text-[13px] text-muted-foreground text-center max-lg:text-[12px] max-lg:text-left max-md:hidden">Voice: {voice.name}</span>}
      </div>

      <div className="flex flex-col items-center gap-3.5 w-full mt-auto max-lg:flex-row max-lg:w-auto max-lg:mt-0 max-lg:gap-2.5 max-md:hidden">
        <button
          className="flex items-center gap-2 font-medium font-sans border border-white/15 cursor-pointer bg-white/[0.06] text-white transition-all duration-250 ease-out px-4 py-2 text-[13px] rounded-full disabled:opacity-35 disabled:cursor-not-allowed hover:not:disabled:bg-white/10 hover:not:disabled:border-[#6d001a] max-md:hidden"
          onClick={handlePlayToggle}
          disabled={!voice}
          aria-label={isPlaying ? 'Stop voice preview' : 'Preview voice'}
        >
          {isPlaying ? <HiStop size={14} /> : <HiPlay size={14} />}
          {isPlaying ? 'Stop' : 'Preview'}
        </button>

        <label className="w-[min(200px,100%)] flex items-center justify-between gap-3.5 px-3 py-2 relative rounded-xl border border-white/[0.12] bg-white/[0.04] text-white text-[12px] font-medium cursor-pointer transition-all duration-250 ease-out hover:border-[#b4ab8b]/40 hover:bg-[#b4ab8b]/[0.08] max-lg:w-auto max-lg:px-2.5 max-lg:py-1.5 group">
          <span className="inline-flex items-center gap-1.5 font-sans text-muted-foreground">
            Movement <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold tracking-[0.3px] uppercase text-amber-500 border border-amber-500/60 bg-amber-500/12">Beta</span>
          </span>
          <input
            type="checkbox"
            className="peer absolute opacity-0 w-0 h-0"
            role="switch"
            checked={!!movementEnabled}
            onChange={handleMovementChange}
            aria-checked={!!movementEnabled}
            aria-label="Toggle avatar movement"
          />
          <span className="relative w-[38px] h-5 rounded-full bg-white/15 transition-colors duration-200 shrink-0 peer-checked:bg-[#b4ab8b]/60 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#b4ab8b]/80" aria-hidden="true">
            <span className="absolute top-0.5 left-[2px] w-4 h-4 rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.35)] transition-transform duration-200 peer-checked:translate-x-[18px]" style={{ transform: movementEnabled ? 'translateX(18px)' : 'translateX(0)' }} />
          </span>
        </label>
      </div>
    </div>
  );
}
