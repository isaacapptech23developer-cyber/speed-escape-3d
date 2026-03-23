export class AudioManager {
    set enabled(value) {
        this._enabled = value;
        if (!value) {
            this.stopBGM();
            this.stopEngine();
            this.stopChargingSound();
        }
    }

    get enabled() {
        return this._enabled;
    }

    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this._enabled = true;
        
        // Engine Sound Synthesis
        this.engineOsc = null;
        this.engineGain = null;
        
        // Booster Sound
        this.boosterAudio = new Audio('https://actions.google.com/sounds/v1/science_fiction/electric_spark.ogg');
        this.boosterAudio.volume = 0.8;
        
        // Background Music Tracks
        this.tracks = [
            { name: "Sci-Fi Drone", url: "https://actions.google.com/sounds/v1/science_fiction/sci_fi_drone.ogg" },
            { name: "Cyberpunk City", url: "https://actions.google.com/sounds/v1/science_fiction/cybernetic_ambience.ogg" },
            { name: "Space Ambient", url: "https://actions.google.com/sounds/v1/science_fiction/space_ambience.ogg" },
            { name: "Action Beat", url: "https://actions.google.com/sounds/v1/science_fiction/power_down.ogg" } // Placeholder for upbeat track
        ];
        this.currentTrackIndex = parseInt(localStorage.getItem('se3d_musicTrack')) || 0;
        if (isNaN(this.currentTrackIndex) || this.currentTrackIndex >= this.tracks.length) {
            this.currentTrackIndex = 0;
        }
        
        this.bgmAudio = new Audio(this.tracks[this.currentTrackIndex].url);
        this.bgmAudio.loop = true;
        this.bgmAudio.volume = 0.3;
        
        // Charging Sound Synthesis
        this.chargeOsc = null;
        this.chargeGain = null;
    }

    playHorn() {
        if (!this.enabled) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // Typical car horn frequencies (approximate)
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(330, this.ctx.currentTime); // E4
        
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(415, this.ctx.currentTime); // G#4

        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);

        osc1.start();
        osc2.start();
        osc1.stop(this.ctx.currentTime + 0.5);
        osc2.stop(this.ctx.currentTime + 0.5);
    }

    updateChargingSound(isCharging, chargeRatio) {
        if (!this.enabled) {
            if (this.chargeOsc) this.stopChargingSound();
            return;
        }
        
        if (isCharging) {
            if (!this.chargeOsc) {
                if (this.ctx.state === 'suspended') this.ctx.resume();
                this.chargeOsc = this.ctx.createOscillator();
                this.chargeGain = this.ctx.createGain();
                
                this.chargeOsc.type = 'sine';
                this.chargeOsc.frequency.setValueAtTime(400, this.ctx.currentTime);
                
                this.chargeGain.gain.setValueAtTime(0, this.ctx.currentTime);
                this.chargeGain.gain.linearRampToValueAtTime(0.1, this.ctx.currentTime + 0.1);
                
                this.chargeOsc.connect(this.chargeGain);
                this.chargeGain.connect(this.ctx.destination);
                
                this.chargeOsc.start();
            }
            // Increase pitch as it charges
            const targetFreq = 400 + (chargeRatio * 600); // 400Hz to 1000Hz
            this.chargeOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
        } else {
            this.stopChargingSound();
        }
    }

    stopChargingSound() {
        if (this.chargeOsc && this.chargeGain) {
            this.chargeGain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
            this.chargeOsc.stop(this.ctx.currentTime + 0.1);
            this.chargeOsc = null;
            this.chargeGain = null;
        }
    }

    getCurrentTrackName() {
        return this.tracks[this.currentTrackIndex].name;
    }

    nextTrack() {
        this.currentTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length;
        this.changeTrack();
    }

    prevTrack() {
        this.currentTrackIndex = (this.currentTrackIndex - 1 + this.tracks.length) % this.tracks.length;
        this.changeTrack();
    }

    changeTrack() {
        const wasPlaying = !this.bgmAudio.paused;
        this.bgmAudio.pause();
        this.bgmAudio.src = this.tracks[this.currentTrackIndex].url;
        this.bgmAudio.load();
        if (wasPlaying && this.enabled) {
            this.bgmAudio.play().catch(e => console.warn("Audio play failed:", e));
        }
        localStorage.setItem('se3d_musicTrack', this.currentTrackIndex);
    }

    startEngine() {
        if (!this.enabled) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        
        if (this.engineOsc) this.stopEngine();

        // Use a low-frequency sine wave for a smooth, non-irritating hum
        this.engineOsc = this.ctx.createOscillator();
        this.engineGain = this.ctx.createGain();
        
        this.engineOsc.type = 'sine';
        this.engineOsc.frequency.setValueAtTime(60, this.ctx.currentTime); // Low hum
        
        this.engineGain.gain.setValueAtTime(0.05, this.ctx.currentTime);
        
        this.engineOsc.connect(this.engineGain);
        this.engineGain.connect(this.ctx.destination);
        
        this.engineOsc.start();
    }

    updateEngineSpeed(speedRatio) {
        if (this.enabled && this.engineOsc && this.engineGain) {
            // Smoothly increase pitch and volume slightly
            const targetFreq = 60 + (speedRatio * 100); // 60Hz to 160Hz
            const targetVol = 0.05 + (speedRatio * 0.05); // 0.05 to 0.10
            
            this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
            this.engineGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.1);
        }
    }

    stopEngine() {
        if (this.engineGain) {
            this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
            setTimeout(() => {
                if (this.engineOsc) {
                    this.engineOsc.stop();
                    this.engineOsc.disconnect();
                    this.engineOsc = null;
                }
                if (this.engineGain) {
                    this.engineGain.disconnect();
                    this.engineGain = null;
                }
            }, 100);
        }
    }

    playBooster() {
        if (!this.enabled) return;
        this.boosterAudio.currentTime = 0;
        this.boosterAudio.play().catch(e => console.log("Audio play failed:", e));
    }

    playBGM() {
        if (!this.enabled) return;
        this.bgmAudio.play().catch(e => console.log("Audio play failed:", e));
    }

    stopBGM() {
        this.bgmAudio.pause();
    }

    playCoin() {
        if (!this.enabled) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc1.type = 'sine';
        osc2.type = 'sine';
        
        osc1.frequency.setValueAtTime(987.77, this.ctx.currentTime); // B5
        osc2.frequency.setValueAtTime(1318.51, this.ctx.currentTime + 0.1); // E6
        
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc1.start(this.ctx.currentTime);
        osc1.stop(this.ctx.currentTime + 0.1);
        
        osc2.start(this.ctx.currentTime + 0.1);
        osc2.stop(this.ctx.currentTime + 0.4);
    }

    playScreech() {
        if (!this.enabled) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.2);
        
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
        
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }

    playCrash() {
        if (!this.enabled) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        
        osc1.type = 'sawtooth';
        osc2.type = 'square';
        
        osc1.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 0.5);
        
        osc2.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(5, this.ctx.currentTime + 0.5);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.5);
        
        gain.gain.setValueAtTime(0.8, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
        
        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc1.start();
        osc2.start();
        osc1.stop(this.ctx.currentTime + 0.5);
        osc2.stop(this.ctx.currentTime + 0.5);
    }
}
