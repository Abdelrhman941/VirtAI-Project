import { useCallback, useEffect, useRef } from 'react';

import { clamp, lerp, rand, randInt } from '@/shared/utils/math';

/* ── colour constants ─────────────────────────────────────── */
const TRACK_COLOR = 'rgba(109, 0, 26, 0.08)';
const PULSE_PALETTE = [
  { hex: '#B4AB8B', r: 180, g: 171, b: 139, weight: 0.6 },
  { hex: '#6D001A', r: 109, g: 0, b: 26, weight: 0.25 },
  { hex: '#F5F1EC', r: 245, g: 241, b: 236, weight: 0.15 },
];

function pickColor() {
  const r = Math.random();
  let acc = 0;
  for (const c of PULSE_PALETTE) {
    acc += c.weight;
    if (r <= acc) {
      return c;
    }
  }
  return PULSE_PALETTE[0];
}

/* ── polyline length utils ────────────────────────────────── */
function segLengths(pts) {
  const lens = [];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    lens.push(Math.sqrt(dx * dx + dy * dy));
  }
  return lens;
}

function totalLen(segs) {
  let s = 0;
  for (let i = 0; i < segs.length; i++) {
    s += segs[i];
  }
  return s;
}

function pointAtLength(pts, segs, total, d) {
  const dist = clamp(d, 0, total);
  let acc = 0;
  for (let i = 0; i < segs.length; i++) {
    if (acc + segs[i] >= dist) {
      const t = segs[i] === 0 ? 0 : (dist - acc) / segs[i];
      return {
        x: lerp(pts[i].x, pts[i + 1].x, t),
        y: lerp(pts[i].y, pts[i + 1].y, t),
      };
    }
    acc += segs[i];
  }
  return { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y };
}

/* ── path generation ──────────────────────────────────────── */
const MIN_SEG = 80;
const MAX_SEG = 400;
const CORNER_R = 8;

function generatePaths(w, h, count, minSpacing) {
  const paths = [];
  const occupied = [];

  const marginL = w * 0.25;
  const marginR = w * 0.75;

  let centerCount = 0;
  const maxCenter = randInt(3, 5);

  for (let i = 0; i < count; i++) {
    const pts = [];
    const isCenter = centerCount < maxCenter && Math.random() < 0.25;

    let x, y, dirX, dirY;
    const edge = randInt(0, 3);

    if (isCenter) {
      if (Math.random() < 0.7) {
        const fromLeft = Math.random() < 0.5;
        x = fromLeft ? 0 : w;
        y = rand(h * 0.2, h * 0.8);
        dirX = fromLeft ? 1 : -1;
        dirY = 0;
      } else {
        x = rand(marginL, marginR);
        y = Math.random() < 0.5 ? 0 : h;
        dirX = 0;
        dirY = y === 0 ? 1 : -1;
      }
      centerCount++;
    } else {
      const leftSide = Math.random() < 0.5;
      switch (edge) {
        case 0:
          x = leftSide ? rand(0, marginL) : rand(marginR, w);
          y = 0;
          dirX = 0;
          dirY = 1;
          break;
        case 1:
          x = leftSide ? rand(0, marginL) : rand(marginR, w);
          y = h;
          dirX = 0;
          dirY = -1;
          break;
        case 2:
          x = 0;
          y = rand(0, h);
          dirX = 1;
          dirY = 0;
          break;
        default:
          x = w;
          y = rand(0, h);
          dirX = -1;
          dirY = 0;
          break;
      }
    }

    pts.push({ x, y });

    const segments = randInt(5, 12);
    let cx = x,
      cy = y,
      cdx = dirX,
      cdy = dirY;

    for (let s = 0; s < segments; s++) {
      const len = rand(MIN_SEG, MAX_SEG);
      let nx = cx + cdx * len;
      let ny = cy + cdy * len;

      nx = clamp(nx, -40, w + 40);
      ny = clamp(ny, -40, h + 40);

      if (!isCenter && nx > marginL && nx < marginR) {
        nx = cx < w / 2 ? rand(0, marginL) : rand(marginR, w);
      }

      pts.push({ x: nx, y: ny });
      cx = nx;
      cy = ny;

      if (cdx !== 0) {
        cdx = 0;
        cdy = Math.random() < 0.5 ? 1 : -1;
      } else {
        cdy = 0;
        cdx = Math.random() < 0.5 ? 1 : -1;
      }
    }

    let tooClose = false;
    for (const existing of occupied) {
      for (const ep of existing) {
        for (const np of pts) {
          const dd = Math.abs(ep.x - np.x) + Math.abs(ep.y - np.y);
          if (dd < minSpacing) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) {
          break;
        }
      }
      if (tooClose) {
        break;
      }
    }
    if (tooClose && paths.length > 4) {
      continue;
    }

    const smooth = buildSmoothedPath(pts);
    const sl = segLengths(smooth);
    const tl = totalLen(sl);
    if (tl < 120) {
      continue;
    }

    paths.push({ points: smooth, segs: sl, totalLength: tl });
    const samples = [];
    for (let si = 0; si < pts.length; si += 2) {
      samples.push(pts[si]);
    }
    occupied.push(samples);
  }

  return paths;
}

function buildSmoothedPath(raw) {
  if (raw.length < 3) {
    return raw;
  }
  const out = [raw[0]];

  for (let i = 1; i < raw.length - 1; i++) {
    const prev = raw[i - 1];
    const curr = raw[i];
    const next = raw[i + 1];

    const d1x = curr.x - prev.x;
    const d1y = curr.y - prev.y;
    const d2x = next.x - curr.x;
    const d2y = next.y - curr.y;

    const len1 = Math.sqrt(d1x * d1x + d1y * d1y);
    const len2 = Math.sqrt(d2x * d2x + d2y * d2y);

    if (len1 === 0 || len2 === 0) {
      out.push(curr);
      continue;
    }

    const r = Math.min(CORNER_R, len1 / 2, len2 / 2);

    out.push({
      x: curr.x - (d1x / len1) * r,
      y: curr.y - (d1y / len1) * r,
    });

    const steps = 3;
    for (let s = 1; s <= steps; s++) {
      const t = s / (steps + 1);
      const bx = curr.x - (d1x / len1) * r * (1 - t) + (d2x / len2) * r * t;
      const by = curr.y - (d1y / len1) * r * (1 - t) + (d2y / len2) * r * t;
      out.push({ x: bx, y: by });
    }

    out.push({
      x: curr.x + (d2x / len2) * r,
      y: curr.y + (d2y / len2) * r,
    });
  }

  out.push(raw[raw.length - 1]);
  return out;
}

/* ── find intersections between paths ─────────────────────── */
function findJunctions(paths) {
  const junctions = [];
  const threshold = 6;

  for (let a = 0; a < paths.length; a++) {
    for (let b = a + 1; b < paths.length; b++) {
      const pA = paths[a].points;
      const pB = paths[b].points;
      for (let i = 0; i < pA.length; i += 3) {
        for (let j = 0; j < pB.length; j += 3) {
          const dx = pA[i].x - pB[j].x;
          const dy = pA[i].y - pB[j].y;
          if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
            junctions.push({
              x: (pA[i].x + pB[j].x) / 2,
              y: (pA[i].y + pB[j].y) / 2,
              brightness: 0,
            });
          }
        }
      }
    }
  }

  const deduped = [];
  for (const j of junctions) {
    let skip = false;
    for (const d of deduped) {
      if (Math.abs(j.x - d.x) < 20 && Math.abs(j.y - d.y) < 20) {
        skip = true;
        break;
      }
    }
    if (!skip) {
      deduped.push(j);
    }
  }
  return deduped;
}

function initPulseBase(paths) {
  return {
    pathIdx: randInt(0, paths.length - 1),
    speed: rand(0.001, 0.004),
    tailLen: rand(60, 150),
    color: pickColor(),
    opacity: rand(0.4, 0.7),
    alive: true,
    fadeOut: 0,
    fadeOutDuration: 300,
    flickerTimer: 0,
    flickerCount: 0,
    flickering: false,
  };
}

function createPulse(paths) {
  if (!paths || paths.length === 0) return null;
  return {
    ...initPulseBase(paths),
    progress: 0,
    delay: 0,
  };
}

function resetPulse(p, paths) {
  if (!paths || paths.length === 0) {
    p.alive = false;
    return;
  }
  Object.assign(p, initPulseBase(paths));
  p.progress = 0;
  p.delay = rand(500, 3000);
}

/* ════════════════════════════════════════════════════════════
    COMPONENT
   ════════════════════════════════════════════════════════════ */
export default function CircuitBoardBackground({ pulseCount = 8, opacity = 0.5, className = '' }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    paths: [],
    junctions: [],
    pulses: [],
    raf: 0,
    lastTime: 0,
    dpr: 1,
    w: 0,
    h: 0,
  });

  /* ── regenerate on resize ──────────────────────────────── */
  const regenerate = useCallback(
    (w, h) => {
      const s = stateRef.current;
      s.w = w;
      s.h = h;

      let pathCount, activePulses, spacing;
      if (w < 768) {
        pathCount = randInt(6, 10);
        activePulses = Math.min(pulseCount, randInt(4, 8));
        spacing = 50;
      } else if (w < 1024) {
        pathCount = randInt(8, 14);
        activePulses = Math.min(pulseCount, randInt(6, 12));
        spacing = 35;
      } else {
        pathCount = randInt(12, 20);
        activePulses = clamp(pulseCount, 8, 15);
        spacing = 30;
      }

      s.paths = generatePaths(w, h, pathCount, spacing);
      s.junctions = findJunctions(s.paths);

      const pool = [];
      for (let i = 0; i < activePulses; i++) {
        const p = createPulse(s.paths);
        if (p) {
          p.progress = Math.random();
          p.delay = 0;
          pool.push(p);
        }
      }
      s.pulses = pool;
    },
    [pulseCount]
  );

  /* ── main loop ─────────────────────────────────────────── */
  const draw = useCallback(function drawLoop(timestamp) {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    if (document.hidden) {
      s.raf = requestAnimationFrame(drawLoop);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const dt = s.lastTime ? timestamp - s.lastTime : 16;
    s.lastTime = timestamp;
    const { w, h, dpr, paths, junctions, pulses } = s;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = 1;

    /* ── draw static tracks ────────────────────────────── */
    ctx.strokeStyle = TRACK_COLOR;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    for (const path of paths) {
      const pts = path.points;
      if (pts.length < 2) {
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
    }

    /* ── draw junction dots (base) ─────────────────────── */
    for (const j of junctions) {
      const a = 0.15 + j.brightness * 0.45;
      ctx.beginPath();
      ctx.arc(j.x, j.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180, 171, 139, ${a})`;
      ctx.fill();

      if (j.brightness > 0) {
        j.brightness = Math.max(0, j.brightness - dt / 400);
      }
    }

    /* ── update & draw pulses ──────────────────────────── */
    for (const p of pulses) {
      if (p.delay > 0) {
        p.delay -= dt;
        continue;
      }

      if (!p.alive) {
        resetPulse(p, paths);
        continue;
      }

      const path = paths[p.pathIdx];
      if (!path) {
        resetPulse(p, paths);
        continue;
      }

      p.progress += p.speed;

      if (!p.flickering && Math.random() < 0.0006) {
        p.flickering = true;
        p.flickerCount = randInt(2, 3);
        p.flickerTimer = 0;
      }

      let eff = p.opacity;
      if (p.flickering) {
        p.flickerTimer += dt;
        const phase = Math.sin(p.flickerTimer * 0.06) > 0 ? 1 : 0.15;
        eff *= phase;
        if (p.flickerTimer > 200) {
          p.flickering = false;
          p.flickerTimer = 0;
        }
      }

      if (p.progress >= 1) {
        if (p.fadeOut === 0) {
          p.fadeOut = p.fadeOutDuration;
        }
        p.fadeOut -= dt;
        eff *= clamp(p.fadeOut / p.fadeOutDuration, 0, 1);
        if (p.fadeOut <= 0) {
          p.alive = false;
          continue;
        }
      }

      const headDist = clamp(p.progress, 0, 1) * path.totalLength;
      const tailDist = Math.max(0, headDist - p.tailLen);

      const SAMPLES = 12;
      const segPts = [];
      for (let si = 0; si <= SAMPLES; si++) {
        const d = lerp(tailDist, headDist, si / SAMPLES);
        segPts.push(pointAtLength(path.points, path.segs, path.totalLength, d));
      }

      if (segPts.length < 2) {
        continue;
      }

      const { r, g, b } = p.color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2;

      for (let si = 1; si < segPts.length; si++) {
        const t = si / (segPts.length - 1);
        const segAlpha = t * eff;
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${segAlpha})`;

        if (si === segPts.length - 1) {
          ctx.shadowBlur = 8;
          ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${eff * 0.5})`;
        } else {
          ctx.shadowBlur = 0;
          ctx.shadowColor = 'transparent';
        }

        ctx.beginPath();
        ctx.moveTo(segPts[si - 1].x, segPts[si - 1].y);
        ctx.lineTo(segPts[si].x, segPts[si].y);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';

      const head = segPts[segPts.length - 1];
      for (const j of junctions) {
        const dx = j.x - head.x;
        const dy = j.y - head.y;
        if (dx * dx + dy * dy < 400) {
          j.brightness = 1;
        }
      }
    }

    s.raf = requestAnimationFrame(drawLoop);
  }, []);

  /* ── lifecycle ─────────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const s = stateRef.current;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      s.dpr = dpr;
      regenerate(w, h);
    }

    const ro = new ResizeObserver(() => resize());
    ro.observe(document.documentElement);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (s.raf) {
          cancelAnimationFrame(s.raf);
          s.raf = 0;
        }
      } else if (!s.raf) {
        s.lastTime = 0;
        s.raf = requestAnimationFrame(draw);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          if (s.raf) {
            cancelAnimationFrame(s.raf);
            s.raf = 0;
          }
        } else {
          if (!s.raf && !document.hidden) {
            s.lastTime = 0;
            s.raf = requestAnimationFrame(draw);
          }
        }
      },
      { threshold: 0 }
    );
    io.observe(canvas);

    s.lastTime = 0;
    s.raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(s.raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [regenerate, draw]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
        opacity,
      }}
      aria-hidden="true"
    />
  );
}
