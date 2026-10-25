// Procedural Sound & Music System using Web Audio API
class SoundEngine {
    constructor() {
        this.ctx = null;
        this.bgmGain = null;
        this.sfxGain = null;
        this.isMuted = false;
        this.bgmPlaying = false;
        this.bgmTimer = null;
        this.inCombat = false;
    }

    init() {
        if (this.ctx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.7;
        this.masterGain.connect(this.ctx.destination);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.8;
        this.sfxGain.connect(this.masterGain);

        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.value = 0.35;
        this.bgmGain.connect(this.masterGain);

        this.startBGM();
    }

    toggleMute() {
        if (!this.ctx) this.init();
        this.isMuted = !this.isMuted;
        if (this.masterGain) {
            this.masterGain.gain.value = this.isMuted ? 0 : 0.7;
        }
        return this.isMuted;
    }

    // SFX Methods
    playSwordSwing() {
        if (!this.ctx || this.isMuted) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(450, t);
        osc.frequency.exponentialRampToValueAtTime(110, t + 0.15);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, t);
        filter.frequency.exponentialRampToValueAtTime(300, t + 0.15);

        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(t);
        osc.stop(t + 0.15);
    }

    playHit() {
        if (!this.ctx || this.isMuted) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);

        gain.gain.setValueAtTime(0.7, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.12);
    }

    playPyroSkill() {
        if (!this.ctx || this.isMuted) return;
        const t = this.ctx.currentTime;
        // White noise whoosh + low boom
        const bufferSize = this.ctx.sampleRate * 0.4;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(300, t);
        filter.frequency.exponentialRampToValueAtTime(1200, t + 0.2);
        filter.frequency.exponentialRampToValueAtTime(200, t + 0.4);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.8, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        noise.start(t);
    }

    playHydroSkill() {
        if (!this.ctx || this.isMuted) return;
        const t = this.ctx.currentTime;
        // High harmonic liquid bubble / splash
        [600, 900, 1200].forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t + idx * 0.04);
            osc.frequency.exponentialRampToValueAtTime(freq * 1.6, t + 0.15 + idx * 0.04);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.8, t + 0.35 + idx * 0.04);

            gain.gain.setValueAtTime(0.3, t + idx * 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35 + idx * 0.04);

            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(t + idx * 0.04);
            osc.stop(t + 0.4 + idx * 0.04);
        });
    }

    playElectroSkill() {
        if (!this.ctx || this.isMuted) return;
        const t = this.ctx.currentTime;
        // Buzzing high freq saw zaps
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.linearRampToValueAtTime(1760, t + 0.08);
        osc.frequency.linearRampToValueAtTime(300, t + 0.25);

        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.25);
    }

    playAnemoSkill() {
        if (!this.ctx || this.isMuted) return;
        const t = this.ctx.currentTime;
        // Swirling wind sound
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(250, t);
        osc.frequency.exponentialRampToValueAtTime(850, t + 0.2);
        osc.frequency.exponentialRampToValueAtTime(180, t + 0.5);

        gain.gain.setValueAtTime(0.6, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.5);
    }

    playReaction() {
        if (!this.ctx || this.isMuted) return;
        const t = this.ctx.currentTime;
        // Crystalline sparkle chime (Genshin elemental reaction chime)
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, t + idx * 0.05);

            gain.gain.setValueAtTime(0.35, t + idx * 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.05 + 0.4);

            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(t + idx * 0.05);
            osc.stop(t + idx * 0.05 + 0.4);
        });
    }

    playDash() {
        if (!this.ctx || this.isMuted) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.18);

        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.18);
    }

    playChestOpen() {
        if (!this.ctx || this.isMuted) return;
        const t = this.ctx.currentTime;
        // Genshin chest open fanfare
        const chord = [392.00, 523.25, 659.25, 783.99, 1046.50]; // G4, C5, E5, G5, C6
        chord.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, t + i * 0.08);

            gain.gain.setValueAtTime(0.35, t + i * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.7);

            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(t + i * 0.08);
            osc.stop(t + i * 0.08 + 0.7);
        });
    }

    playCollect() {
        if (!this.ctx || this.isMuted) return;
        const t = this.ctx.currentTime;
        const notes = [880, 1320];
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t + i * 0.06);
            gain.gain.setValueAtTime(0.3, t + i * 0.06);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.3);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(t + i * 0.06);
            osc.stop(t + i * 0.06 + 0.3);
        });
    }

    playBurst() {
        if (!this.ctx || this.isMuted) return;
        const t = this.ctx.currentTime;
        // Dramatic low boom + rising high shimmer
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.exponentialRampToValueAtTime(600, t + 0.4);
        gain.gain.setValueAtTime(0.6, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.6);
    }

    playWishStar(isGold = false) {
        if (!this.ctx || this.isMuted) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = isGold ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(isGold ? 587.33 : 440, t);
        osc.frequency.exponentialRampToValueAtTime(isGold ? 1760 : 880, t + 0.8);

        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 1.2);

        if (isGold) {
            // Golden shimmer chords
            [783.99, 987.77, 1174.66, 1567.98].forEach((f, i) => {
                const o = this.ctx.createOscillator();
                const g = this.ctx.createGain();
                o.type = 'triangle';
                o.frequency.setValueAtTime(f, t + 0.8 + i * 0.07);
                g.gain.setValueAtTime(0.4, t + 0.8 + i * 0.07);
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.8 + i * 0.07 + 1.5);
                o.connect(g);
                g.connect(this.sfxGain);
                o.start(t + 0.8 + i * 0.07);
                o.stop(t + 0.8 + i * 0.07 + 1.5);
            });
        }
    }

    // Procedural Ambient Music Generator (Mondstadt & Genshin style harp/piano chords)
    startBGM() {
        if (this.bgmPlaying || !this.ctx) return;
        this.bgmPlaying = true;

        // Chords progression: Cmaj9 -> Fmaj7 -> Am7 -> Gsus4
        const chordProgression = [
            [261.63, 329.63, 392.00, 493.88, 587.33], // Cmaj9
            [174.61, 261.63, 329.63, 392.00, 440.00], // Fmaj7
            [220.00, 261.63, 329.63, 392.00, 523.25], // Am7
            [196.00, 293.66, 392.00, 440.00, 587.33]  // Gsus4
        ];

        let chordIndex = 0;

        const playNextChord = () => {
            if (!this.bgmPlaying || !this.ctx || this.isMuted) {
                this.bgmTimer = setTimeout(playNextChord, 4000);
                return;
            }

            const now = this.ctx.currentTime;
            const currentChord = chordProgression[chordIndex];
            chordIndex = (chordIndex + 1) % chordProgression.length;

            // Arpeggiate chord notes smoothly like a harp
            currentChord.forEach((freq, noteIdx) => {
                const noteTime = now + noteIdx * 0.35 + (Math.random() * 0.05);
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                // Gentle sine/triangle tone
                osc.type = noteIdx % 2 === 0 ? 'sine' : 'triangle';
                osc.frequency.setValueAtTime(freq, noteTime);

                const duration = 2.8;
                gain.gain.setValueAtTime(0.001, noteTime);
                gain.gain.linearRampToValueAtTime(0.12, noteTime + 0.3);
                gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + duration);

                osc.connect(gain);
                gain.connect(this.bgmGain);

                osc.start(noteTime);
                osc.stop(noteTime + duration);
            });

            this.bgmTimer = setTimeout(playNextChord, 3800);
        };

        playNextChord();
    }
}

window.soundEngine = new SoundEngine();
