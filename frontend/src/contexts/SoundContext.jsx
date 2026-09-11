import { createContext, useContext, useEffect, useState, useCallback } from "react";

const SoundContext = createContext(null);
const SOUND_STORAGE_KEY = "mpc_sound_enabled";

// A simple Web Audio API synthesizer for 8-bit retro sounds
class SynthManager {
  constructor() {
    this.audioCtx = null;
  }

  init() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    // Resume context if suspended (browser autoplay policy)
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
  }

  playTone(freq, type, duration, vol = 0.1) {
    this.init();
    if (!this.audioCtx) return;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

    // Envelope
    gain.gain.setValueAtTime(vol, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start();
    osc.stop(this.audioCtx.currentTime + duration);
  }

  click() {
    this.playTone(800, "sine", 0.05, 0.05);
  }

  success() {
    this.init();
    if (!this.audioCtx) return;
    this.playTone(440, "square", 0.1, 0.05);
    setTimeout(() => this.playTone(660, "square", 0.2, 0.05), 100);
  }

  matchFound() {
    this.init();
    if (!this.audioCtx) return;
    this.playTone(300, "triangle", 0.1, 0.1);
    setTimeout(() => this.playTone(400, "triangle", 0.1, 0.1), 100);
    setTimeout(() => this.playTone(500, "triangle", 0.3, 0.1), 200);
  }

  win() {
    this.init();
    if (!this.audioCtx) return;
    // Arpeggio up
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, "square", 0.15, 0.08), i * 150);
    });
  }

  lose() {
    this.init();
    if (!this.audioCtx) return;
    // Descending tones
    [400, 350, 300, 250].forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, "sawtooth", 0.2, 0.08), i * 200);
    });
  }
}

const synth = new SynthManager();

export function SoundProvider({ children }) {
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(SOUND_STORAGE_KEY);
    if (saved !== null) {
      setSoundEnabled(saved === "true");
    }
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(SOUND_STORAGE_KEY, String(next));
      if (next) {
        // Play test sound when turned on to initialize AudioContext
        synth.click();
      }
      return next;
    });
  }, []);

  const playClick = useCallback(() => {
    if (soundEnabled) synth.click();
  }, [soundEnabled]);

  const playSuccess = useCallback(() => {
    if (soundEnabled) synth.success();
  }, [soundEnabled]);

  const playMatchFound = useCallback(() => {
    if (soundEnabled) synth.matchFound();
  }, [soundEnabled]);

  const playWin = useCallback(() => {
    if (soundEnabled) synth.win();
  }, [soundEnabled]);

  const playLose = useCallback(() => {
    if (soundEnabled) synth.lose();
  }, [soundEnabled]);

  return (
    <SoundContext.Provider
      value={{
        soundEnabled,
        toggleSound,
        playClick,
        playSuccess,
        playMatchFound,
        playWin,
        playLose,
      }}
    >
      {/* We intercept clicks globally to play the click sound on specific elements */}
      <div
        onClick={(e) => {
          // Play click sound if a button or link was clicked
          const target = e.target;
          if (
            target.tagName.toLowerCase() === "button" ||
            target.tagName.toLowerCase() === "a" ||
            target.closest("button") ||
            target.closest("a")
          ) {
            playClick();
          }
        }}
        style={{ height: "100%" }}
      >
        {children}
      </div>
    </SoundContext.Provider>
  );
}

export function useSound() {
  const ctx = useContext(SoundContext);
  if (!ctx) throw new Error("useSound must be used within SoundProvider");
  return ctx;
}
