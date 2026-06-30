import { avatarImages } from '@/features/avatar/data/avatars';
import SelectionCheckmark from '@/shared/components/SelectionCheckmark';
import { motion } from 'framer-motion';
import React, { memo } from 'react';

const avatarList = Object.values(avatarImages);

export interface Avatar {
  id: string;
  name: string;
  description: string;
  image: string;
  gender?: string;
  [key: string]: unknown;
}

export interface AvatarTabProps {
  selected: Avatar | null;
  onSelect: (avatar: Avatar) => void;
}

const AvatarTab = memo(function AvatarTab({ selected, onSelect }: AvatarTabProps) {
  return (
    <div>
      <h2 className="setup-section-title">Select Teaching Assistant Profile</h2>
      <p className="setup-section-subtitle">Choose the visual representation of your virtual classroom teaching assistant.</p>

      <div className="avatar-grid" role="radiogroup" aria-label="Avatars">
        {avatarList.map((avatar, idx) => {
          const isSelected = selected?.id === avatar.id;
          const isFocusable = isSelected || (!selected && idx === 0);

          return (
            <motion.button
              type="button"
              key={avatar.id}
              className={`avatar-card${isSelected ? ' selected' : ''}`}
              onClick={() => onSelect(avatar)}
              onKeyDown={(e) => {
                let nextIdx = null;
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                  nextIdx = (idx + 1) % avatarList.length;
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                  nextIdx = (idx - 1 + avatarList.length) % avatarList.length;
                }

                if (nextIdx !== null) {
                  e.preventDefault();
                  onSelect(avatarList[nextIdx]);
                  const grid = e.currentTarget.parentNode;
                  const nextElem = grid.children[nextIdx] as HTMLElement;
                  if (nextElem) nextElem.focus();
                }
              }}
              tabIndex={isFocusable ? 0 : -1}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              whileHover={{ y: -3 }}
              role="radio"
              aria-checked={isSelected}
              aria-label={avatar.name}
            >
              <img
                className="avatar-card-img"
                src={avatar.image}
                alt={avatar.name}
                width={200}
                height={200}
                draggable={false}
                loading="lazy"
                decoding="async"
              />
              <span className="avatar-card-name truncate block w-full text-ellipsis overflow-hidden" dir="auto" title={avatar.name}>{avatar.name}</span>
              <span className="avatar-card-desc truncate block w-full text-ellipsis overflow-hidden" dir="auto" title={avatar.description}>{avatar.description}</span>

              <SelectionCheckmark
                isSelected={isSelected}
                className="avatar-card-check"
                size={13}
              />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
});

export default AvatarTab;
