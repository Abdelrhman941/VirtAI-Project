import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { FiMenu, FiX } from 'react-icons/fi';
import { Link } from 'react-router-dom';

const NAV_ITEMS = [
  { label: 'Features', target: 'features' },
  { label: 'Tech Stack', target: 'tech-stack' },
  { label: 'FAQs', target: 'faq' },
];

export default function Navbar({ ctaLabel, ctaTo }: { ctaLabel: string; ctaTo: string }) {
  const [visible, setVisible] = useState(false);
  const [activeId, setActiveId] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isScrolling = useRef(false);

  /* show/hide based on scroll past hero */
  useEffect(() => {
    let ticking = false;
    const scrollContainer = document.getElementById('main-scroll-container') || window;

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollTop = scrollContainer === window
            ? window.scrollY
            : (scrollContainer as HTMLElement).scrollTop;
           
          setVisible(scrollTop > window.innerHeight * 0.6);
          ticking = false;
        });
        ticking = true;
      }
    };

    const initialScrollTop = scrollContainer === window
      ? window.scrollY
      : (scrollContainer as HTMLElement).scrollTop;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(initialScrollTop > window.innerHeight * 0.6);

    scrollContainer.addEventListener('scroll', onScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', onScroll);
  }, []);

  /* highlight active section via IntersectionObserver */
  useEffect(() => {
    const ids = NAV_ITEMS.map((n) => n.target);
    const visibleSections = new Set();

    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrolling.current) {
          return;
        }

        let hasChanges = false;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleSections.add(entry.target.id);
            hasChanges = true;
          } else {
            visibleSections.delete(entry.target.id);
            hasChanges = true;
          }
        }

        if (hasChanges) {
          if (visibleSections.size === 0) {
             
            setActiveId('');
          } else {
            const visibleArray = Array.from(visibleSections);
            const active = ids.find((id) => visibleArray.includes(id));
            if (active) {
               
              setActiveId(active);
            }
          }
        }
      },
      { rootMargin: '-40% 0px -55% 0px' }
    );

    const observed = new Set<string>();
    const observeElements = () => {
      ids.forEach((id) => {
        if (!observed.has(id)) {
          const el = document.getElementById(id);
          if (el) {
            observer.observe(el);
            observed.add(id);
          }
        }
      });
    };

    observeElements();

    let mutationObserver: MutationObserver | null = null;
    let fallbackTimeout: ReturnType<typeof setTimeout> | null = null;

    if (observed.size < ids.length) {
      mutationObserver = new MutationObserver(() => {
        observeElements();
        if (observed.size === ids.length && mutationObserver) {
          mutationObserver.disconnect();
          mutationObserver = null;
          if (fallbackTimeout) clearTimeout(fallbackTimeout);
        }
      });

      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });

      // Failsafe: if chunks fail to load, disconnect after 10 seconds to prevent infinite listening
      fallbackTimeout = setTimeout(() => {
        if (mutationObserver) {
          mutationObserver.disconnect();
          mutationObserver = null;
        }
      }, 10000);
    }

    return () => {
      observer.disconnect();
      if (mutationObserver) {
        mutationObserver.disconnect();
      }
      if (fallbackTimeout) {
        clearTimeout(fallbackTimeout);
      }
    };
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) {
      return;
    }

    isScrolling.current = true;
     
    setActiveId(id);
     
    setMobileMenuOpen(false);

    const offset = 80;
    const lenis = (window as any).lenis;
    if (lenis) {
      lenis.scrollTo(el, { offset });
    } else {
      const scrollContainer = document.getElementById('main-scroll-container');
      if (scrollContainer) {
        const elementTop = el.getBoundingClientRect().top;
        const containerTop = scrollContainer.getBoundingClientRect().top;
        const y = scrollContainer.scrollTop + elementTop - containerTop - offset;
        scrollContainer.scrollTo({ top: y, behavior: 'smooth' });
      } else {
        const y = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }

    // Release lock after smooth scroll completes
     
    setTimeout(() => {
      isScrolling.current = false;
    }, 800);
  };

  const scrollToTop = () => {
     
    setMobileMenuOpen(false);
    const lenis = (window as any).lenis;
    if (lenis) {
      lenis.scrollTo(0);
    } else {
      const scrollContainer = document.getElementById('main-scroll-container');
      if (scrollContainer) {
        scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Desktop & Tablet Navbar */}
          <motion.nav
            key="navbar"
            initial={{ y: -72, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -72, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className="fixed top-0 right-0 left-0 z-50 flex h-16 items-center justify-between border-b border-white/10 bg-dark/80 px-6 backdrop-blur-md"
          >
            {/* logo */}
            <button
              onClick={scrollToTop}
              aria-label="VirtAI — Scroll to top"
              className="flex shrink-0 cursor-pointer items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70 focus-visible:ring-offset-2 focus-visible:ring-offset-dark rounded-lg"
            >
              <span className="text-lg font-semibold tracking-wide text-offwhite font-display">
                VirtAI
              </span>
            </button>

            {/* Desktop nav links and CTA (hidden below md: 768px) */}
            <div className="hidden md:flex items-center gap-8">
              <ul className="flex items-center gap-8">
                {NAV_ITEMS.map(({ label, target }) => (
                  <li key={target}>
                    <a
                      href={`#${target}`}
                      onClick={(e) => {
                        e.preventDefault();
                        scrollTo(target);
                      }}
                      className="relative block cursor-pointer px-1 py-2 text-sm font-medium tracking-wide transition-colors duration-200 font-display focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70 focus-visible:ring-offset-2 focus-visible:ring-offset-dark rounded-md"
                      style={{
                        color: activeId === target ? '#B4AB8B' : '#f5f1ec',
                      }}
                    >
                      {label}
                      {activeId === target && (
                        <motion.span
                          layoutId="nav-underline"
                          className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-gold"
                          transition={{ type: 'tween', ease: [0.2, 0.8, 0.2, 1], duration: 0.3 }}
                        />
                      )}
                    </a>
                  </li>
                ))}
              </ul>

              {/* Primary CTA Button */}
              <Link
                to={ctaTo || '/'}
                className="inline-flex cursor-pointer items-center justify-center rounded-full bg-gold px-5 py-2 text-sm font-semibold tracking-wide text-dark transition-[background-color,transform,box-shadow] duration-200 hover:bg-gold-soft hover:scale-[1.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70 focus-visible:ring-offset-2 focus-visible:ring-offset-dark font-display"
              >
                {ctaLabel || 'Get Started'}
              </Link>
            </div>

            {/* Mobile hamburger button (visible below md: 768px) */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              className="md:hidden w-12 h-12 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70 focus-visible:ring-offset-2 focus-visible:ring-offset-dark"
            >
              {mobileMenuOpen ? (
                <FiX className="w-6 h-6 text-offwhite" />
              ) : (
                <FiMenu className="w-6 h-6 text-offwhite" />
              )}
            </button>
          </motion.nav>

          {/* Mobile Menu Drawer */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <>
                {/* Backdrop */}
                <motion.div
                  key="backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-0 z-40 bg-black/40 md:hidden"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-hidden="true"
                />

                {/* Menu */}
                <motion.div
                  key="mobile-menu"
                  initial={{ x: '100%', opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: '100%', opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                  className="fixed top-16 right-0 bottom-0 z-40 w-full max-w-xs bg-dark/95 backdrop-blur-md border-l border-white/10 flex flex-col md:hidden"
                >
                  <nav className="flex-1 flex flex-col gap-2 p-6">
                    <p className="text-xs font-semibold text-offwhite/60 uppercase tracking-widest mb-4">
                      Navigation
                    </p>
                    {NAV_ITEMS.map(({ label, target }) => (
                      <button
                        key={target}
                        onClick={() => scrollTo(target)}
                        className={`text-left px-4 py-3 rounded-lg font-medium transition-colors font-display focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70 focus-visible:ring-offset-2 focus-visible:ring-offset-dark ${activeId === target
                          ? 'bg-gold/15 text-gold font-semibold'
                          : 'text-offwhite/80 hover:bg-white/10'
                          }`}
                      >
                        {label}
                      </button>
                    ))}
                  </nav>

                  {/* Mobile CTA Button */}
                  <div className="p-6 border-t border-white/10">
                    <Link
                      to={ctaTo}
                      className="inline-flex w-full cursor-pointer items-center justify-center rounded-full bg-gold px-6 py-3 text-sm font-semibold tracking-wide text-dark transition-[background-color,transform,box-shadow] duration-200 hover:bg-gold-soft hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70 focus-visible:ring-offset-2 focus-visible:ring-offset-dark font-display"
                    >
                      {ctaLabel}
                    </Link>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}
