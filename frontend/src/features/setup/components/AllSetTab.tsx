import { motion } from 'framer-motion';
import { useState } from 'react';
import { FiCheck } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

import { updateSetupStatus } from '@/features/auth/services/authApi';
import { selectIsAuthenticated, useAuthStore } from '@/features/auth/store/authStore';
import { toast } from 'sonner';
import { saveSetup } from '../services/setupStorage';
import SuccessAnimation from './SuccessAnimation';

interface AllSetTabProps {
  avatar: any;
  voice: any;
  movementEnabled: boolean;
  onLaunch?: () => void;
}

export default function AllSetTab({
  avatar,
  voice,
  movementEnabled,
  onLaunch,
}: AllSetTabProps) {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const isInitializing = useAuthStore((s) => s.isInitializing);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!avatar || !voice || isSaving || isInitializing || !isAuthenticated) {
      return;
    }

     
    setIsSaving(true);

    try {
      const updatedUser = await updateSetupStatus(true);
       
      setUser(updatedUser);

      saveSetup({
        avatarId: avatar.id,
        voiceId: voice.id,
        movementEnabled: !!movementEnabled,
      });

      if (onLaunch) {
        onLaunch();
      } else {
        navigate('/classroom', { replace: true });
      }
    } catch {
      toast.error('Unable to Save Configuration', { description: 'We were unable to save your assistant configuration because of a temporary connection error. Please try clicking the button again.' });
    } finally {
       
      setIsSaving(false);
    }
  };


  const isReady = !!avatar && !!voice;

  return (
    <div className="allset-container">
      <SuccessAnimation />

      <motion.h2
        className="setup-section-title"
        style={{ textAlign: 'center', marginTop: 20 }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        Configuration Complete
      </motion.h2>

      <motion.p
        className="setup-section-subtitle"
        style={{ textAlign: 'center' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        Your curriculum-aware teaching assistant has been configured.
      </motion.p>

      <motion.div
        className="allset-summary"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1 }}
      >
        <div className="allset-item">
          <FiCheck className="check-icon" />
          <span>Teaching Assistant Avatar:</span>
          <span className="item-value truncate block max-w-[200px] overflow-hidden text-ellipsis" dir="auto" title={avatar?.name ?? '—'}>{avatar?.name ?? '—'}</span>
        </div>
        <div className="allset-item">
          <FiCheck className="check-icon" />
          <span>Speech Profile:</span>
          <span className="item-value truncate block max-w-[200px] overflow-hidden text-ellipsis" dir="auto" title={voice?.name ?? '—'}>{voice?.name ?? '—'}</span>
        </div>
      </motion.div>

      <motion.button
        className="shiny-save-btn"
        onClick={handleSave}
        disabled={!isReady || isSaving || isInitializing || !isAuthenticated}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.3, type: 'tween', ease: [0.2, 0.8, 0.2, 1], duration: 0.4 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        style={
          !isReady || isSaving || isInitializing || !isAuthenticated
            ? { opacity: 0.4, cursor: 'not-allowed' }
            : undefined
        }
      >
        <span style={{ position: 'relative', zIndex: 1 }}>
          {isSaving ? 'Persisting Configuration...' : 'Launch VirtAI Classroom →'}
        </span>
      </motion.button>
    </div>
  );
}
