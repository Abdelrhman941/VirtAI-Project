import { useEffect, useRef } from 'react';

export interface Feature {
  id: string;
  title: string;
  videoSrc: string;
  desc: string;
}

export function FeatureCard({ feature }: { feature: Feature }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    videoRef.current?.load();
  }, [feature.videoSrc]);

  return (
    <article className="grid gap-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:grid-cols-[1.35fr_1fr]">
      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
        <video
          ref={videoRef}
          key={feature.videoSrc}
          src={feature.videoSrc}
          className="aspect-video w-full object-cover"
          controls
          muted
          autoPlay
          loop
          preload="metadata"
        />
      </div>
      <div className="flex flex-col justify-center gap-4">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{feature.title}</h2>
        <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="text-xs uppercase tracking-wider text-primary">When to use it</div>
          <p className="mt-1 text-sm text-foreground/90">
            Perfect for visual learning and interactive sessions.
          </p>
        </div>
      </div>
    </article>
  );
}
