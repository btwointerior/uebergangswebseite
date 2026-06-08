import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import logoAltSrc from "@/assets/logo-alt-alpha.png";
import logoNeuSrc from "@/assets/logo-alpha.png";

// TODO: Vor Deployment durch endgültige Domain der neuen Website ersetzen.
const NEW_WEBSITE_URL = "https://www.b2interior.de";

const FADE_OUT_MS = 450;

// Choreografie: altes Logo -> (blass + Drehung) -> neues Logo -> Text.
// Alle Zeiten ab dem Moment, in dem das Alt-Logo wirklich sichtbar ist
// (nicht ab Seitenstart) — so sieht man den Anfang garantiert klar.
const FLIP_DELAY_MS = 4500; // Alt-Logo steht lange klar und deutlich
const FLIP_MS = 1700; // Dauer der 3D-Drehung (langsam, gut sichtbar)
const PHASE2_DELAY_MS = FLIP_DELAY_MS + FLIP_MS - 250; // Text kurz vor Drehungsende
const REDIRECT_DELAY_MS = 7800; // danach zügig zur neuen Website
// Falls das Logo-Bild nie "load" meldet (Cache/Fehler): trotzdem starten.
const START_FALLBACK_MS = 2200;

const ALT_ASPECT = 1337 / 1100; // 1.2156
const NEU_ASPECT = 1843 / 1368; // 1.3472

const FLIP_EASE = "cubic-bezier(0.65, 0, 0.35, 1)";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "bühler² interior — neuer Name, neue Website" },
      {
        name: "description",
        content:
          "Aus Bühler Einrichtungen wird bühler² interior. Sie werden automatisch zur neuen Website weitergeleitet.",
      },
    ],
  }),
  component: IntroScreen,
});

function IntroScreen() {
  const [oldLoaded, setOldLoaded] = useState(false); // Alt-Logo-Bild geladen
  const [started, setStarted] = useState(false); // Choreografie + Countdown laufen
  const [flipping, setFlipping] = useState(false); // 3D-Drehung läuft/erfolgt
  const [phase2, setPhase2] = useState(false); // neues Logo gesetzt, Text ein

  const oldImgRef = useRef<HTMLImageElement>(null);

  // Countdown / Redirect
  const [secondsLeft, setSecondsLeft] = useState(
    Math.ceil(REDIRECT_DELAY_MS / 1000),
  );
  const [fadingOut, setFadingOut] = useState(false);

  // Präferenzen
  const [reduceMotion, setReduceMotion] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [skipFocused, setSkipFocused] = useState(false);

  const progressRef = useRef<HTMLDivElement>(null);
  const elapsedRef = useRef(0);
  const lastTickRef = useRef<number>(0);
  const finishedRef = useRef(false);

  // Start an "Alt-Logo sichtbar" koppeln (Bild geladen) — mit Fallback,
  // falls onLoad nicht feuert (z. B. aus dem Cache schon "complete").
  useEffect(() => {
    if (oldImgRef.current?.complete) setOldLoaded(true);
    const fb = setTimeout(() => setOldLoaded(true), START_FALLBACK_MS);
    return () => clearTimeout(fb);
  }, []);

  useEffect(() => {
    if (oldLoaded) setStarted(true);
  }, [oldLoaded]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDarkMode(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setDarkMode(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const palette = darkMode
    ? {
        bg: "#1a1816",
        fg: "#F5F3EE",
        fgMuted: "#9c9890",
        ink: "#F5F3EE",
        progressTrack: "rgba(245, 243, 238, 0.08)",
        progressFill: "rgba(245, 243, 238, 0.7)",
      }
    : {
        bg: "#F5F3EE",
        fg: "#1a1a1a",
        fgMuted: "#5a5752",
        ink: "#1a1a1a",
        progressTrack: "rgba(26, 26, 26, 0.08)",
        progressFill: "rgba(26, 26, 26, 0.7)",
      };

  const STAGE_BG_START = "#F5F3EE"; // warme Alt-Marken-Fläche zu Beginn

  // Phasen-Taktung — erst ab "started" (Alt-Logo sichtbar)
  useEffect(() => {
    if (reduceMotion) {
      setStarted(true);
      setFlipping(true);
      setPhase2(true);
      return;
    }
    if (!started) return;
    const tf = setTimeout(() => setFlipping(true), FLIP_DELAY_MS);
    const t2 = setTimeout(() => setPhase2(true), PHASE2_DELAY_MS);
    return () => {
      clearTimeout(tf);
      clearTimeout(t2);
    };
  }, [started, reduceMotion]);

  // Countdown via requestAnimationFrame (pausiert bei verstecktem Tab) —
  // startet erst, wenn die Choreografie startet (Alt-Logo sichtbar).
  useEffect(() => {
    if (!started) return;
    let rafId = 0;
    let cancelled = false;
    lastTickRef.current = performance.now();

    const tick = () => {
      if (cancelled) return;
      const now = performance.now();
      const dt = now - lastTickRef.current;
      lastTickRef.current = now;
      if (document.visibilityState === "visible") {
        elapsedRef.current += dt;
      }
      const remaining = Math.max(0, REDIRECT_DELAY_MS - elapsedRef.current);
      const sec = Math.ceil(remaining / 1000);
      setSecondsLeft((prev) => (prev !== sec ? sec : prev));
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${remaining / REDIRECT_DELAY_MS})`;
      }
      if (remaining <= FADE_OUT_MS && !finishedRef.current) {
        setFadingOut(true);
      }
      if (remaining <= 0 && !finishedRef.current) {
        finishedRef.current = true;
        window.location.href = NEW_WEBSITE_URL;
        return;
      }
      rafId = requestAnimationFrame(tick);
    };

    const onVisibility = () => {
      lastTickRef.current = performance.now();
    };
    document.addEventListener("visibilitychange", onVisibility);
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [started]);

  const skipNow = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setFadingOut(true);
    setTimeout(() => {
      window.location.href = NEW_WEBSITE_URL;
    }, FADE_OUT_MS);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
        e.preventDefault();
        skipNow();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [skipNow]);

  // 3D-Drehung: Vorderseite (alt) dreht weg, Rückseite (neu) kommt zum Vorschein
  const cardRotation = flipping ? 180 : 0;

  const faceBase: React.CSSProperties = {
    position: "absolute",
    left: "50%",
    top: "50%",
    height: "100%",
    transform: "translate(-50%, -50%)",
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Zur neuen Website weiterleiten"
      data-phase={!started ? "init" : phase2 ? "2" : flipping ? "1" : "0"}
      onClick={skipNow}
      className="fixed inset-0 cursor-pointer overflow-hidden"
      style={{
        backgroundColor: flipping ? palette.bg : STAGE_BG_START,
        color: palette.fg,
        opacity: fadingOut ? 0 : 1,
        transition: `opacity ${FADE_OUT_MS}ms ease-out, background-color 900ms ease, color 700ms ease`,
      }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Bühne mit 3D-Perspektive: das Logo dreht sich von alt zu neu */}
      {/* ------------------------------------------------------------------ */}
      <div
        aria-label="bühler² interior"
        style={{
          position: "absolute",
          left: "50%",
          top: "37%",
          transform: "translate(-50%, -50%)",
          height: "min(42vh, 320px)",
          aspectRatio: String(NEU_ASPECT),
          perspective: "1400px",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            transformStyle: "preserve-3d",
            transform: `rotateY(${cardRotation}deg)`,
            transition: reduceMotion
              ? "none"
              : `transform ${FLIP_MS}ms ${FLIP_EASE}`,
          }}
        >
          {/* Vorderseite: altes Logo (Bühler Einrichtungen) */}
          <div
            style={{
              ...faceBase,
              aspectRatio: String(ALT_ASPECT),
              // kurz vor/während der Drehung blass werden
              filter: flipping ? "grayscale(1)" : "grayscale(0)",
              opacity: reduceMotion ? 0 : flipping ? 0.35 : 1,
              transition: "filter 700ms ease, opacity 700ms ease",
            }}
          >
            <img
              ref={oldImgRef}
              src={logoAltSrc}
              alt=""
              draggable={false}
              onLoad={() => setOldLoaded(true)}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </div>

          {/* Rückseite: neues Logo (b²), eingefärbt für Light/Dark */}
          <div
            style={{
              ...faceBase,
              aspectRatio: String(NEU_ASPECT),
              transform: "translate(-50%, -50%) rotateY(180deg)",
              backgroundColor: palette.ink,
              WebkitMaskImage: `url(${logoNeuSrc})`,
              maskImage: `url(${logoNeuSrc})`,
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              maskPosition: "center",
              WebkitMaskSize: "contain",
              maskSize: "contain",
              transition: "background-color 700ms ease",
            }}
          />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Headline + Countdown */}
      {/* ------------------------------------------------------------------ */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "62%",
          textAlign: "center",
          padding: "0 24px",
          opacity: phase2 ? 1 : 0,
          transform: phase2 ? "translateY(0)" : "translateY(12px)",
          transition: "opacity 800ms ease-out, transform 800ms ease-out",
        }}
      >
        <h1
          style={{
            fontSize: "clamp(2rem, 6vw, 4.5rem)",
            fontWeight: 300,
            letterSpacing: "0.01em",
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          Aus Bühler Einrichtungen wird bühler² interior.
        </h1>
        <p
          style={{
            marginTop: "1.5rem",
            fontSize: "clamp(0.875rem, 1.4vw, 1.05rem)",
            fontWeight: 400,
            letterSpacing: "0.04em",
            color: palette.fgMuted,
          }}
        >
          Sie werden in {secondsLeft} Sekunde
          {secondsLeft === 1 ? "" : "n"} zur neuen Website weitergeleitet.
        </p>
      </div>

      {/* Skip */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          skipNow();
        }}
        onMouseEnter={() => setSkipFocused(true)}
        onMouseLeave={() => setSkipFocused(false)}
        onFocus={() => setSkipFocused(true)}
        onBlur={() => setSkipFocused(false)}
        style={{
          position: "absolute",
          right: "clamp(16px, 4vw, 32px)",
          bottom: "clamp(16px, 4vw, 32px)",
          background: "transparent",
          border: "none",
          padding: "8px 0",
          fontSize: "0.95rem",
          fontWeight: 400,
          letterSpacing: "0.06em",
          color: palette.fg,
          cursor: "pointer",
          fontFamily: "inherit",
          opacity: phase2 ? 1 : 0,
          textDecoration: skipFocused ? "underline" : "none",
          textUnderlineOffset: "6px",
          textDecorationThickness: "1px",
          outline: "none",
          transition:
            "opacity 800ms ease-out, text-decoration-color 200ms ease, color 600ms ease",
        }}
      >
        Jetzt zur Website →
      </button>

      {/* Fortschrittsbalken */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "1px",
          backgroundColor: palette.progressTrack,
        }}
      >
        <div
          ref={progressRef}
          style={{
            height: "100%",
            backgroundColor: palette.progressFill,
            transformOrigin: "left center",
            transform: "scaleX(1)",
            willChange: "transform",
            transition: "background-color 600ms ease",
          }}
        />
      </div>
    </div>
  );
}
