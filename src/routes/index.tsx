import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import logoAltSrc from "@/assets/logo-alt-alpha.png";
import logoNeuSrc from "@/assets/logo-alpha.png";
import logoBOnlySrc from "@/assets/logo-b-only.png";

// TODO: Vor Deployment durch endgültige Domain der neuen Website ersetzen.
const NEW_WEBSITE_URL = "https://www.b2interior.de";

const REDIRECT_DELAY_MS = 8000;
const FADE_OUT_MS = 500;

// Choreografie der Marken-Verwandlung (alt -> neu)
const PHASE1_DELAY_MS = 2200; // Alt-Logo loslassen; "b" blendet ein, Quadrat fliegt
const MORPH_DELAY_MS = 3050; // Quadrat wird schwarz, Fadenkreuze verblassen
const RESOLVE_DELAY_MS = 3700; // Quadrat löst sich in die echte "2" auf (Crossfade)
const PHASE2_DELAY_MS = 4050; // Headline + Countdown ein

// Feature-Geometrie (aus den Logos vermessen, normalisiert auf die jeweilige Box)
const ALT_ASPECT = 1337 / 1100; // 1.2156
const NEU_ASPECT = 1843 / 1368; // 1.3472
const SQUARES_CX = 0.3222; // Zentrum der roten Quadrate im Alt-Logo
const SQUARES_CY = 0.1679;
const SUP2_CX = 0.7607; // Zentrum des "²" im Neu-Logo
const SUP2_CY = 0.3728;

const BRAND_RED = "#dd0025";

const STAGE_TRANSFORM_EASE = "cubic-bezier(0.65, 0, 0.35, 1)";

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

type Coords = { sx: number; sy: number; ex: number; ey: number; size: number };

function IntroScreen() {
  // Animationsphasen
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState(0); // 0 = Alt-Logo, 1 = Übergang/Flug, 2 = gesetzt
  const [morphed, setMorphed] = useState(false); // Quadrat -> schwarz, Fadenkreuze weg
  const [resolved, setResolved] = useState(false); // Quadrat -> echte "2"

  // Countdown / Redirect
  const [secondsLeft, setSecondsLeft] = useState(
    Math.ceil(REDIRECT_DELAY_MS / 1000),
  );
  const [fadingOut, setFadingOut] = useState(false);

  // Präferenzen
  const [reduceMotion, setReduceMotion] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [skipFocused, setSkipFocused] = useState(false);

  // Mess-Refs für den Flug des Quadrats
  const stageRef = useRef<HTMLDivElement>(null);
  const oldAnchorRef = useRef<HTMLDivElement>(null);
  const newAnchorRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<Coords | null>(null);

  // Countdown-Refs
  const progressRef = useRef<HTMLDivElement>(null);
  const elapsedRef = useRef(0);
  const lastTickRef = useRef<number>(0);
  const finishedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Media-Queries
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

  // Warmer "Alt-Marken"-Hintergrund zu Beginn; geht zur Zielpalette über.
  const STAGE_BG_START = "#F5F3EE";

  // Phasen-Taktung
  useEffect(() => {
    if (reduceMotion) {
      setPhase(2);
      setMorphed(true);
      setResolved(true);
      return;
    }
    const t1 = setTimeout(() => setPhase(1), PHASE1_DELAY_MS);
    const tm = setTimeout(() => setMorphed(true), MORPH_DELAY_MS);
    const tr = setTimeout(() => setResolved(true), RESOLVE_DELAY_MS);
    const t2 = setTimeout(() => setPhase(2), PHASE2_DELAY_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(tm);
      clearTimeout(tr);
      clearTimeout(t2);
    };
  }, [reduceMotion]);

  // Flug-Geometrie vermessen (Start = rote Quadrate, Ziel = "²"), responsiv.
  const measure = useCallback(() => {
    const stage = stageRef.current;
    const a = oldAnchorRef.current;
    const b = newAnchorRef.current;
    if (!stage || !a || !b) return;
    const s = stage.getBoundingClientRect();
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    const size = s.height * 0.34; // Kantenlänge ~ Höhe des "²"
    setCoords({
      sx: ar.left + ar.width / 2 - s.left,
      sy: ar.top + ar.height / 2 - s.top,
      ex: br.left + br.width / 2 - s.left,
      ey: br.top + br.height / 2 - s.top,
      size,
    });
  }, []);

  useLayoutEffect(() => {
    if (!mounted) return;
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [mounted, measure]);

  // Countdown via requestAnimationFrame (pausiert bei verstecktem Tab)
  useEffect(() => {
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
  }, []);

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

  // Fliegendes Quadrat: Transform je nach Phase
  const squareTransform = (() => {
    if (!coords) return "translate(-9999px, -9999px)";
    const { sx, sy, ex, ey, size } = coords;
    const half = size / 2;
    if (phase >= 1) {
      // Zielposition = "²", aufgerichtet, exakte Größe
      return `translate(${ex - half}px, ${ey - half}px) rotate(0deg) scale(1)`;
    }
    // Startposition = rote Quadrate, leicht gekippt
    return `translate(${sx - half}px, ${sy - half}px) rotate(-11deg) scale(0.92)`;
  })();

  const showSquare = !reduceMotion && phase >= 1 && !resolved;
  const squareColor = morphed ? palette.ink : BRAND_RED;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Zur neuen Website weiterleiten"
      onClick={skipNow}
      className="fixed inset-0 cursor-pointer overflow-hidden"
      style={{
        backgroundColor: phase >= 1 ? palette.bg : STAGE_BG_START,
        color: palette.fg,
        opacity: fadingOut ? 0 : 1,
        transition: `opacity ${FADE_OUT_MS}ms ease-out, background-color 900ms ease, color 700ms ease`,
      }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Bühne: hält beide Logos + das fliegende Quadrat im selben Koordinatenraum */}
      {/* ------------------------------------------------------------------ */}
      <div
        ref={stageRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "50%",
          top: "37%",
          transform: "translate(-50%, -50%)",
          height: "min(44vh, 340px)",
          aspectRatio: String(NEU_ASPECT),
          pointerEvents: "none",
        }}
      >
        {/* Altes Logo (Bühler Einrichtungen) */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            height: "100%",
            aspectRatio: String(ALT_ASPECT),
            opacity: !reduceMotion && phase === 0 && mounted ? 1 : 0,
            transition: "opacity 600ms ease",
          }}
        >
          <img
            src={logoAltSrc}
            alt=""
            draggable={false}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
          {/* Anker = Zentrum der roten Quadrate */}
          <div
            ref={oldAnchorRef}
            style={{
              position: "absolute",
              left: `${SQUARES_CX * 100}%`,
              top: `${SQUARES_CY * 100}%`,
              width: 0,
              height: 0,
            }}
          />
        </div>

        {/* Neues Logo — als Maske eingefärbt (Light/Dark). Zwei Ebenen:
            unten nur das "b", oben das volle "b²". Das fliegende Quadrat
            spielt den Exponenten, dann blendet die echte "2" per Crossfade ein. */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            height: "100%",
            aspectRatio: String(NEU_ASPECT),
          }}
        >
          {/* Ebene 1: nur "b" */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: palette.ink,
              WebkitMaskImage: `url(${logoBOnlySrc})`,
              maskImage: `url(${logoBOnlySrc})`,
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              maskPosition: "center",
              WebkitMaskSize: "contain",
              maskSize: "contain",
              opacity: reduceMotion ? 0 : phase >= 1 ? 1 : 0,
              transition: "opacity 700ms ease 250ms, background-color 700ms ease",
            }}
          />
          {/* Ebene 2: volles "b²" (inkl. echter "2") */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: palette.ink,
              WebkitMaskImage: `url(${logoNeuSrc})`,
              maskImage: `url(${logoNeuSrc})`,
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              maskPosition: "center",
              WebkitMaskSize: "contain",
              maskSize: "contain",
              opacity: reduceMotion || resolved ? 1 : 0,
              transition: "opacity 400ms ease, background-color 700ms ease",
            }}
          />
          {/* Anker = Zentrum des "²" */}
          <div
            ref={newAnchorRef}
            style={{
              position: "absolute",
              left: `${SUP2_CX * 100}%`,
              top: `${SUP2_CY * 100}%`,
              width: 0,
              height: 0,
            }}
          />
        </div>

        {/* Fliegendes Quadrat: rote Marken-Kachel -> schwarzes "²" */}
        {coords && (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: coords.size,
              height: coords.size,
              transformOrigin: "center",
              transform: squareTransform,
              opacity: showSquare ? 1 : 0,
              color: squareColor,
              willChange: "transform, opacity, color",
              transition: `transform 1200ms ${STAGE_TRANSFORM_EASE}, color 500ms ease, opacity 400ms ease`,
            }}
          >
            <BrandSquare crosshairs={!morphed} />
          </div>
        )}
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
          opacity: phase >= 2 ? 1 : 0,
          transform: phase >= 2 ? "translateY(0)" : "translateY(12px)",
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
          opacity: phase >= 2 ? 1 : 0,
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

/**
 * Die ikonische Bühler-Kachel: ein Quadrat mit Fadenkreuz-/Passermarken an den
 * Ecken. Fläche = currentColor (rot -> schwarz), Marken blenden beim Morph aus.
 */
function BrandSquare({ crosshairs }: { crosshairs: boolean }) {
  const TICK = 13; // Überstand der Fadenkreuz-Linien
  const corners = [
    [18, 18],
    [82, 18],
    [18, 82],
    [82, 82],
  ];
  return (
    <svg
      viewBox="0 0 100 100"
      width="100%"
      height="100%"
      style={{ overflow: "visible", display: "block" }}
    >
      <rect x={18} y={18} width={64} height={64} fill="currentColor" />
      <g
        stroke="#1a1a1a"
        strokeWidth={2.4}
        style={{
          opacity: crosshairs ? 0.92 : 0,
          transition: "opacity 350ms ease",
        }}
      >
        {corners.map(([cx, cy], i) => (
          <g key={i}>
            <line x1={cx - TICK} y1={cy} x2={cx + TICK} y2={cy} />
            <line x1={cx} y1={cy - TICK} x2={cx} y2={cy + TICK} />
          </g>
        ))}
      </g>
    </svg>
  );
}
