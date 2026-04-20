/**
 * soundEffects.ts
 * Web Audio API synthesized sounds — no external files needed.
 * All sounds are generated on-the-fly so there's zero loading time.
 */

function getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
        return new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
        return null;
    }
}

/** Short ascending chime — used for Practice Words perfect score (<3s) */
export function playPracticeSuccessSound(): void {
    const ctx = getAudioContext();
    if (!ctx) return;

    // C5-E5-G5-C6 arpeggio with reverb tail + sparkle
    const notes = [
        { freq: 523.25, time: 0.00, dur: 0.25 },  // C5
        { freq: 659.25, time: 0.12, dur: 0.25 },  // E5
        { freq: 783.99, time: 0.24, dur: 0.25 },  // G5
        { freq: 1046.50, time: 0.36, dur: 0.45 }, // C6
        { freq: 1318.51, time: 0.52, dur: 0.55 }, // E6 (sparkle)
    ];

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.42, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.2);
    master.connect(ctx.destination);

    notes.forEach(({ freq, time, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + time);
        // Slight freq shimmer for bell-like tone
        osc.frequency.exponentialRampToValueAtTime(freq * 1.002, ctx.currentTime + time + 0.05);

        filter.type = 'bandpass';
        filter.frequency.value = freq;
        filter.Q.value = 8;

        gain.gain.setValueAtTime(0, ctx.currentTime + time);
        gain.gain.linearRampToValueAtTime(0.7, ctx.currentTime + time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + dur + 0.8);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(master);

        osc.start(ctx.currentTime + time);
        osc.stop(ctx.currentTime + time + dur + 1.0);
    });

    // Add a soft chord underneath
    const chordFreqs = [261.63, 329.63, 392.00]; // C4-E4-G4
    chordFreqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime + 0.3 + i * 0.03);
        gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.4 + i * 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.0);
        osc.connect(gain);
        gain.connect(master);
        osc.start(ctx.currentTime + 0.3);
        osc.stop(ctx.currentTime + 2.5);
    });
}

/** Majestic fanfare — used for Achievement unlock (~5s) */
export function playAchievementSound(): void {
    const ctx = getAudioContext();
    if (!ctx) return;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.38, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 5.2);
    master.connect(ctx.destination);

    // Fanfare melody — heroic ascending
    const melody = [
        { freq: 392.00, time: 0.00, dur: 0.18 }, // G4
        { freq: 523.25, time: 0.18, dur: 0.18 }, // C5
        { freq: 659.25, time: 0.36, dur: 0.18 }, // E5
        { freq: 783.99, time: 0.54, dur: 0.30 }, // G5
        { freq: 1046.50, time: 0.84, dur: 0.55 }, // C6
        { freq: 1174.66, time: 1.00, dur: 0.20 }, // D6
        { freq: 1174.66, time: 1.40, dur: 0.60 }, // D6 hold
        { freq: 1046.50, time: 2.00, dur: 1.20 }, // C6 long resolve
    ];

    melody.forEach(({ freq, time, dur }) => {
        // Main tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime + time);
        gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + time + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + dur + 0.6);
        osc.connect(gain);
        gain.connect(master);
        osc.start(ctx.currentTime + time);
        osc.stop(ctx.currentTime + time + dur + 0.8);

        // Harmonics for richness (octave up, softer)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.value = freq * 2;
        gain2.gain.setValueAtTime(0, ctx.currentTime + time);
        gain2.gain.linearRampToValueAtTime(0.12, ctx.currentTime + time + 0.03);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + dur + 0.4);
        osc2.connect(gain2);
        gain2.connect(master);
        osc2.start(ctx.currentTime + time);
        osc2.stop(ctx.currentTime + time + dur + 0.6);
    });

    // Chord pads — swell in under the melody
    const chords = [
        [261.63, 329.63, 392.00], // C-E-G
        [261.63, 349.23, 523.25], // C-F-C
        [246.94, 311.13, 392.00], // B-Eb-G (tension)
        [261.63, 329.63, 523.25], // C-E-C (resolve)
    ];
    const chordTimes = [0.5, 1.4, 2.2, 3.2];

    chords.forEach((chord, ci) => {
        chord.forEach((freq) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            const t = ctx.currentTime + chordTimes[ci];
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.09, t + 0.15);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
            osc.connect(gain);
            gain.connect(master);
            osc.start(t);
            osc.stop(t + 2.0);
        });
    });

    // Ascending sparkle run at end
    const sparkle = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00];
    sparkle.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t = ctx.currentTime + 3.8 + i * 0.08;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.25 - i * 0.02, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc.connect(gain);
        gain.connect(master);
        osc.start(t);
        osc.stop(t + 0.7);
    });
}
