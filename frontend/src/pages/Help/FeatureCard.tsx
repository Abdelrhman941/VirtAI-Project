import React, { useEffect, useRef } from 'react';
import styles from './Help.module.css';

export interface Feature {
  id: string;
  title: string;
  videoSrc: string;
  desc: string;
}

interface FeatureCardProps {
  feature: Feature;
}

export function FeatureCard({ feature }: FeatureCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [feature.videoSrc]);

  return (
    <div className={styles.featureCard}>
      <div className={styles.videoWrapper}>
        <video 
          ref={videoRef}
          key={feature.videoSrc}
          className={styles.videoElement}
          src={feature.videoSrc} 
          controls 
          preload="metadata"
          muted
          autoPlay
          loop
        />
      </div>
      <div className={styles.featureInfo}>
        <h2 className={styles.featureTitle}>{feature.title}</h2>
        <p className={styles.featureDesc}>{feature.desc}</p>
        <div className={styles.featureCallout}>
          <span className={styles.calloutLabel}>When to use it</span>
          <span className={styles.calloutText}>Perfect for visual learning and interactive sessions.</span>
        </div>
      </div>
    </div>
  );
}
