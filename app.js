/* ==========================================================================
   Antigravity Chess - Core Logic (app.js)
   - Chess.js integration
   - Piece SVGs
   - Board rendering and controls
   - Minimax AI engine
   - Web Audio Sound Synthesizer
   - Interactive game loop, undo/redo & theme picker
   ========================================================================== */

// 1. Web Audio Synthesizer for Chess Sound Effects
const SoundController = {
    ctx: null,
    muted: false,

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },

    toggleMute() {
        this.muted = !this.muted;
        const btn = document.getElementById('nav-sound');
        if (this.muted) {
            btn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
            btn.classList.add('muted');
        } else {
            btn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
            btn.classList.remove('muted');
        }
        return this.muted;
    },

    playTone(frequency, type, duration, volume) {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);

        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },

    playMove() {
        // Wooden-sounding short block hit
        this.playTone(320, 'triangle', 0.12, 0.4);
    },

    playCapture() {
        // High pitch block followed by short release
        this.playTone(480, 'triangle', 0.1, 0.35);
        setTimeout(() => {
            this.playTone(240, 'sine', 0.15, 0.25);
        }, 40);
    },

    playCheck() {
        // Dissonant alert chord
        this.playTone(554.37, 'sine', 0.2, 0.45); // C#5
        setTimeout(() => {
            this.playTone(587.33, 'sine', 0.25, 0.45); // D5
        }, 120);
    },

    playGameOver(isWin) {
        if (isWin) {
            // Cheerful ascending major arpeggio (C major)
            const notes = [261.63, 329.63, 392.00, 523.25];
            notes.forEach((freq, idx) => {
                setTimeout(() => {
                    this.playTone(freq, 'sine', 0.35, 0.3);
                }, idx * 100);
            });
        } else {
            // Sad descending minor chord
            const notes = [311.13, 277.18, 220.00, 146.83];
            notes.forEach((freq, idx) => {
                setTimeout(() => {
                    this.playTone(freq, 'triangle', 0.5, 0.25);
                }, idx * 120);
            });
        }
    }
};

// 2. Confetti Explosion Canvas Animation
const ConfettiEffect = {
    canvas: null,
    ctx: null,
    particles: [],
    active: false,

    init() {
        this.canvas = document.getElementById('confetti-canvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
    },

    resize() {
        if (this.canvas) {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        }
    },

    start() {
        this.init();
        if (!this.canvas) return;
        this.particles = [];
        this.active = true;
        const colors = ['#5e60ce', '#48bfe7', '#f72585', '#7209b7', '#ffd166', '#10b981'];
        for (let i = 0; i < 120; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height - this.canvas.height,
                r: Math.random() * 5 + 4,
                d: Math.random() * this.canvas.height,
                color: colors[Math.floor(Math.random() * colors.length)],
                tilt: Math.random() * 10 - 5,
                tiltAngleIncremental: Math.random() * 0.05 + 0.02,
                tiltAngle: 0
            });
        }
        this.animate();
    },

    stop() {
        this.active = false;
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    },

    animate() {
        if (!this.active || !this.canvas) return;
        requestAnimationFrame(() => this.animate());
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        let remaining = false;
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.tiltAngle += p.tiltAngleIncremental;
            p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
            p.x += Math.sin(p.tiltAngle);
            p.tilt = Math.sin(p.tiltAngle - i / 3) * 15;

            if (p.y <= this.canvas.height) {
                remaining = true;
            }

            this.ctx.beginPath();
            this.ctx.lineWidth = p.r;
            this.ctx.strokeStyle = p.color;
            this.ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
            this.ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
            this.ctx.stroke();
        }

        if (!remaining) {
            this.active = false;
        }
    }
};

/// 3. Piece SVG Generator for sharp vector chess pieces (Standard FIDE / Lichess cburnett set)
function getPieceSVG(type, color) {
    if (color === 'w') {
        const fill = 'var(--piece-white-fill)';
        const stroke = 'var(--piece-white-stroke)';
        const svgs = {
            // White Pawn ("P")
            p: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><g class="white pawn"><path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="${fill}" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round"/></g></svg>`,
            
            // White Rook ("R")
            r: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><g class="white rook" fill="${fill}" fill-rule="evenodd" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 39h27v-3H9v3zM12 36v-4h21v4H12zM11 14V9h4v2h5V9h5v2h5V9h4v5" stroke-linecap="butt"/><path d="M34 14l-3 3H14l-3-3"/><path d="M31 17v12.5H14V17" stroke-linecap="butt" stroke-linejoin="miter"/><path d="M31 29.5l1.5 2.5h-20l1.5-2.5"/><path d="M11 14h23" fill="none" stroke-linejoin="miter"/></g></svg>`,
            
            // White Knight ("N")
            n: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><g class="white knight" fill="none" fill-rule="evenodd" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18" style="fill:${fill}; stroke:${stroke};"/><path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10" style="fill:${fill}; stroke:${stroke};"/><circle cx="9" cy="25.5" r="0.75" style="fill:${stroke}; stroke:${stroke};"/><circle cx="14.5" cy="15.5" r="0.75" transform="matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)" style="fill:${stroke}; stroke:${stroke};"/></g></svg>`,
            
            // White Bishop ("B")
            b: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><g class="white bishop" fill="none" fill-rule="evenodd" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g fill="${fill}" stroke-linecap="butt"><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2zM15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2zM25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z"/></g><path d="M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5" stroke-linejoin="miter"/></g></svg>`,
            
            // White Queen ("Q")
            q: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><g class="white queen" fill="${fill}" fill-rule="evenodd" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM24.5 7.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM41 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM16 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM33 9a2 2 0 1 1-4 0 2 2 0 1 1 4 0z"/><path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-14V25L7 14l2 12zM9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" stroke-linecap="butt"/><path d="M11.5 30c3.5-1 18.5-1 22 0M12 33.5c6-1 15-1 21 0" fill="none"/></g></svg>`,
            
            // White King ("K")
            k: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><g class="white king" fill="none" fill-rule="evenodd" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22.5 11.63V6M20 8h5" stroke-linejoin="miter"/><path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" fill="${fill}" stroke-linecap="butt" stroke-linejoin="miter"/><path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10V37z" fill="${fill}"/><path d="M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0"/></g></svg>`
        };
        return svgs[type] || '';
    } else {
        const fill = 'var(--piece-black-fill)';
        const stroke = 'var(--piece-black-stroke)';
        const svgs = {
            // Black Pawn ("p")
            p: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><g class="black pawn"><path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="${fill}" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round"/></g></svg>`,
            
            // Black Rook ("r")
            r: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><g class="black rook" fill="${fill}" fill-rule="evenodd" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 39h27v-3H9v3zM12.5 32l1.5-2.5h17l1.5 2.5h-20zM12 36v-4h21v4H12z" stroke-linecap="butt"/><path d="M14 29.5v-13h17v13H14z" stroke-linecap="butt" stroke-linejoin="miter"/><path d="M14 16.5L11 14h23l-3 2.5H14zM11 14V9h4v2h5V9h5v2h5V9h4v5H11z" stroke-linecap="butt"/><path d="M12 35.5h21M13 31.5h19M14 29.5h17M14 16.5h17M11 14h23" fill="none" stroke="${stroke}" stroke-width="1" stroke-linejoin="miter"/></g></svg>`,
            
            // Black Knight ("n")
            n: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><g class="black knight" fill="none" fill-rule="evenodd" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18" style="fill:${fill}; stroke:${stroke};"/><path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10" style="fill:${fill}; stroke:${stroke};"/><circle cx="9" cy="25.5" r="0.75" style="fill:${stroke}; stroke:${stroke};"/><circle cx="14.5" cy="15.5" r="0.75" transform="matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)" style="fill:${stroke}; stroke:${stroke};"/><path d="M 24.55,10.4 L 24.1,11.85 L 24.6,12 C 27.75,13 30.25,14.49 32.5,18.75 C 34.75,23.01 35.75,29.06 35.25,39 L 35.2,39.5 L 37.45,39.5 L 37.5,39 C 38,28.94 36.62,22.15 34.25,17.66 C 31.88,13.17 28.46,11.02 25.06,10.5 L 24.55,10.4 z " style="fill:${stroke}; stroke:none;"/></g></svg>`,
            
            // Black Bishop ("b")
            b: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><g class="black bishop" fill="none" fill-rule="evenodd" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2zm6-4c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2zM25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z" fill="${fill}" stroke-linecap="butt"/><path d="M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5" stroke="${stroke}" stroke-linejoin="miter"/></g></svg>`,
            
            // Black Queen ("q")
            q: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><g class="black queen" fill="${fill}" fill-rule="evenodd" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g fill="${fill}" stroke="none"><circle cx="6" cy="12" r="2.75"/><circle cx="14" cy="9" r="2.75"/><circle cx="22.5" cy="8" r="2.75"/><circle cx="31" cy="9" r="2.75"/><circle cx="39" cy="12" r="2.75"/></g><path d="M9 26c8.5-1.5 21-1.5 27 0l2.5-12.5L31 25l-.3-14.1-5.2 13.6-3-14.5-3 14.5-5.2-13.6L14 25 6.5 13.5 9 26zM9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" stroke-linecap="butt"/><path d="M11 38.5a35 35 1 0 0 23 0" fill="none" stroke-linecap="butt"/><path d="M11 29a35 35 1 0 1 23 0M12.5 31.5h20M11.5 34.5a35 35 1 0 0 22 0M10.5 37.5a35 35 1 0 0 24 0" fill="none" stroke="${stroke}"/></g></svg>`,
            
            // Black King ("k")
            k: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><g class="black king" fill="none" fill-rule="evenodd" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22.5 11.63V6" stroke-linejoin="miter"/><path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" fill="${fill}" stroke-linecap="butt" stroke-linejoin="miter"/><path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10V37z" fill="${fill}"/><path d="M20 8h5" stroke-linejoin="miter"/><path d="M32 29.5s8.5-4 6.03-9.65C34.15 14 25 18 22.5 24.5l.01 2.1-.01-2.1C20 18 9.906 14 6.997 19.85c-2.497 5.65 4.853 9 4.853 9M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0" stroke="${stroke}"/></g></svg>`
        };
        return svgs[type] || '';
    }
}

// 4. Piece-Square Tables (PST) for AI evaluations
const pawnEval = [
    [0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0],
    [5.0,  5.0,  5.0,  5.0,  5.0,  5.0,  5.0,  5.0],
    [1.0,  1.0,  2.0,  3.0,  3.0,  2.0,  1.0,  1.0],
    [0.5,  0.5,  1.0,  2.5,  2.5,  1.0,  0.5,  0.5],
    [0.0,  0.0,  0.0,  2.0,  2.0,  0.0,  0.0,  0.0],
    [0.5, -0.5, -1.0,  0.0,  0.0, -1.0, -0.5,  0.5],
    [0.5,  1.0,  1.0, -2.0, -2.0,  1.0,  1.0,  0.5],
    [0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0]
];

const knightEval = [
    [-5.0, -4.0, -3.0, -3.0, -3.0, -3.0, -4.0, -5.0],
    [-4.0, -2.0,  0.0,  0.0,  0.0,  0.0, -2.0, -4.0],
    [-3.0,  0.0,  1.0,  1.5,  1.5,  1.0,  0.0, -3.0],
    [-3.0,  0.5,  1.5,  2.0,  2.0,  1.5,  0.5, -3.0],
    [-3.0,  0.0,  1.5,  2.0,  2.0,  1.5,  0.0, -3.0],
    [-3.0,  0.5,  1.0,  1.5,  1.5,  1.0,  0.5, -3.0],
    [-4.0, -2.0,  0.0,  0.5,  0.5,  0.0, -2.0, -4.0],
    [-5.0, -4.0, -3.0, -3.0, -3.0, -3.0, -4.0, -5.0]
];

const bishopEval = [
    [-2.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -2.0],
    [-1.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -1.0],
    [-1.0,  0.0,  0.5,  1.0,  1.0,  0.5,  0.0, -1.0],
    [-1.0,  0.5,  0.5,  1.0,  1.0,  0.5,  0.5, -1.0],
    [-1.0,  0.0,  1.0,  1.0,  1.0,  1.0,  0.0, -1.0],
    [-1.0,  1.0,  1.0,  1.0,  1.0,  1.0,  1.0, -1.0],
    [-1.0,  0.5,  0.0,  0.0,  0.0,  0.0,  0.5, -1.0],
    [-2.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -2.0]
];

const rookEval = [
    [ 0.0,  0.0,  0.0,  0.5,  0.5,  0.0,  0.0,  0.0],
    [ 0.5,  1.0,  1.0,  1.0,  1.0,  1.0,  1.0,  0.5],
    [-0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
    [-0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
    [-0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
    [-0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
    [-0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
    [ 0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0]
];

const queenEval = [
    [-2.0, -1.0, -1.0, -0.5, -0.5, -1.0, -1.0, -2.0],
    [-1.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -1.0],
    [-1.0,  0.0,  0.5,  0.5,  0.5,  0.5,  0.0, -1.0],
    [-0.5,  0.0,  0.5,  0.5,  0.5,  0.5,  0.0, -0.5],
    [ 0.0,  0.0,  0.5,  0.5,  0.5,  0.5,  0.0, -0.5],
    [-1.0,  0.5,  0.5,  0.5,  0.5,  0.5,  0.0, -1.0],
    [-1.0,  0.0,  0.5,  0.0,  0.0,  0.5,  0.0, -1.0],
    [-2.0, -1.0, -1.0, -0.5, -0.5, -1.0, -1.0, -2.0]
];

const kingEval = [
    [-3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
    [-3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
    [-3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
    [-3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
    [-2.0, -3.0, -3.0, -4.0, -4.0, -3.0, -3.0, -2.0],
    [-1.0, -2.0, -2.0, -2.0, -2.0, -2.0, -2.0, -1.0],
    [ 2.0,  2.0,  0.0,  0.0,  0.0,  0.0,  2.0,  2.0],
    [ 2.0,  3.0,  1.0,  0.0,  0.0,  1.0,  3.0,  2.0]
];

// Piece absolute weight values
const pieceValues = { p: 10, r: 50, n: 30, b: 30, q: 90, k: 900 };

// 5. Game Manager State Variables
let game = new Chess();
let selectedSquare = null;
let gameMode = 'ai'; // 'ai' or 'pvp'
let aiDifficulty = 1; // 0=Easy, 1=Medium, 2=Hard
let playerColor = 'w'; // White 'w' or Black 'b'
let timerInterval = null;
let timeElapsed = 0;
let historyStates = []; // For Undo/Redo stack
let currentStateIndex = -1;
let pendingPromotionMove = null;
let gameManuallyEnded = false; // 항복/무승부 등으로 수동 종료됐는지 (보드 잠금용)

// DATA ENGINEERING STUDENT PROJECT
// 이 배열은 체스 게임에서 발생하는 "원천 로그(raw event log)"를 담는 저장소입니다.
// 학생 과제는 아래 TODO 함수들을 완성해서 이 로그를 수집, 저장, 변환, 출력하는 것입니다.
const DATA_LOG_STORAGE_KEY = 'chessDataEngineeringMoveLogs';
const GAME_SUMMARY_STORAGE_KEY = 'chessDataEngineeringGameSummaries';

// 로그인한 사용자 아이디 (null이면 게스트 = 공용 데이터).
// 사용자별로 데이터를 나눠 저장하기 위해 저장 키 뒤에 아이디를 덧붙인다.
let currentUser = null;
function userKey(baseKey) {
    return currentUser ? `${baseKey}::${currentUser}` : baseKey;
}
// moveLogs: 말이 "한 번" 움직일 때마다 한 줄씩 쌓이는 상세 이동 로그 (이동 단위)
// gameSummaries: 한 "판"이 끝날 때마다 한 줄씩 쌓이는 경기 요약 데이터 (경기 단위)
let moveLogs = [];
let gameSummaries = [];
let currentGameId = null;
let currentGameStartedAt = null;
let currentGameSaved = false;

// DOM Elements cache
const chessboard = document.getElementById('chessboard');
const opponentName = document.getElementById('opponent-name');
const opponentAvatar = document.getElementById('opponent-avatar');
const opponentStatus = document.getElementById('opponent-status');
const playerStatus = document.getElementById('player-status');
const moveCounter = document.getElementById('move-counter');
const gameTimer = document.getElementById('game-timer');
const movesHistoryList = document.getElementById('moves-history');
const materialAdvantage = document.getElementById('material-advantage');
const evalBar = document.getElementById('eval-bar');
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');

// Data Lab DOM Elements
const dataLogBody = document.getElementById('data-log-body');
const statTotalMoves = document.getElementById('stat-total-moves');
const statWhiteMoves = document.getElementById('stat-white-moves');
const statBlackMoves = document.getElementById('stat-black-moves');
const statCaptures = document.getElementById('stat-captures');
const exportCsvBtn = document.getElementById('export-csv-btn');
const clearDataBtn = document.getElementById('clear-data-btn');
const cumulativeTotalGames = document.getElementById('cumulative-total-games');
const cumulativeTotalMoves = document.getElementById('cumulative-total-moves');
const cumulativeAvgMoves = document.getElementById('cumulative-avg-moves');
const cumulativeCaptures = document.getElementById('cumulative-captures');
const cumulativeWhiteMoves = document.getElementById('cumulative-white-moves');
const gameSummaryBody = document.getElementById('game-summary-body');
const exportGamesCsvBtn = document.getElementById('export-games-csv-btn');
const clearGamesBtn = document.getElementById('clear-games-btn');

function getPieceName(type) {
    const names = {
        p: 'pawn',
        n: 'knight',
        b: 'bishop',
        r: 'rook',
        q: 'queen',
        k: 'king'
    };
    return names[type] || 'unknown';
}

function buildMoveLog(move, evalBefore, evalAfter, playerType) {
    // evalBefore/evalAfter: 이 수를 두기 직전/직후의 형세 점수 (양수=백 우세, 음수=흑 우세).
    // evalDelta: 이 수로 형세가 얼마나 변했는지. 분석 탭에서 실수/좋은 수를 판정하는 근거가 된다.
    // playerType: 이 수를 사람이 뒀는지('player') AI가 뒀는지('ai').
    return {
        gameId: currentGameId,
        moveNumber: moveLogs.length + 1,
        color: move.color === 'w' ? 'white' : 'black',
        piece: getPieceName(move.piece),
        from: move.from,
        to: move.to,
        capturedPiece: move.captured ? getPieceName(move.captured) : '',
        san: move.san,
        playerType,
        evalBefore,
        evalAfter,
        evalDelta: evalAfter - evalBefore,
        timestamp: new Date().toISOString()
    };
}

function saveLogsToStorage() {
    // TODO 2: localStorage에 JSON 문자열로 저장되는 과정을 설명 주석으로 정리해보세요.
    localStorage.setItem(userKey(DATA_LOG_STORAGE_KEY), JSON.stringify(moveLogs));
}

function saveGameSummariesToStorage() {
    localStorage.setItem(userKey(GAME_SUMMARY_STORAGE_KEY), JSON.stringify(gameSummaries));
}

function loadLogsFromStorage() {
    // TODO 3: JSON.parse가 실패하는 상황을 가정하고 예외 처리를 개선해보세요.
    const savedLogs = localStorage.getItem(userKey(DATA_LOG_STORAGE_KEY));
    moveLogs = savedLogs ? JSON.parse(savedLogs) : [];
}

function loadGameSummariesFromStorage() {
    const savedGames = localStorage.getItem(userKey(GAME_SUMMARY_STORAGE_KEY));
    gameSummaries = savedGames ? JSON.parse(savedGames) : [];
}

function startCurrentGameSession() {
    currentGameId = `game-${Date.now()}`;
    currentGameStartedAt = new Date().toISOString();
    currentGameSaved = false;
    renderStatsDashboard();
}

function getCurrentGameLogs() {
    return moveLogs.filter(log => log.gameId === currentGameId);
}

function finishCurrentGame(result, reason, outcome = 'abandoned') {
    if (!currentGameId || currentGameSaved) return;

    const currentLogs = getCurrentGameLogs();
    if (currentLogs.length === 0) return;

    // 이 판을 사람(player) 관점에서 분석해서 실수/좋은 수 개수도 요약에 함께 저장한다.
    const analysis = analyzeGameLogs(currentLogs);

    const summary = {
        gameId: currentGameId,
        startedAt: currentGameStartedAt,
        endedAt: new Date().toISOString(),
        result,
        reason,
        outcome,
        totalMoves: currentLogs.length,
        whiteMoves: currentLogs.filter(log => log.color === 'white').length,
        blackMoves: currentLogs.filter(log => log.color === 'black').length,
        captures: currentLogs.filter(log => log.capturedPiece).length,
        playerBlunders: analysis.blunders,
        playerMistakes: analysis.mistakes,
        playerGoodMoves: analysis.goodMoves,
        durationSeconds: timeElapsed,
        gameMode,
        playerColor
    };

    // 방금 끝난 판의 요약(summary)을 누적 경기 기록 배열의 맨 뒤에 추가한다.
    // 표에 새 행 하나를 추가하는 것과 같아서, 판을 거듭할수록 데이터가 쌓인다.
    gameSummaries.push(summary);
    saveGameSummariesToStorage();
    currentGameSaved = true;
    renderStatsDashboard();
}

function recordMoveLog(move, evalBefore) {
    // 데이터 품질 검사: from, to, piece 중 하나라도 없으면 이상한 데이터이므로 저장하지 않는다.
    if (!move.from || !move.to || !move.piece) {
        console.warn("잘못된 이동 데이터라서 저장하지 않습니다.", move);
        return;
    }

    // 이 수를 둔 "직후"의 형세 점수. game.move()가 이미 적용된 상태이므로 현재 판이 곧 이동 후 상태다.
    const evalAfter = evaluateBoard(game.board());
    // AI 모드에서 내 색이 아닌 수는 AI가 둔 것, 나머지는 사람이 둔 것으로 표시한다.
    const playerType = (gameMode === 'ai' && move.color !== playerColor) ? 'ai' : 'player';

    const log = buildMoveLog(move, evalBefore ?? evalAfter, evalAfter, playerType);
    moveLogs.push(log);
    saveLogsToStorage();
    renderDataLab();
}

function getMoveLogStats() {
    // TODO 5: 가장 많이 움직인 말, 가장 많이 이동한 색상 같은 통계를 추가해보세요.
    return {
        total: moveLogs.length,
        white: moveLogs.filter(log => log.color === 'white').length,
        black: moveLogs.filter(log => log.color === 'black').length,
        captures: moveLogs.filter(log => log.capturedPiece).length
    };
}

function renderDataLab() {
    if (!dataLogBody) return;

    const stats = getMoveLogStats();
    statTotalMoves.textContent = stats.total;
    statWhiteMoves.textContent = stats.white;
    statBlackMoves.textContent = stats.black;
    statCaptures.textContent = stats.captures;

    if (moveLogs.length === 0) {
        dataLogBody.innerHTML = '<tr><td colspan="5">아직 데이터 로그가 없습니다.</td></tr>';
        return;
    }

    // TODO 6: capturedPiece, timestamp 컬럼도 테이블에 보여주도록 HTML을 확장해보세요.
    dataLogBody.innerHTML = moveLogs.slice(-8).reverse().map(log => `
        <tr>
            <td>${log.moveNumber}</td>
            <td>${log.color}</td>
            <td>${log.piece}</td>
            <td>${log.from}</td>
            <td>${log.to}</td>
        </tr>
    `).join('');
}

// ===== 학습 분석 엔진 =====
// 형세 점수 단위 감각: 폰 ≈ 10, 나이트/비숍 ≈ 30, 룩 ≈ 50, 퀸 ≈ 90.
const BLUNDER_THRESHOLD = 25;   // 한 사이클에 -2.5점 이상 잃으면 블런더(중대한 실수)
const MISTAKE_THRESHOLD = 10;   // -1.0점 이상 잃으면 실수
const GOOD_MOVE_THRESHOLD = 15; // +1.5점 이상 벌면 좋은 수

// 한 판의 이동 로그를 받아 "사람(player)" 관점에서 분석한다.
function analyzeGameLogs(logs) {
    const sorted = [...logs].sort((a, b) => a.moveNumber - b.moveNumber);
    const playerMoves = sorted.filter(log => log.playerType === 'player');

    const result = {
        playerMoveCount: playerMoves.length,
        blunders: 0,
        mistakes: 0,
        goodMoves: 0,
        capturesByPlayer: 0,
        capturesAgainstPlayer: 0,
        pieceUsage: { pawn: 0, knight: 0, bishop: 0, rook: 0, queen: 0, king: 0 }
    };
    if (playerMoves.length === 0) return result;

    // 사람이 둔 첫 수의 색으로 사람의 색을 추정한다. (평가 점수는 백 관점이라 부호 보정이 필요)
    const sign = playerMoves[0].color === 'white' ? 1 : -1;

    for (let i = 0; i < sorted.length; i++) {
        const log = sorted[i];
        if (log.playerType !== 'player') continue;

        if (result.pieceUsage[log.piece] !== undefined) result.pieceUsage[log.piece]++;
        if (log.capturedPiece) result.capturesByPlayer++;

        // 한 "사이클" = 내 수 + 바로 다음 상대 응수. 그 사이 형세가 얼마나 변했는지로 실수를 판정한다.
        // 말을 공짜로 내주면 내 수 직후엔 티가 안 나고, 상대가 잡는 다음 수에서 점수가 떨어지므로 두 수를 함께 본다.
        const reply = sorted[i + 1];
        if (reply && reply.playerType === 'ai' && reply.capturedPiece) {
            result.capturesAgainstPlayer++;
        }
        const evalAfterCycle = reply ? reply.evalAfter : log.evalAfter;
        const cycleDelta = (evalAfterCycle - log.evalBefore) * sign; // 사람 관점: 양수=유리해짐

        if (cycleDelta <= -BLUNDER_THRESHOLD) result.blunders++;
        else if (cycleDelta <= -MISTAKE_THRESHOLD) result.mistakes++;
        else if (cycleDelta >= GOOD_MOVE_THRESHOLD) result.goodMoves++;
    }
    return result;
}

// AI전 전체를 모아 사람 관점 누적 분석을 낸다. (승패는 요약에서, 실수는 실제 이동 로그에서)
function getPlayerAnalysis() {
    const aiGames = gameSummaries.filter(s => s.gameMode === 'ai');
    const agg = {
        analyzedGames: aiGames.length,
        wins: 0, losses: 0, draws: 0,
        blunders: 0, mistakes: 0, goodMoves: 0,
        playerMoveCount: 0,
        capturesByPlayer: 0, capturesAgainstPlayer: 0,
        pieceUsage: { pawn: 0, knight: 0, bishop: 0, rook: 0, queen: 0, king: 0 }
    };

    aiGames.forEach(s => {
        if (s.outcome === 'win') agg.wins++;
        else if (s.outcome === 'loss') agg.losses++;
        else if (s.outcome === 'draw') agg.draws++;

        const logs = moveLogs.filter(l => l.gameId === s.gameId);
        const a = analyzeGameLogs(logs);
        agg.blunders += a.blunders;
        agg.mistakes += a.mistakes;
        agg.goodMoves += a.goodMoves;
        agg.playerMoveCount += a.playerMoveCount;
        agg.capturesByPlayer += a.capturesByPlayer;
        agg.capturesAgainstPlayer += a.capturesAgainstPlayer;
        for (const k in agg.pieceUsage) agg.pieceUsage[k] += a.pieceUsage[k];
    });
    return agg;
}

// 누적 분석 지표를 사람이 읽을 수 있는 "강점 / 약점 / 학습 추천" 문장으로 바꾼다 (규칙 기반).
function buildLearningReport(agg) {
    const strengths = [];
    const weaknesses = [];
    const recommendations = [];

    if (agg.analyzedGames === 0 || agg.playerMoveCount === 0) {
        return { strengths, weaknesses, recommendations };
    }

    const perGame = n => n / agg.analyzedGames;
    const blunderRate = perGame(agg.blunders);
    const minorMoves = agg.pieceUsage.knight + agg.pieceUsage.bishop;
    const minorShare = minorMoves / agg.playerMoveCount;

    // --- 강점 ---
    if (agg.wins > agg.losses) strengths.push('AI 상대 승률이 좋습니다. 이기는 판을 꾸준히 만들고 있어요.');
    if (blunderRate < 0.5) strengths.push('치명적인 실수(블런더)가 드뭅니다. 안정적으로 둡니다.');
    if (agg.capturesByPlayer > agg.capturesAgainstPlayer) strengths.push('잡히는 말보다 잡는 말이 많습니다. 물질(기물 수) 관리를 잘합니다.');
    if (agg.goodMoves >= agg.analyzedGames) strengths.push('형세를 끌어올리는 좋은 수를 판마다 만들어냅니다.');
    if (minorShare >= 0.25) strengths.push('나이트·비숍을 활발히 씁니다. 기물 전개 감각이 좋습니다.');

    // --- 약점 ---
    if (blunderRate >= 1) weaknesses.push(`판당 평균 ${blunderRate.toFixed(1)}회 큰 실수로 형세를 크게 잃습니다.`);
    if (agg.capturesAgainstPlayer > agg.capturesByPlayer) weaknesses.push('잡는 말보다 잡히는 말이 많습니다. 기물을 자주 헌납합니다.');
    if (minorShare < 0.15) weaknesses.push('나이트·비숍을 거의 쓰지 않습니다. 기물 전개가 부족합니다.');
    if (agg.losses > agg.wins) weaknesses.push('AI에게 지는 경우가 더 많습니다. 마무리로 갈수록 무너집니다.');

    // --- 더 배워야 할 점 (약점과 연결된 학습 방향) ---
    if (blunderRate >= 0.7) recommendations.push('한 수 두기 전 "이 말이 공짜로 잡히지 않나?" 확인하는 블런더 체크 습관.');
    if (agg.capturesAgainstPlayer > agg.capturesByPlayer) recommendations.push('포크·핀 같은 기본 전술과 "매달린 기물(hanging piece)" 개념 공부.');
    if (minorShare < 0.15) recommendations.push('오프닝에서 나이트·비숍부터 먼저 전개하는 기물 발전 원칙.');
    if (agg.losses > agg.wins) recommendations.push('기본 오프닝 원칙과 킹 안전(캐슬링) 익히기.');
    if (recommendations.length === 0) recommendations.push('지금 방식을 유지하며 더 강한 난이도(Hard)에 도전해 보세요.');

    return { strengths, weaknesses, recommendations };
}

function getCumulativeStats() {
    const totalGames = gameSummaries.length;
    const totalMoves = gameSummaries.reduce((sum, gameSummary) => sum + gameSummary.totalMoves, 0);
    const totalCaptures = gameSummaries.reduce((sum, gameSummary) => sum + gameSummary.captures, 0);
    const totalWhiteMoves = gameSummaries.reduce((sum, gameSummary) => sum + gameSummary.whiteMoves, 0);

    return {
        totalGames,
        totalMoves,
        avgMoves: totalGames === 0 ? 0 : Math.round(totalMoves / totalGames),
        totalCaptures,
        totalWhiteMoves
    };
}

function renderStatsDashboard() {
    if (!gameSummaryBody) return;

    const stats = getCumulativeStats();
    cumulativeTotalGames.textContent = stats.totalGames;
    cumulativeTotalMoves.textContent = stats.totalMoves;
    cumulativeAvgMoves.textContent = stats.avgMoves;
    cumulativeCaptures.textContent = stats.totalCaptures;
    cumulativeWhiteMoves.textContent = stats.totalWhiteMoves;

    // 학습 리포트(강점/약점/추천)는 경기가 없어도 안내 문구를 그려야 하므로 이른 return 전에 호출한다.
    renderLearningReport();

    if (gameSummaries.length === 0) {
        gameSummaryBody.innerHTML = '<tr><td colspan="9">아직 완료된 경기 데이터가 없습니다.</td></tr>';
        return;
    }

    gameSummaryBody.innerHTML = gameSummaries.slice(-8).reverse().map(gameSummary => {
        // ISO 문자열(예: 2026-07-03T10:30:00.000Z)에서 시:분:초 부분만 잘라서 보여준다.
        const startedTime = gameSummary.startedAt.slice(11, 19);
        const endedTime = gameSummary.endedAt.slice(11, 19);
        return `
        <tr>
            <td>${gameSummary.gameId.replace('game-', '')}</td>
            <td>${gameSummary.result}</td>
            <td>${gameSummary.totalMoves}</td>
            <td>${gameSummary.durationSeconds}s</td>
            <td>${gameSummary.captures}</td>
            <td>${gameSummary.gameMode}</td>
            <td>${startedTime}</td>
            <td>${endedTime}</td>
            <td class="review-cell">
                <button type="button" class="sf-row-btn" data-gameid="${gameSummary.gameId}"><i class="fa-solid fa-magnifying-glass-chart"></i> 분석</button>
                <button type="button" class="replay-row-btn" data-gameid="${gameSummary.gameId}"><i class="fa-solid fa-play"></i> 복기</button>
            </td>
        </tr>
    `;
    }).join('');
}

function fillReportList(id, items) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = items.length
        ? items.map(text => `<li>${text}</li>`).join('')
        : '<li class="report-empty">데이터가 더 쌓이면 표시됩니다.</li>';
}

function renderLearningReport() {
    // 리포트 영역이 없는 경우(예: 아직 HTML 미추가)에는 조용히 넘어간다.
    if (!document.getElementById('report-strengths')) return;

    const agg = getPlayerAnalysis();
    const report = buildLearningReport(agg);

    const recordEl = document.getElementById('report-record');
    const blunderEl = document.getElementById('report-blunders');
    const goodEl = document.getElementById('report-goodmoves');
    if (recordEl) recordEl.textContent = agg.analyzedGames === 0 ? '-' : `${agg.wins}승 ${agg.losses}패 ${agg.draws}무`;
    if (blunderEl) blunderEl.textContent = agg.analyzedGames === 0 ? '-' : `${agg.blunders}회`;
    if (goodEl) goodEl.textContent = agg.analyzedGames === 0 ? '-' : `${agg.goodMoves}회`;

    fillReportList('report-strengths', report.strengths);
    fillReportList('report-weaknesses', report.weaknesses);
    fillReportList('report-learn', report.recommendations);
}

// ==========================================================================
//  Stockfish 정밀 분석 (분석 전용 엔진 — 상대 AI와는 완전히 별개)
//  로컬 stockfish.js(단일 스레드)를 Web Worker로 띄워 각 국면을 평가한다.
//  UCI 프로토콜: 'position fen ...' → 'go depth N' → info 줄의 score를 읽고 'bestmove'로 종료.
// ==========================================================================
const StockfishAnalyzer = {
    worker: null,
    moveTimeMs: 500, // 국면당 탐색 시간 (go movetime)
    _pending: null,
    _readyResolve: null,
    _readyPromise: null,

    init() {
        if (this.worker) return this._readyPromise || Promise.resolve();
        this._readyPromise = new Promise((resolve, reject) => {
            let settled = false;
            let readyTimer = null;
            this._readyResolve = () => {
                if (settled) return;
                settled = true;
                clearTimeout(readyTimer);
                console.log('[Stockfish] 엔진 준비 완료 (readyok)');
                resolve();
            };
            try {
                this.worker = new Worker('stockfish.js');
            } catch (e) {
                console.error('[Stockfish] Worker 생성 실패:', e);
                reject(e);
                return;
            }
            this.worker.onmessage = (e) => this._onLine(typeof e.data === 'string' ? e.data : String(e.data));
            this.worker.onerror = (err) => {
                console.error('[Stockfish] Worker 오류:', err && (err.message || err));
                if (!settled) { settled = true; clearTimeout(readyTimer); this.worker = null; this._readyPromise = null; reject(new Error('worker load error')); }
            };
            // 준비 타임아웃: readyok가 15초 안에 안 오면 실패 처리 (무한 대기 방지)
            readyTimer = setTimeout(() => {
                if (!settled) { settled = true; this._readyPromise = null; reject(new Error('엔진 준비 시간 초과')); }
            }, 15000);
            this.worker.postMessage('uci');
        });
        return this._readyPromise;
    },

    _onLine(line) {
        if (line === 'uciok') { this.worker.postMessage('isready'); return; }
        if (line === 'readyok') { if (this._readyResolve) { this._readyResolve(); this._readyResolve = null; } return; }
        if (!this._pending) return;

        // score는 "둘 차례인 쪽" 관점의 centipawn 또는 mate 수. 가장 최근(가장 깊은) 값을 유지한다.
        const mMate = line.match(/score mate (-?\d+)/);
        const mCp = line.match(/score cp (-?\d+)/);
        if (mMate) {
            const n = parseInt(mMate[1], 10);
            this._pending.scoreCp = n > 0 ? 100000 - n : -100000 - n; // 메이트는 아주 큰 값으로 치환
            this._pending.isMate = true;
        } else if (mCp) {
            this._pending.scoreCp = parseInt(mCp[1], 10);
            this._pending.isMate = false;
        }
        if (line.startsWith('bestmove')) {
            const p = this._pending;
            this._pending = null;
            const parts = line.split(/\s+/);
            p.resolve({ scoreCp: p.scoreCp, isMate: p.isMate, bestMove: parts[1] || '' });
        }
    },

    // 한 국면(FEN)을 평가해 "둘 차례인 쪽" 관점 centipawn 점수를 돌려준다.
    // go movetime으로 탐색 시간을 제한하고, 그래도 응답이 없으면 강제로 마무리한다(멈춤 방지).
    evaluateFen(fen) {
        return new Promise((resolve) => {
            let settled = false;
            let hardTimer = null;
            const finish = (val) => {
                if (settled) return;
                settled = true;
                clearTimeout(hardTimer);
                resolve(val);
            };
            this._pending = { resolve: finish, scoreCp: 0, isMate: false };
            this.worker.postMessage('position fen ' + fen);
            this.worker.postMessage('go movetime ' + this.moveTimeMs);

            // 안전장치: movetime 이후에도 bestmove가 안 오면 stop 후 현재 점수로 마무리한다.
            hardTimer = setTimeout(() => {
                if (settled) return;
                const p = this._pending;
                this._pending = null;
                try { this.worker.postMessage('stop'); } catch (e) { /* ignore */ }
                finish({ scoreCp: p ? p.scoreCp : 0, isMate: p ? p.isMate : false, bestMove: '' });
            }, this.moveTimeMs + 3000);
        });
    },

    terminate() { if (this.worker) { this.worker.terminate(); this.worker = null; this._readyPromise = null; } }
};

// 로그(SAN)를 순서대로 재생해서 [시작국면, 1수후, 2수후, ...] FEN 목록을 만든다.
// 로그에 FEN을 따로 저장하지 않아도 chess.js로 국면을 복원할 수 있다.
function reconstructFens(orderedLogs) {
    const replay = new Chess();
    const fens = [replay.fen()];
    for (const log of orderedLogs) {
        const mv = replay.move(log.san);
        if (!mv) break; // 재생 실패(데이터 손상) 시 안전하게 중단
        fens.push(replay.fen());
    }
    return fens;
}

// 분류 순서/라벨/기호 (Chess.com 게임 리뷰 스타일).
// 탁월(Brilliant)·매우좋아요(Great)는 희생수/유일수 판정(멀티PV·기물계산)이 필요해 이번엔 제외.
const SF_CATEGORIES = [
    { key: 'best', label: '최고', symbol: '★' },
    { key: 'excellent', label: '훌륭함', symbol: '✓' },
    { key: 'good', label: '좋은 수', symbol: '👍' },
    { key: 'inaccuracy', label: '부정확', symbol: '?!' },
    { key: 'miss', label: '놓친 수', symbol: '✗' },
    { key: 'mistake', label: '실수', symbol: '?' },
    { key: 'blunder', label: '블런더', symbol: '??' }
];
const SF_LABEL = Object.fromEntries(SF_CATEGORIES.map(c => [c.key, c.label]));

// 한 수를 분류한다. cpLoss=센티폰 손실, isBest=엔진 1순위와 일치, evalBefore=수 두기 전 나의 형세.
function classifyMove(cpLoss, isBest, evalBefore) {
    if (isBest) return 'best';
    if (cpLoss < 20) return 'excellent';
    if (cpLoss < 50) return 'good';
    if (cpLoss < 100) return 'inaccuracy';
    // 100cp 이상: 이미 이기고 있었는데(+150cp↑) 크게 날렸으면 '놓친 수', 아주 크면 블런더, 그 외 실수
    if (evalBefore >= 150) return 'miss';
    if (cpLoss >= 200) return 'blunder';
    return 'mistake';
}

// centipawn(둘 차례 관점) → 승률(0~100%). Lichess/Chess.com 계열 로지스틱 근사식.
function winPercentFromCp(cp) {
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}
// 평균 승률 손실 → 정확성(0~100). Chess.com이 쓰는 역산 근사식.
function accuracyFromAvgWinLoss(avgWinLoss) {
    const acc = 103.1668 * Math.exp(-0.04354 * avgWinLoss) - 3.1669;
    return Math.max(0, Math.min(100, acc));
}

function emptySide() {
    const s = { moves: 0, avgLoss: 0, accuracy: 0, worst: [] };
    SF_CATEGORIES.forEach(c => { s[c.key] = 0; });
    return s;
}

// 각 FEN 평가(cpList)와 최선수(bestMoves)로 백·흑 양쪽을 채점한다.
function computeStockfishReport(cpList, bestMoves, orderedLogs) {
    // cpList[k] = fens[k] 평가(둘 차례 관점). fens[0]은 백 차례 → k 짝수면 백 차례. White 관점으로 통일.
    const cpWhite = cpList.map((cp, k) => (k % 2 === 0 ? cp : -cp));

    const sides = { white: emptySide(), black: emptySide() };
    const lossSum = { white: 0, black: 0 };
    const winLossSum = { white: 0, black: 0 };
    let totalScored = 0;

    for (let i = 0; i < orderedLogs.length; i++) {
        const log = orderedLogs[i];
        if (i + 1 >= cpWhite.length) break;

        const side = log.color; // 'white' | 'black'
        const sign = side === 'white' ? 1 : -1;
        const evalBefore = cpWhite[i] * sign;       // 이 수를 둔 쪽 관점
        const evalAfter = cpWhite[i + 1] * sign;

        let cpLoss = Math.max(0, Math.min(evalBefore - evalAfter, 1000));
        const winLoss = Math.max(0, winPercentFromCp(evalBefore) - winPercentFromCp(evalAfter));

        const played = log.from + log.to; // 실제 둔 수(UCI 앞 4글자)
        const isBest = bestMoves[i] && bestMoves[i].substring(0, 4) === played;
        const category = classifyMove(cpLoss, isBest, evalBefore);

        const s = sides[side];
        s[category]++;
        s.moves++;
        lossSum[side] += cpLoss;
        winLossSum[side] += winLoss;
        s.worst.push({ san: log.san, moveNumber: log.moveNumber, loss: Math.round(cpLoss), category });
        totalScored++;
    }

    for (const side of ['white', 'black']) {
        const s = sides[side];
        s.avgLoss = s.moves ? Math.round(lossSum[side] / s.moves) : 0;
        s.accuracy = s.moves ? Math.round(accuracyFromAvgWinLoss(winLossSum[side] / s.moves) * 10) / 10 : 0;
        s.worst = s.worst
            .filter(w => ['miss', 'mistake', 'blunder'].includes(w.category))
            .sort((a, b) => b.loss - a.loss)
            .slice(0, 3);
    }

    return { analyzed: totalScored > 0, totalScored, white: sides.white, black: sides.black };
}

let stockfishBusy = false;

// 특정 gameId의 저장된 이동 로그로 Stockfish 분석을 돌린다. (현재 판/과거 판 모두 지원)
async function analyzeGameById(gameId, label) {
    if (stockfishBusy) return;
    const statusEl = document.getElementById('sf-status');
    const btn = document.getElementById('sf-analyze-btn');

    const orderedLogs = moveLogs
        .filter(l => l.gameId === gameId)
        .slice()
        .sort((a, b) => a.moveNumber - b.moveNumber);

    if (orderedLogs.length === 0) {
        if (statusEl) statusEl.textContent = '이 경기에는 분석할 이동 기록이 없습니다.';
        return;
    }

    // 분석 결과 패널이 화면에 보이도록 스크롤 (과거 경기 목록에서 눌렀을 때)
    const panel = document.querySelector('.sf-panel');
    if (panel && panel.scrollIntoView) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

    stockfishBusy = true;
    if (btn) btn.disabled = true;
    try {
        if (statusEl) statusEl.textContent = '엔진 로딩 중...';
        await StockfishAnalyzer.init();

        const fens = reconstructFens(orderedLogs);
        const cpList = [];
        const bestMoves = [];
        for (let k = 0; k < fens.length; k++) {
            if (statusEl) statusEl.textContent = `${label || ''} 분석 중... ${k + 1}/${fens.length} 국면`;
            const res = await StockfishAnalyzer.evaluateFen(fens[k]);
            cpList.push(res.scoreCp);
            bestMoves.push(res.bestMove);
        }

        const report = computeStockfishReport(cpList, bestMoves, orderedLogs);
        renderStockfishReport(report);
        if (statusEl) statusEl.textContent = `${label || ''} 분석 완료 (${report.totalScored}수 채점).`;
    } catch (err) {
        console.error('Stockfish 분석 실패:', err);
        if (statusEl) statusEl.textContent = '분석 실패: 엔진(stockfish.js)을 불러오지 못했습니다.';
    } finally {
        stockfishBusy = false;
        if (btn) btn.disabled = false;
    }
}

// "이번 판 분석" 버튼: 현재 진행 중인 경기를 분석.
function analyzeCurrentGameWithStockfish() {
    if (!currentGameId) return;
    analyzeGameById(currentGameId, '이번 판');
}

function renderStockfishReport(report) {
    const grid = document.getElementById('sf-result-grid');
    const worstEl = document.getElementById('sf-worst');
    if (!grid) return;

    if (!report.analyzed) {
        grid.innerHTML = '';
        if (worstEl) worstEl.innerHTML = '';
        return;
    }

    const w = report.white;
    const b = report.black;

    // 백 vs 흑 비교 테이블 (Chess.com 게임 리뷰 스타일)
    const categoryRows = SF_CATEGORIES.map(c => `
        <tr class="sf-row sf-row-${c.key}">
            <td class="sf-cat"><span class="sf-sym sf-${c.key}">${c.symbol}</span> ${c.label}</td>
            <td class="sf-num">${w[c.key]}</td>
            <td class="sf-num">${b[c.key]}</td>
        </tr>
    `).join('');

    grid.innerHTML = `
        <table class="sf-review-table">
            <thead>
                <tr><th></th><th>백 (White)</th><th>흑 (Black)</th></tr>
            </thead>
            <tbody>
                <tr class="sf-accuracy-row">
                    <td class="sf-cat">정확성</td>
                    <td class="sf-num"><strong>${w.accuracy}</strong></td>
                    <td class="sf-num"><strong>${b.accuracy}</strong></td>
                </tr>
                ${categoryRows}
                <tr class="sf-avgloss-row">
                    <td class="sf-cat">평균 손실(cp)</td>
                    <td class="sf-num">${w.avgLoss}</td>
                    <td class="sf-num">${b.avgLoss}</td>
                </tr>
            </tbody>
        </table>
    `;

    if (worstEl) {
        const combined = [
            ...w.worst.map(x => ({ ...x, side: '백' })),
            ...b.worst.map(x => ({ ...x, side: '흑' }))
        ].sort((a, c) => c.loss - a.loss).slice(0, 4);

        worstEl.innerHTML = combined.length
            ? '<h4><i class="fa-solid fa-arrow-trend-down"></i> 가장 아쉬웠던 수</h4><ul>' +
              combined.map(x => `<li><strong>${x.side} ${x.san}</strong> — ${x.loss}cp 손실 <span class="sf-tag sf-${x.category}">${SF_LABEL[x.category]}</span></li>`).join('') +
              '</ul>'
            : '';
    }
}

function escapeCSVValue(value) {
    // 값 안에 큰따옴표가 있으면 ""로 바꾸고 전체를 큰따옴표로 감싼다.
    // 이렇게 하면 값 안에 쉼표나 줄바꿈이 있어도 CSV가 깨지지 않는다.
    const stringValue = String(value ?? '');
    return `"${stringValue.replace(/"/g, '""')}"`;
}

function convertLogsToCSV(logs) {
    const headers = ['moveNumber', 'color', 'piece', 'from', 'to', 'capturedPiece', 'san', 'timestamp'];
    const rows = logs.map(log => headers.map(header => escapeCSVValue(log[header])).join(','));
    return [headers.join(','), ...rows].join('\n');
}

function downloadCSV() {
    if (moveLogs.length === 0) {
        alert('내보낼 이동 로그가 없습니다. 먼저 체스 말을 움직여 데이터를 만들어보세요.');
        return;
    }

    const csv = convertLogsToCSV(moveLogs);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const today = new Date().toISOString().slice(0, 10);
    link.download = `chess_move_logs_${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

function clearMoveLogs() {
    moveLogs = [];
    saveLogsToStorage();
    renderDataLab();
    renderStatsDashboard();
}

function clearGameSummaries() {
    gameSummaries = [];
    saveGameSummariesToStorage();
    renderStatsDashboard();
}

function downloadGameSummariesCSV() {
    if (gameSummaries.length === 0) {
        alert('내보낼 경기 요약 데이터가 없습니다. 먼저 한 판 이상 플레이해보세요.');
        return;
    }

    const headers = ['gameId', 'startedAt', 'endedAt', 'result', 'outcome', 'totalMoves', 'whiteMoves', 'blackMoves', 'captures', 'playerBlunders', 'playerMistakes', 'playerGoodMoves', 'durationSeconds', 'gameMode', 'playerColor'];
    const rows = gameSummaries.map(summary => headers.map(header => escapeCSVValue(summary[header])).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const today = new Date().toISOString().slice(0, 10);
    link.download = `chess_game_summaries_${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

// 6. Board Initialization and Rendering
function initBoard() {
    chessboard.innerHTML = '';
    
    // Draw cells (depending on board perspective)
    // White at bottom: ranks 8 down to 1, files A to H
    // Black at bottom: ranks 1 up to 8, files H down to A
    const isFlipped = playerColor === 'b';
    
    // Render Y Coordinates (Rank numbers 1-8)
    const coordsY = document.getElementById('coords-y-left');
    coordsY.innerHTML = '';
    for (let r = 0; r < 8; r++) {
        const rank = isFlipped ? r + 1 : 8 - r;
        const span = document.createElement('span');
        span.textContent = rank;
        coordsY.appendChild(span);
    }
    
    // Render X Coordinates (File letters A-H)
    const coordsX = document.getElementById('coords-x-bottom');
    coordsX.innerHTML = '';
    for (let c = 0; c < 8; c++) {
        const file = isFlipped ? String.fromCharCode(104 - c) : String.fromCharCode(97 + c);
        const span = document.createElement('span');
        span.textContent = file.toUpperCase();
        coordsX.appendChild(span);
    }

    const boardState = game.board();

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            // Actual rank/file depending on perspective
            const rankIndex = isFlipped ? r : r;
            const fileIndex = isFlipped ? 7 - c : c;
            
            const squareName = getSquareName(rankIndex, fileIndex);
            const squareEl = document.createElement('div');
            
            squareEl.classList.add('square');
            squareEl.dataset.square = squareName;
            
            // Light/Dark square styling
            const isLight = (rankIndex + fileIndex) % 2 === 0;
            squareEl.classList.add(isLight ? 'light' : 'dark');
            
            // Place piece if exists
            const piece = boardState[rankIndex][fileIndex];
            if (piece) {
                const pieceEl = document.createElement('div');
                pieceEl.classList.add('piece', piece.color === 'w' ? 'white' : 'black');
                pieceEl.dataset.pieceType = piece.type;
                pieceEl.dataset.pieceColor = piece.color;
                pieceEl.innerHTML = getPieceSVG(piece.type, piece.color);
                
                // HTML5 Drag and Drop attributes
                pieceEl.setAttribute('draggable', 'true');
                pieceEl.addEventListener('dragstart', handleDragStart);
                pieceEl.addEventListener('dragend', handleDragEnd);
                
                squareEl.appendChild(pieceEl);
            }
            
            // Interactive events
            squareEl.addEventListener('click', handleSquareClick);
            squareEl.addEventListener('dragover', handleDragOver);
            squareEl.addEventListener('drop', handleDrop);
            
            chessboard.appendChild(squareEl);
        }
    }
    
    highlightLastMove();
    highlightCheck();
}

function getSquareName(r, c) {
    const file = String.fromCharCode(97 + c);
    const rank = 8 - r;
    return `${file}${rank}`;
}

function getRowCol(squareName) {
    const file = squareName.charCodeAt(0) - 97;
    const rank = 8 - parseInt(squareName[1]);
    return { r: rank, c: file };
}

// 7. Interactive Game Input Handling
function handleSquareClick(e) {
    if (game.game_over() || gameManuallyEnded) return;
    if (gameMode === 'ai' && game.turn() !== playerColor) return;

    let target = e.target;
    // Walk up to square container if clicked on piece/svg
    while (target && !target.classList.contains('square')) {
        target = target.parentElement;
    }
    if (!target) return;

    const squareName = target.dataset.square;
    const pieceEl = target.querySelector('.piece');

    // Clicked on a valid target square (possible move indicator)
    if (target.classList.contains('has-move')) {
        makeMove(selectedSquare, squareName);
        selectedSquare = null;
        clearHighlights();
        return;
    }

    if (pieceEl) {
        const pieceColor = pieceEl.dataset.pieceColor;
        
        // Correct turn check
        if (pieceColor === game.turn()) {
            if (selectedSquare === squareName) {
                selectedSquare = null;
                clearHighlights();
            } else {
                selectedSquare = squareName;
                showLegalMoves(squareName);
            }
        } else {
            // Clicked opponent piece, not a valid moves target
            selectedSquare = null;
            clearHighlights();
        }
    } else {
        // Clicked empty space with no active move target
        selectedSquare = null;
        clearHighlights();
    }
}

function showLegalMoves(squareName) {
    clearHighlights();
    
    // Highlight selected square
    const activeSquare = document.querySelector(`.square[data-square="${squareName}"]`);
    if (activeSquare) activeSquare.classList.add('selected');
    
    // Query list of moves
    const moves = game.moves({ square: squareName, verbose: true });
    
    moves.forEach(move => {
        const targetSquare = document.querySelector(`.square[data-square="${move.to}"]`);
        if (targetSquare) {
            targetSquare.classList.add('has-move');
            
            // Insert dot (empty square) or ring (capture)
            const indicator = document.createElement('div');
            if (move.captured) {
                indicator.classList.add('move-indicator-ring');
            } else {
                indicator.classList.add('move-indicator-dot');
            }
            targetSquare.appendChild(indicator);
        }
    });
}

function clearHighlights() {
    document.querySelectorAll('.square').forEach(sq => {
        sq.classList.remove('selected', 'has-move');
        const dot = sq.querySelector('.move-indicator-dot, .move-indicator-ring');
        if (dot) dot.remove();
    });
}

function highlightLastMove() {
    // Clear old move highlights
    document.querySelectorAll('.square.last-move').forEach(sq => sq.classList.remove('last-move'));
    
    const history = game.history({ verbose: true });
    if (history.length > 0) {
        const lastMove = history[history.length - 1];
        const fromSq = document.querySelector(`.square[data-square="${lastMove.from}"]`);
        const toSq = document.querySelector(`.square[data-square="${lastMove.to}"]`);
        if (fromSq) fromSq.classList.add('last-move');
        if (toSq) toSq.classList.add('last-move');
    }
}

function highlightCheck() {
    document.querySelectorAll('.square.in-check').forEach(sq => sq.classList.remove('in-check'));
    if (game.in_check()) {
        const kingColor = game.turn();
        // Find king coordinates
        const board = game.board();
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = board[r][c];
                if (piece && piece.type === 'k' && piece.color === kingColor) {
                    const kingSqName = getSquareName(r, c);
                    const kingSquare = document.querySelector(`.square[data-square="${kingSqName}"]`);
                    if (kingSquare) {
                        kingSquare.classList.add('in-check');
                        SoundController.playCheck();
                    }
                    return;
                }
            }
        }
    }
}

// 8. HTML5 Drag and Drop implementation
let draggedPiece = null;
let draggedFromSquare = null;

function handleDragStart(e) {
    if (game.game_over() || gameManuallyEnded) { e.preventDefault(); return; }
    if (gameMode === 'ai' && game.turn() !== playerColor) { e.preventDefault(); return; }
    
    const pieceEl = e.currentTarget;
    if (pieceEl.dataset.pieceColor !== game.turn()) { e.preventDefault(); return; }

    draggedPiece = pieceEl;
    draggedFromSquare = pieceEl.parentElement.dataset.square;
    pieceEl.classList.add('dragging');
    
    // Highlight possible moves
    selectedSquare = draggedFromSquare;
    showLegalMoves(draggedFromSquare);
    
    // Set custom ghost image if needed, otherwise default
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedFromSquare);
}

function handleDragEnd(e) {
    if (draggedPiece) {
        draggedPiece.classList.remove('dragging');
    }
    draggedPiece = null;
    draggedFromSquare = null;
    clearHighlights();
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDrop(e) {
    e.preventDefault();
    let target = e.target;
    while (target && !target.classList.contains('square')) {
        target = target.parentElement;
    }
    if (!target) return;

    const toSquare = target.dataset.square;
    const fromSquare = draggedFromSquare || e.dataTransfer.getData('text/plain');

    if (fromSquare && toSquare && fromSquare !== toSquare) {
        // Validate if this is a legal move
        const moves = game.moves({ square: fromSquare, verbose: true });
        const isLegal = moves.some(m => m.to === toSquare);
        if (isLegal) {
            makeMove(fromSquare, toSquare);
        }
    }
    selectedSquare = null;
    clearHighlights();
}

// 9. Move Execution & Evaluation
function makeMove(from, to, promotion = null) {
    if (gameManuallyEnded) return;
    // Check if pawn promotion is triggered
    const isPromotion = checkPromotion(from, to);
    if (isPromotion && !promotion) {
        pendingPromotionMove = { from, to };
        showPromotionOverlay();
        return;
    }

    const moveDetails = {
        from: from,
        to: to
    };
    if (promotion) {
        moveDetails.promotion = promotion;
    }

    // 수를 두기 "직전"의 형세 점수를 먼저 재둔다 (이동 후 점수와 비교하기 위해).
    const evalBefore = evaluateBoard(game.board());
    const move = game.move(moveDetails);

    if (move) {
        // Sound trigger
        if (move.captured) {
            SoundController.playCapture();
        } else {
            SoundController.playMove();
        }

        recordMoveLog(move, evalBefore);
        
        // Capture game state history for undo/redo
        saveHistoryState();

        // Re-render board and logs
        initBoard();
        updateUI();

        // Check if game continues
        if (checkGameOver()) return;

        // AI trigger
        if (gameMode === 'ai' && game.turn() !== playerColor) {
            triggerAIMove();
        }
    }
}

function checkPromotion(from, to) {
    const { r, c } = getRowCol(from);
    const piece = game.board()[r][c];
    if (piece && piece.type === 'p') {
        const targetRank = to[1];
        if ((piece.color === 'w' && targetRank === '8') || (piece.color === 'b' && targetRank === '1')) {
            return true;
        }
    }
    return false;
}

function showPromotionOverlay() {
    const overlay = document.getElementById('promotion-overlay');
    overlay.classList.remove('hidden');
    
    // Style promotion icons based on current player color
    const promoColor = game.turn();
    const fill = promoColor === 'w' ? 'var(--piece-white-fill)' : 'var(--piece-black-fill)';
    const stroke = promoColor === 'w' ? 'var(--piece-white-stroke)' : 'var(--piece-black-stroke)';
    
    document.querySelector('.q-icon').innerHTML = getPieceSVG('q', promoColor);
    document.querySelector('.r-icon').innerHTML = getPieceSVG('r', promoColor);
    document.querySelector('.b-icon').innerHTML = getPieceSVG('b', promoColor);
    document.querySelector('.n-icon').innerHTML = getPieceSVG('n', promoColor);
}

function hidePromotionOverlay() {
    document.getElementById('promotion-overlay').classList.add('hidden');
}

// Bind promotion button click events
document.querySelectorAll('.promo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const chosenPiece = btn.dataset.piece;
        if (pendingPromotionMove) {
            makeMove(pendingPromotionMove.from, pendingPromotionMove.to, chosenPiece);
            pendingPromotionMove = null;
        }
        hidePromotionOverlay();
    });
});

// 10. AI Engine (Minimax Implementation)
function triggerAIMove() {
    // Show AI calculating state
    opponentStatus.textContent = '생각 중...';
    opponentStatus.classList.add('evaluating');
    document.getElementById('opponent-bar').classList.add('active-player');
    document.getElementById('player-bar').classList.remove('active-player');

    // Slight timeout so UI thread isn't blocked and rendering updates first
    setTimeout(() => {
        const start = performance.now();
        
        let depth = 1;
        if (aiDifficulty === 0) depth = 0; // Easy
        else if (aiDifficulty === 1) depth = 2; // Medium
        else if (aiDifficulty === 2) depth = 3; // Hard

        const isAIWhite = playerColor === 'b';
        const bestMove = getBestMove(game, depth, isAIWhite);
        
        const duration = performance.now() - start;
        // Make sure thinking lasts at least 400ms for realistic game feeling
        const delay = Math.max(0, 400 - duration);

        setTimeout(() => {
            // 사고 중 사람이 항복/무승부로 게임을 끝냈다면 AI 수를 두지 않는다.
            if (gameManuallyEnded) {
                opponentStatus.textContent = '대기 중';
                opponentStatus.classList.remove('evaluating');
                return;
            }
            if (bestMove) {
                const evalBefore = evaluateBoard(game.board());
                const move = game.move({
                    from: bestMove.from,
                    to: bestMove.to,
                    promotion: bestMove.promotion || 'q'
                });

                if (move) {
                    if (move.captured) SoundController.playCapture();
                    else SoundController.playMove();

                    recordMoveLog(move, evalBefore);
                    saveHistoryState();
                    initBoard();
                    updateUI();
                    
                    checkGameOver();
                }
            }
            opponentStatus.textContent = '대기 중';
            opponentStatus.classList.remove('evaluating');
            document.getElementById('opponent-bar').classList.remove('active-player');
            document.getElementById('player-bar').classList.add('active-player');
        }, delay);
        
    }, 50);
}

// Evaluate board total score
function evaluateBoard(boardState) {
    let totalEvaluation = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = boardState[r][c];
            if (piece) {
                totalEvaluation += getPieceValue(piece, r, c);
            }
        }
    }
    return totalEvaluation;
}

function getPieceValue(piece, r, c) {
    let absoluteValue = 0;
    let pstValue = 0;
    const type = piece.type;
    const color = piece.color;
    
    // Match tables (row flip for black)
    const row = color === 'w' ? r : 7 - r;
    const col = c;

    switch(type) {
        case 'p': absoluteValue = pieceValues.p; pstValue = pawnEval[row][col]; break;
        case 'r': absoluteValue = pieceValues.r; pstValue = rookEval[row][col]; break;
        case 'n': absoluteValue = pieceValues.n; pstValue = knightEval[row][col]; break;
        case 'b': absoluteValue = pieceValues.b; pstValue = bishopEval[row][col]; break;
        case 'q': absoluteValue = pieceValues.q; pstValue = queenEval[row][col]; break;
        case 'k': absoluteValue = pieceValues.k; pstValue = kingEval[row][col]; break;
    }
    
    const value = absoluteValue + pstValue;
    return color === 'w' ? value : -value;
}

// Minimax with Alpha-Beta Pruning
function minimax(depth, alpha, beta, isMaximizing) {
    if (depth === 0 || game.game_over()) {
        return evaluateBoard(game.board());
    }

    const moves = game.moves({ verbose: true });
    
    // Move sorting to trigger beta-cuts earlier (captures evaluated first)
    moves.sort((a, b) => {
        let scoreA = 0;
        let scoreB = 0;
        if (a.captured) scoreA += 10 + (pieceValues[a.captured] || 0);
        if (b.captured) scoreB += 10 + (pieceValues[b.captured] || 0);
        if (a.promotion) scoreA += 15;
        if (b.promotion) scoreB += 15;
        return scoreB - scoreA;
    });

    if (isMaximizing) {
        let maxEval = -Infinity;
        for (const move of moves) {
            game.move(move);
            const evaluation = minimax(depth - 1, alpha, beta, false);
            game.undo();
            maxEval = Math.max(maxEval, evaluation);
            alpha = Math.max(alpha, evaluation);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const move of moves) {
            game.move(move);
            const evaluation = minimax(depth - 1, alpha, beta, true);
            game.undo();
            minEval = Math.min(minEval, evaluation);
            beta = Math.min(beta, evaluation);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

// Choose best move for AI
function getBestMove(gameInstance, depth, isAIWhite) {
    const moves = gameInstance.moves({ verbose: true });
    if (moves.length === 0) return null;

    // Easy difficulty (depth=0) has 30% chance of random move, 70% depth 1
    if (depth === 0) {
        if (Math.random() < 0.3) {
            return moves[Math.floor(Math.random() * moves.length)];
        }
        depth = 1;
    }

    // Sort moves
    moves.sort((a, b) => {
        let scoreA = 0;
        let scoreB = 0;
        if (a.captured) scoreA += 10 + (pieceValues[a.captured] || 0);
        if (b.captured) scoreB += 10 + (pieceValues[b.captured] || 0);
        if (a.promotion) scoreA += 15;
        if (b.promotion) scoreB += 15;
        return scoreB - scoreA;
    });

    let bestMove = null;
    let bestValue = isAIWhite ? -Infinity : Infinity;

    for (const move of moves) {
        gameInstance.move(move);
        const boardValue = minimax(depth - 1, -Infinity, Infinity, !isAIWhite);
        gameInstance.undo();

        if (isAIWhite) {
            if (boardValue > bestValue) {
                bestValue = boardValue;
                bestMove = move;
            }
        } else {
            if (boardValue < bestValue) {
                bestValue = boardValue;
                bestMove = move;
            }
        }
    }
    return bestMove;
}

// 11. Undo / Redo & State Stack management
function saveHistoryState() {
    const state = game.fen();
    
    // Chop any alternate path redo states if we write a new history branch
    historyStates = historyStates.slice(0, currentStateIndex + 1);
    
    historyStates.push(state);
    currentStateIndex++;
    
    updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
    // In VS AI mode, a move undo steps back TWO moves (your move + AI move)
    // In PvP mode, undo steps back ONE move
    const undoLimit = gameMode === 'ai' ? 1 : 0;
    
    undoBtn.disabled = currentStateIndex <= undoLimit;
    redoBtn.disabled = currentStateIndex >= historyStates.length - 1;
}

function performUndo() {
    if (undoBtn.disabled) return;
    
    if (gameMode === 'ai') {
        // Rollback 2 moves (AI move and user move)
        currentStateIndex -= 2;
    } else {
        currentStateIndex -= 1;
    }
    
    const fen = historyStates[currentStateIndex];
    game.load(fen);
    
    initBoard();
    updateUI();
    SoundController.playMove();
    updateUndoRedoButtons();
}

function performRedo() {
    if (redoBtn.disabled) return;
    
    if (gameMode === 'ai') {
        currentStateIndex += 2;
    } else {
        currentStateIndex += 1;
    }
    
    const fen = historyStates[currentStateIndex];
    game.load(fen);
    
    initBoard();
    updateUI();
    SoundController.playMove();
    updateUndoRedoButtons();
}

// 12. Stats, Layout & UI Updates
function updateUI() {
    // 1. Move count
    const history = game.history();
    moveCounter.textContent = Math.ceil(history.length / 2);
    
    // 2. Turn message display
    const turn = game.turn();
    const isPlayersTurn = gameMode === 'ai' ? (turn === playerColor) : true;
    const gameStatusLabel = document.getElementById('game-status-label');
    
    if (game.game_over()) {
        playerStatus.textContent = '게임 종료';
        opponentStatus.textContent = '게임 종료';
        gameStatusLabel.innerHTML = '<i class="fa-solid fa-circle-dot status-indicator"></i> Game Over';
    } else if (gameMode === 'ai') {
        if (turn === playerColor) {
            playerStatus.textContent = '당신의 차례';
            opponentStatus.textContent = '대기 중';
            gameStatusLabel.innerHTML = '<i class="fa-solid fa-circle-dot status-indicator"></i> Your Turn';
            document.getElementById('player-bar').classList.add('active-player');
            document.getElementById('opponent-bar').classList.remove('active-player');
        } else {
            playerStatus.textContent = '대기 중';
            opponentStatus.textContent = 'AI 생각 중...';
            gameStatusLabel.innerHTML = '<i class="fa-solid fa-circle-dot status-indicator"></i> AI Turn';
            document.getElementById('player-bar').classList.remove('active-player');
            document.getElementById('opponent-bar').classList.add('active-player');
        }
    } else {
        // 2-Player mode
        if (turn === 'w') {
            playerStatus.textContent = '백의 차례 (이동하세요)';
            opponentStatus.textContent = '대기 중';
            gameStatusLabel.innerHTML = '<i class="fa-solid fa-circle-dot status-indicator"></i> White Turn';
            document.getElementById('player-bar').classList.add('active-player');
            document.getElementById('opponent-bar').classList.remove('active-player');
        } else {
            playerStatus.textContent = '대기 중';
            opponentStatus.textContent = '흑의 차례 (이동하세요)';
            gameStatusLabel.innerHTML = '<i class="fa-solid fa-circle-dot status-indicator"></i> Black Turn';
            document.getElementById('player-bar').classList.remove('active-player');
            document.getElementById('opponent-bar').classList.add('active-player');
        }
    }

    // 3. Update Move History panel list
    renderMoveHistory();

    // 4. Update Captured Pieces and Material Score Advantage
    renderCapturedPieces();

    // 5. Update Evaluation Bar
    updateEvaluation();
    renderDataLab();
}

function renderMoveHistory() {
    movesHistoryList.innerHTML = '';
    const moves = game.history({ verbose: true });
    
    if (moves.length === 0) {
        movesHistoryList.innerHTML = '<div class="no-moves">기록된 이동이 없습니다.</div>';
        return;
    }
    
    let html = '';
    for (let i = 0; i < moves.length; i += 2) {
        const moveNum = (i / 2) + 1;
        const wMove = moves[i];
        const bMove = moves[i + 1];
        
        const wSan = wMove ? wMove.san : '';
        const bSan = bMove ? bMove.san : '';
        
        // Mark move cell if it is the current historical step (in case we used undo/redo)
        const isWActive = i === historyStates.length - 1;
        const isBActive = (i + 1) === historyStates.length - 1;

        html += `
            <div class="history-row">
                <span class="num">${moveNum}.</span>
                <span class="move-cell ${isWActive ? 'active-move' : ''}" data-idx="${i}">${wSan}</span>
                <span class="move-cell ${isBActive ? 'active-move' : ''}" data-idx="${i + 1}">${bSan}</span>
            </div>
        `;
    }
    movesHistoryList.innerHTML = html;
    
    // Click on history cell enables FEN loading (Review moves)
    document.querySelectorAll('.move-cell').forEach(cell => {
        cell.addEventListener('click', () => {
            const idx = parseInt(cell.dataset.idx);
            if (idx >= 0 && idx < historyStates.length) {
                currentStateIndex = idx;
                game.load(historyStates[idx]);
                initBoard();
                updateUI();
                updateUndoRedoButtons();
            }
        });
    });
    
    // Auto scroll bottom
    movesHistoryList.scrollTop = movesHistoryList.scrollHeight;
}

function renderCapturedPieces() {
    const boardState = game.board();
    
    // Count pieces remaining
    const currentPieces = { w: { p:0, r:0, n:0, b:0, q:0, k:0 }, b: { p:0, r:0, n:0, b:0, q:0, k:0 } };
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = boardState[r][c];
            if (p) {
                currentPieces[p.color][p.type]++;
            }
        }
    }
    
    // Standard counts
    const startingCounts = { p: 8, r: 2, n: 2, b: 2, q: 1, k: 1 };
    
    // Calculate difference (captured pieces)
    const whiteCaptured = []; // White pieces captured (shown in Black bar)
    const blackCaptured = []; // Black pieces captured (shown in White bar)
    
    let whiteScore = 0;
    let blackScore = 0;
    
    const weights = { p: 1, n: 3, b: 3, r: 5, q: 9 };
    
    for (const type in startingCounts) {
        if (type === 'k') continue;
        
        // Black pieces captured by White: startCount - remainingCount
        const bCapCount = startingCounts[type] - currentPieces.b[type];
        for (let i = 0; i < bCapCount; i++) {
            blackCaptured.push(type);
            whiteScore += weights[type];
        }
        
        // White pieces captured by Black: startCount - remainingCount
        const wCapCount = startingCounts[type] - currentPieces.w[type];
        for (let i = 0; i < wCapCount; i++) {
            whiteCaptured.push(type);
            blackScore += weights[type];
        }
    }
    
    // Sort captures by value for clean visualization
    const sortOrder = { q:0, r:1, b:2, n:3, p:4 };
    whiteCaptured.sort((a,b) => sortOrder[a] - sortOrder[b]);
    blackCaptured.sort((a,b) => sortOrder[a] - sortOrder[b]);
    
    // Render HTML icons for captured pieces
    const blackCapturedContainer = document.getElementById('captured-by-black'); // Black captured White
    blackCapturedContainer.innerHTML = '';
    whiteCaptured.forEach(type => {
        const el = document.createElement('div');
        el.classList.add('captured-piece-icon');
        el.innerHTML = getPieceSVG(type, 'w');
        blackCapturedContainer.appendChild(el);
    });
    
    const whiteCapturedContainer = document.getElementById('captured-by-white'); // White captured Black
    whiteCapturedContainer.innerHTML = '';
    blackCaptured.forEach(type => {
        const el = document.createElement('div');
        el.classList.add('captured-piece-icon');
        el.innerHTML = getPieceSVG(type, 'b');
        whiteCapturedContainer.appendChild(el);
    });

    // Score advantage text tags
    if (whiteScore > blackScore) {
        const diff = whiteScore - blackScore;
        const tag = document.createElement('span');
        tag.classList.add('advantage-tag');
        tag.textContent = `+${diff}`;
        whiteCapturedContainer.appendChild(tag);
    } else if (blackScore > whiteScore) {
        const diff = blackScore - whiteScore;
        const tag = document.createElement('span');
        tag.classList.add('advantage-tag');
        tag.textContent = `+${diff}`;
        blackCapturedContainer.appendChild(tag);
    }
}

function updateEvaluation() {
    const score = evaluateBoard(game.board());
    
    // Calculate display percentage. Score positive is white advantage, negative black advantage.
    // Normalized around 0 (equal)
    // Scale material score. Max scale limit set to 15 (which is 150 centipawns or 15 points)
    const maxAdvantage = 150; 
    let scorePercent = 50 + (score / maxAdvantage) * 50;
    
    // Clamp between 5% and 95%
    scorePercent = Math.max(5, Math.min(95, scorePercent));
    
    // Invert for visually representing white at bottom, black at top.
    // Higher evaluation score = White advantage = white bar occupies more space.
    // CSS height represents White (bottom player) space.
    evalBar.style.height = `${scorePercent}%`;
    
    // Set text tag
    const scoreText = (score / 10).toFixed(1);
    materialAdvantage.textContent = score >= 0 ? `+${scoreText}` : scoreText;
}

// 13. Game Loop States & Timer
function startTimer() {
    clearInterval(timerInterval);
    timeElapsed = 0;
    gameTimer.textContent = '00:00';
    
    timerInterval = setInterval(() => {
        timeElapsed++;
        const minutes = Math.floor(timeElapsed / 60).toString().padStart(2, '0');
        const seconds = (timeElapsed % 60).toString().padStart(2, '0');
        gameTimer.textContent = `${minutes}:${seconds}`;
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

function checkGameOver() {
    if (game.game_over()) {
        stopTimer();
        ConfettiEffect.stop();
        
        let title = '게임 종료';
        let reason = '';
        let isWin = false;
        let outcome = 'draw'; // 체크메이트가 아니면 모두 무승부 계열이므로 기본값은 draw

        if (game.in_checkmate()) {
            title = '체크메이트! (Checkmate)';
            const loser = game.turn();
            if (gameMode === 'ai') {
                if (loser === playerColor) {
                    reason = '인공지능(AI)의 승리입니다. 더 연습하여 다시 도전해보세요!';
                    isWin = false;
                    outcome = 'loss';
                } else {
                    reason = '축하합니다! 인공지능을 격파하고 승리하셨습니다!';
                    isWin = true;
                    outcome = 'win';
                }
            } else {
                reason = loser === 'w' ? '흑(Black)의 승리입니다!' : '백(White)의 승리입니다!';
                isWin = true; // Two players, always play celebration
                outcome = 'decisive';
            }
        } else if (game.in_stalemate()) {
            title = '스테일메이트 (Stalemate)';
            reason = '킹이 공격받지 않고 있으나 움직일 수 있는 합법적인 수가 없어 무승부입니다.';
        } else if (game.in_threefold_repetition()) {
            title = '동일 국면 3회 반복 (Draw)';
            reason = '동일한 체스 기물 배치가 3회 반복되어 무승부 처리되었습니다.';
        } else if (game.insufficient_material()) {
            title = '기물 부족 무승부 (Draw)';
            reason = '체크메이트를 만들 수 있는 최소한의 기물(킹과 비숍, 나이트 등)이 남지 않아 무승부입니다.';
        } else if (game.in_draw()) {
            title = '50수 법칙 무승부 (Draw)';
            reason = '폰의 전진이나 기물의 잡힘 없이 50수가 지나 무승부 처리되었습니다.';
        }
        
        finishCurrentGame(title, reason, outcome);
        // 무승부 계열이면 악수 아이콘, 아니면 승/패 연출
        showGameOverOverlay(title, reason, outcome === 'draw' ? 'draw' : isWin);
        return true;
    }
    return false;
}

// 항복: 사람이 게임을 포기한다. AI전에서는 사람 패배, PvP에서는 현재 차례인 쪽이 패배.
function resignGame() {
    if (game.game_over() || gameManuallyEnded || !currentGameId) return;
    if (!confirm('정말 기권하시겠습니까?')) return;

    gameManuallyEnded = true;
    stopTimer();
    ConfettiEffect.stop();

    const title = '기권 (Resign)';
    let reason;
    let outcome;
    let overlayResult;

    if (gameMode === 'ai') {
        reason = '기권했습니다. AI의 승리입니다. 다음 판에 다시 도전하세요!';
        outcome = 'loss';
        overlayResult = false;
    } else {
        const resigningSide = game.turn(); // 현재 차례인 쪽이 기권
        const winner = resigningSide === 'w' ? '흑(Black)' : '백(White)';
        const loser = resigningSide === 'w' ? '백(White)' : '흑(Black)';
        reason = `${loser}이(가) 기권하여 ${winner}의 승리입니다.`;
        outcome = 'decisive';
        overlayResult = true;
    }

    finishCurrentGame(title, reason, outcome);
    showGameOverOverlay(title, reason, overlayResult);
}

// 무승부 합의: PvP 전용. AI전에서는 버튼이 숨겨져 호출되지 않는다.
function offerDraw() {
    if (gameMode === 'ai') return; // AI전에서는 무승부 요청 불가
    if (game.game_over() || gameManuallyEnded || !currentGameId) return;
    if (!confirm('무승부에 합의하시겠습니까?')) return;

    gameManuallyEnded = true;
    stopTimer();
    ConfettiEffect.stop();

    const title = '무승부 합의 (Draw)';
    const reason = '양측 합의로 무승부가 되었습니다.';
    finishCurrentGame(title, reason, 'draw');
    showGameOverOverlay(title, reason, 'draw');
}

// result: true = 승리, false = 패배, 'draw' = 무승부
function showGameOverOverlay(title, reason, result) {
    document.getElementById('game-over-title').textContent = title;
    document.getElementById('game-over-reason').textContent = reason;
    document.getElementById('final-moves').textContent = Math.ceil(game.history().length / 2);
    document.getElementById('final-time').textContent = gameTimer.textContent;

    const icon = document.getElementById('game-over-icon');
    if (result === 'draw') {
        icon.className = 'fa-solid fa-handshake';
        icon.style.color = '#a0aec0';
        // 무승부는 축하/패배 사운드 없이 조용히 마무리
    } else if (result) {
        icon.className = 'fa-solid fa-trophy';
        icon.style.color = '#ffd166';
        ConfettiEffect.start();
        SoundController.playGameOver(true);
    } else {
        icon.className = 'fa-solid fa-skull-crossbones';
        icon.style.color = '#e63946';
        SoundController.playGameOver(false);
    }

    document.getElementById('game-over-overlay').classList.remove('hidden');
}

function startNewGame() {
    finishCurrentGame('새 게임 시작', '완료 전 새 게임을 시작하여 이전 경기를 저장했습니다.');
    stopTimer();
    ConfettiEffect.stop();
    
    game = new Chess();
    selectedSquare = null;
    pendingPromotionMove = null;
    gameManuallyEnded = false;

    // Read game mode & setup details
    const activeMode = document.querySelector('input[name="game-mode"]:checked').value;
    gameMode = activeMode;

    // 무승부(드로우) 요청은 사람끼리(PvP) 둘 때만 노출한다.
    const drawBtn = document.getElementById('draw-claim-btn');
    if (drawBtn) drawBtn.style.display = (gameMode === 'pvp') ? '' : 'none';
    
    const activeDiff = parseInt(document.querySelector('input[name="ai-difficulty"]:checked').value);
    aiDifficulty = activeDiff;
    
    const activeColor = document.querySelector('input[name="player-color"]:checked').value;
    playerColor = activeColor;

    // Reset controls panel state
    historyStates = [game.fen()];
    currentStateIndex = 0;
    startCurrentGameSession();
    
    // Hide overlay screens
    document.getElementById('game-over-overlay').classList.add('hidden');
    
    // Configure player bar names & avatars
    const playerBarName = document.getElementById('player-name');
    const opponentBarName = document.getElementById('opponent-name');
    
    if (gameMode === 'ai') {
        const diffText = ['쉬움', '보통', '어려움'][aiDifficulty];
        opponentName.textContent = `Computer (AI ${diffText})`;
        opponentAvatar.innerHTML = '<i class="fa-solid fa-robot"></i>';
        document.getElementById('ai-difficulty-container').style.display = 'flex';
        
        if (playerColor === 'w') {
            playerBarName.textContent = '플레이어 (백)';
        } else {
            playerBarName.textContent = '플레이어 (흑)';
        }
    } else {
        opponentName.textContent = '플레이어 2 (흑)';
        opponentAvatar.innerHTML = '<i class="fa-solid fa-user"></i>';
        playerBarName.textContent = '플레이어 1 (백)';
        document.getElementById('ai-difficulty-container').style.display = 'none';
    }
    
    initBoard();
    updateUI();
    updateUndoRedoButtons();
    startTimer();
    
    // If AI is White, trigger AI move first
    if (gameMode === 'ai' && playerColor === 'b') {
        triggerAIMove();
    }
}

// 14. Event listeners & Theme manager Setup
// Mode Change Triggers
document.querySelectorAll('input[name="game-mode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        const diffContainer = document.getElementById('ai-difficulty-container');
        if (e.target.value === 'pvp') {
            diffContainer.style.display = 'none';
        } else {
            diffContainer.style.display = 'flex';
        }
    });
});

// Tab switcher (right console: Play / Stats / Settings)
document.querySelectorAll('.tab-btn').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
        button.classList.add('active');
        document.getElementById(button.dataset.tab).classList.remove('hidden');
    });
});

// 왼쪽 네비게이션 → 오른쪽 콘솔 탭 연결 (Play / 통계)
function activateConsoleTab(tabId) {
    const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (tabBtn) tabBtn.click(); // 기존 탭 전환 로직을 그대로 재사용
}
function setActiveNav(navId) {
    document.querySelectorAll('.side-nav .nav-item').forEach(n => n.classList.remove('active'));
    const el = document.getElementById(navId);
    if (el) el.classList.add('active');
}

// 저장된 경기 날짜로 연속 플레이 일수를 계산한다 (마지막 플레이 날부터 거꾸로 이어지는 일수).
function getConsecutiveDays() {
    const days = [...new Set(
        gameSummaries.map(s => (s.endedAt || '').slice(0, 10)).filter(Boolean)
    )].sort().reverse();
    if (days.length === 0) return 0;

    let streak = 1;
    let prev = new Date(days[0]);
    for (let i = 1; i < days.length; i++) {
        const cur = new Date(days[i]);
        const diffDays = Math.round((prev - cur) / 86400000);
        if (diffDays === 1) { streak++; prev = cur; }
        else break;
    }
    return streak;
}

// 홈 대시보드 카드 값을 채운다 (연속 일수, AI전 전적, 최근 경기 리뷰 버튼).
function renderHome() {
    const greetEl = document.getElementById('home-greeting');
    if (greetEl) {
        greetEl.textContent = currentUser
            ? `${currentUser}님, 오늘도 한 판 두고 분석해 볼까요?`
            : '체스를 두고, 데이터로 실력을 분석하세요.';
    }

    const streakEl = document.getElementById('home-streak');
    if (streakEl) streakEl.textContent = `${getConsecutiveDays()}일`;

    let w = 0, d = 0, l = 0;
    gameSummaries.forEach(s => {
        if (s.gameMode !== 'ai') return;
        if (s.outcome === 'win') w++;
        else if (s.outcome === 'loss') l++;
        else if (s.outcome === 'draw') d++;
    });
    const recordEl = document.getElementById('home-record');
    if (recordEl) recordEl.textContent = `${w}-${d}-${l}`;
    const totalEl = document.getElementById('home-total');
    if (totalEl) totalEl.textContent = `총 ${gameSummaries.length}경기`;

    // 게임 리뷰 버튼: 최근 완료 경기가 있으면 그 경기를 가리키고, 없으면 비활성화.
    const reviewBtn = document.getElementById('home-review-btn');
    const reviewLabel = document.getElementById('home-review-label');
    const last = gameSummaries[gameSummaries.length - 1];
    if (reviewBtn && reviewLabel) {
        if (last) {
            reviewBtn.disabled = false;
            reviewLabel.textContent = `최근 경기 분석 (게임 ${last.gameId.replace('game-', '')})`;
        } else {
            reviewBtn.disabled = true;
            reviewLabel.textContent = '완료된 경기가 아직 없어요';
        }
    }

    // "바로 시작" 버튼: 진행 중인 게임이 있으면 "이어서 하기"로 표시.
    const playSpan = document.querySelector('#home-play-btn span');
    if (playSpan) playSpan.textContent = isGameInProgress() ? '이어서 하기 (진행 중)' : '바로 시작 (기본 설정)';
}

// 여러 화면 모드 클래스를 한 번에 정리한다.
function clearMainModes() {
    const main = document.querySelector('.chess-main');
    if (main) main.classList.remove('home-mode', 'stats-mode', 'replay-mode');
}

// 홈 모드: 게임판/콘솔을 숨기고 대시보드만 보여준다. 게임은 아직 시작하지 않는다.
function enterHomeMode() {
    clearMainModes();
    const main = document.querySelector('.chess-main');
    if (main) main.classList.add('home-mode');
    renderHome();
    setActiveNav('nav-home');
}

// 플레이 모드: 게임판 + 오른쪽 콘솔(Play/Settings 탭)을 보여준다. 홈/통계는 숨긴다.
function enterPlayMode(tabId = 'game-tab') {
    clearMainModes();
    const statsTab = document.getElementById('stats-tab');
    if (statsTab) statsTab.classList.add('hidden');
    activateConsoleTab(tabId); // game-tab 또는 settings-tab 활성화
    setActiveNav('nav-home'); // 별도 Play 탭이 없으므로 Home을 활성 표시로 둔다
}

// 통계 모드: 게임판과 콘솔 탭바를 숨기고 통계(stats-tab)만 크게 보여준다.
function enterStatsMode() {
    clearMainModes();
    const main = document.querySelector('.chess-main');
    if (main) main.classList.add('stats-mode');
    ['game-tab', 'settings-tab'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    const statsTab = document.getElementById('stats-tab');
    if (statsTab) statsTab.classList.remove('hidden');
    renderStatsDashboard(); // 열 때 최신 데이터로 갱신
    setActiveNav('nav-stats');
}

// 홈의 "게임 시작" 버튼: 새 게임을 시작하고 플레이 화면으로 전환한다.
function startPlaying() {
    startNewGame();
    enterPlayMode('game-tab');
}

const navHome = document.getElementById('nav-home');
if (navHome) navHome.addEventListener('click', (event) => {
    event.preventDefault();
    enterHomeMode();
});

const navStats = document.getElementById('nav-stats');
if (navStats) navStats.addEventListener('click', (event) => {
    event.preventDefault();
    enterStatsMode();
});

// 진행 중인 게임이 있으면 이어서, 없으면 새로 시작 (Play 탭이 없으므로 이어하기 경로 제공)
function isGameInProgress() {
    return !!currentGameId && !game.game_over() && !gameManuallyEnded;
}
const homePlayBtn = document.getElementById('home-play-btn');
if (homePlayBtn) homePlayBtn.addEventListener('click', () => {
    if (isGameInProgress()) enterPlayMode('game-tab');
    else startPlaying();
});

// 홈 카드의 "봇과 플레이 / 2인 플레이" — 모드를 설정하고 바로 시작한다.
document.querySelectorAll('.home-action[data-play]').forEach(btn => {
    btn.addEventListener('click', () => {
        const mode = btn.dataset.play; // 'ai' | 'pvp'
        const radio = document.querySelector(`input[name="game-mode"][value="${mode}"]`);
        if (radio) radio.checked = true; // startNewGame이 이 값을 읽어 게임을 만든다
        startPlaying();
    });
});

// 홈 카드의 "게임 리뷰" — 통계 화면으로 이동해 최근 경기를 Stockfish로 분석한다.
const homeReviewBtn = document.getElementById('home-review-btn');
if (homeReviewBtn) homeReviewBtn.addEventListener('click', () => {
    const last = gameSummaries[gameSummaries.length - 1];
    if (!last) return;
    enterStatsMode();
    analyzeGameById(last.gameId, `게임 ${last.gameId.replace('game-', '')}`);
});

// ==========================================================================
//  리플레이(복기): 저장된 완료 경기를 한 수씩 넘겨보며 복기한다.
//  라이브 game 객체를 건드리지 않도록 전용 렌더 함수로 국면을 그린다.
// ==========================================================================
let replayFens = [];   // [시작국면, 1수후, 2수후, ...] FEN 목록
let replayMoves = [];  // [{ san, from, to, color }, ...]
let replayIndex = 0;   // 현재 보고 있는 국면 인덱스 (0 = 시작 위치)

// FEN 하나를 replay 보드에 그린다 (백이 아래인 고정 방향, 클릭/드래그 없음).
function renderReplayBoard(fen, lastMove) {
    const boardEl = document.getElementById('replay-board');
    if (!boardEl) return;
    const temp = new Chess(fen);
    const boardState = temp.board();
    boardEl.innerHTML = '';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const squareName = getSquareName(r, c);
            const sq = document.createElement('div');
            sq.classList.add('square', ((r + c) % 2 === 0) ? 'light' : 'dark');
            if (lastMove && (squareName === lastMove.from || squareName === lastMove.to)) {
                sq.classList.add('last-move');
            }
            const piece = boardState[r][c];
            if (piece) {
                const pe = document.createElement('div');
                pe.classList.add('piece', piece.color === 'w' ? 'white' : 'black');
                pe.innerHTML = getPieceSVG(piece.type, piece.color);
                sq.appendChild(pe);
            }
            boardEl.appendChild(sq);
        }
    }
}

function renderReplayMoveList() {
    const el = document.getElementById('replay-moves');
    if (!el) return;
    let html = '';
    for (let i = 0; i < replayMoves.length; i += 2) {
        const no = i / 2 + 1;
        const wm = replayMoves[i];
        const bm = replayMoves[i + 1];
        html += `<div class="replay-row"><span class="num">${no}.</span>` +
            `<span class="replay-move" data-idx="${i}">${wm ? wm.san : ''}</span>` +
            `<span class="replay-move" data-idx="${i + 1}">${bm ? bm.san : ''}</span></div>`;
    }
    el.innerHTML = html;
    el.querySelectorAll('.replay-move').forEach(cell => {
        cell.addEventListener('click', () => {
            if (!cell.textContent) return;
            replayGoto(Number(cell.dataset.idx) + 1); // 그 수를 둔 "직후" 국면
        });
    });
}

function renderReplayStep() {
    const lastMove = replayIndex > 0 ? replayMoves[replayIndex - 1] : null;
    renderReplayBoard(replayFens[replayIndex], lastMove);

    const statusEl = document.getElementById('replay-status');
    if (statusEl) {
        if (replayIndex === 0) {
            statusEl.textContent = `시작 위치 (총 ${replayMoves.length}수)`;
        } else {
            const m = replayMoves[replayIndex - 1];
            statusEl.textContent = `${replayIndex} / ${replayMoves.length}수 — ${m.color === 'w' ? '백' : '흑'} ${m.san}`;
        }
    }

    document.querySelectorAll('.replay-move').forEach(el => {
        el.classList.toggle('active', Number(el.dataset.idx) === replayIndex - 1);
    });

    const atStart = replayIndex === 0;
    const atEnd = replayIndex >= replayFens.length - 1;
    const setDisabled = (id, v) => { const b = document.getElementById(id); if (b) b.disabled = v; };
    setDisabled('replay-first', atStart);
    setDisabled('replay-prev', atStart);
    setDisabled('replay-next', atEnd);
    setDisabled('replay-last', atEnd);
}

function replayGoto(idx) {
    replayIndex = Math.max(0, Math.min(idx, replayFens.length - 1));
    renderReplayStep();
}

// 리플레이 모드로 전환 (게임판/콘솔/홈/통계 숨기고 복기 화면만 표시).
function enterReplayMode() {
    clearMainModes();
    const main = document.querySelector('.chess-main');
    if (main) main.classList.add('replay-mode');
    setActiveNav('nav-stats'); // 통계에서 진입하므로 통계를 활성 표시로 둔다
}

// 특정 gameId의 저장된 로그를 재생해 복기를 시작한다.
function startReplay(gameId) {
    const logs = moveLogs
        .filter(l => l.gameId === gameId)
        .slice()
        .sort((a, b) => a.moveNumber - b.moveNumber);

    if (logs.length === 0) {
        alert('이 경기에는 복기할 이동 기록이 없습니다.');
        return;
    }

    const replay = new Chess();
    replayFens = [replay.fen()];
    replayMoves = [];
    for (const log of logs) {
        const mv = replay.move(log.san);
        if (!mv) break; // 손상된 로그 방어
        replayFens.push(replay.fen());
        replayMoves.push({ san: mv.san, from: mv.from, to: mv.to, color: mv.color });
    }
    replayIndex = 0;

    const titleEl = document.getElementById('replay-title');
    if (titleEl) titleEl.textContent = `복기 — 게임 ${gameId.replace('game-', '')}`;

    enterReplayMode();
    renderReplayMoveList();
    renderReplayStep();
}

// 복기 화면 컨트롤 배선
const replayBackBtn = document.getElementById('replay-back-btn');
if (replayBackBtn) replayBackBtn.addEventListener('click', enterStatsMode);
const rFirst = document.getElementById('replay-first');
if (rFirst) rFirst.addEventListener('click', () => replayGoto(0));
const rPrev = document.getElementById('replay-prev');
if (rPrev) rPrev.addEventListener('click', () => replayGoto(replayIndex - 1));
const rNext = document.getElementById('replay-next');
if (rNext) rNext.addEventListener('click', () => replayGoto(replayIndex + 1));
const rLast = document.getElementById('replay-last');
if (rLast) rLast.addEventListener('click', () => replayGoto(replayFens.length - 1));

// 경기 목록 표의 "복기" 버튼 (이벤트 위임)
const gameSummaryBodyReplay = document.getElementById('game-summary-body');
if (gameSummaryBodyReplay) gameSummaryBodyReplay.addEventListener('click', (e) => {
    const btn = e.target.closest('.replay-row-btn');
    if (!btn) return;
    startReplay(btn.dataset.gameid);
});

// UI Modal toggles
const themeModal = document.getElementById('theme-modal');
const rulesModal = document.getElementById('rules-modal');

document.getElementById('nav-themes').addEventListener('click', (event) => {
    event.preventDefault();
    themeModal.classList.remove('hidden');
});
document.getElementById('close-theme-btn').addEventListener('click', () => themeModal.classList.add('hidden'));

// (Learn 버튼은 제거됨 — 규칙 모달은 아래 Help 버튼으로 계속 열 수 있다.)
document.getElementById('nav-help').addEventListener('click', (event) => {
    event.preventDefault();
    rulesModal.classList.remove('hidden');
});
document.getElementById('close-rules-btn').addEventListener('click', () => rulesModal.classList.add('hidden'));

document.getElementById('nav-sound').addEventListener('click', (event) => {
    event.preventDefault();
    SoundController.toggleMute();
});
document.getElementById('new-game-btn').addEventListener('click', startNewGame);
document.getElementById('restart-game-btn').addEventListener('click', startNewGame);

document.getElementById('resign-btn').addEventListener('click', resignGame);
document.getElementById('draw-claim-btn').addEventListener('click', offerDraw);

document.getElementById('undo-btn').addEventListener('click', performUndo);
document.getElementById('redo-btn').addEventListener('click', performRedo);
exportCsvBtn.addEventListener('click', downloadCSV);
clearDataBtn.addEventListener('click', clearMoveLogs);
exportGamesCsvBtn.addEventListener('click', downloadGameSummariesCSV);
clearGamesBtn.addEventListener('click', clearGameSummaries);

const sfAnalyzeBtn = document.getElementById('sf-analyze-btn');
if (sfAnalyzeBtn) sfAnalyzeBtn.addEventListener('click', analyzeCurrentGameWithStockfish);

// 경기 목록 표의 "분석" 버튼 (이벤트 위임 — 표가 다시 그려져도 계속 동작)
const gameSummaryBodyEl = document.getElementById('game-summary-body');
if (gameSummaryBodyEl) gameSummaryBodyEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.sf-row-btn');
    if (!btn) return;
    const gameId = btn.dataset.gameid;
    analyzeGameById(gameId, `게임 ${gameId.replace('game-', '')}`);
});

// Theme Picker Logic
document.querySelectorAll('.theme-option').forEach(opt => {
    opt.addEventListener('click', () => {
        document.querySelectorAll('.theme-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        
        // Remove old theme classes
        document.body.className = '';
        const theme = opt.dataset.theme;
        if (theme !== 'midnight') {
            document.body.classList.add(`theme-${theme}`);
        }
        
        // Re-draw board cells to apply changes
        initBoard();
    });
});

// Keyboard hotkeys for quick interaction
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'z') {
        performUndo();
    }
    if (e.ctrlKey && e.key === 'y') {
        performRedo();
    }
});

// Start Game automatically on load
// ==========================================================================
//  간단 로그인 / 회원가입 (클라이언트 전용 — localStorage 기반)
//  ⚠️ 서버가 없는 정적 사이트라 "진짜" 보안이 아니다. 흐름 학습 + 사용자별 데이터 분리 용도.
// ==========================================================================
const USERS_STORAGE_KEY = 'chessUsers';
const CURRENT_USER_KEY = 'chessCurrentUser';

function getUsers() {
    try {
        return JSON.parse(localStorage.getItem(USERS_STORAGE_KEY)) || {};
    } catch (e) {
        return {};
    }
}
function saveUsers(users) {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

// 비밀번호를 평문으로 저장하지 않도록 해시한다.
// 보안 컨텍스트(localhost 등)에서는 SHA-256, 불가하면(file:// 등) 간단한 대체 해시.
async function hashPassword(password) {
    try {
        if (typeof crypto !== 'undefined' && crypto.subtle) {
            const data = new TextEncoder().encode(password);
            const buf = await crypto.subtle.digest('SHA-256', data);
            return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        }
    } catch (e) { /* 대체 해시로 넘어감 */ }
    let h = 5381;
    for (let i = 0; i < password.length; i++) h = ((h << 5) + h + password.charCodeAt(i)) | 0;
    return 'fallback-' + (h >>> 0).toString(16);
}

async function signupUser(username, password, password2) {
    username = (username || '').trim();
    if (username.length < 2) return { ok: false, error: '아이디는 2자 이상이어야 합니다.' };
    if ((password || '').length < 4) return { ok: false, error: '비밀번호는 4자 이상이어야 합니다.' };
    if (password !== password2) return { ok: false, error: '비밀번호가 서로 다릅니다.' };
    const users = getUsers();
    if (users[username]) return { ok: false, error: '이미 존재하는 아이디입니다.' };
    users[username] = { username, passHash: await hashPassword(password), createdAt: new Date().toISOString() };
    saveUsers(users);
    return { ok: true };
}

async function loginUser(username, password) {
    username = (username || '').trim();
    const user = getUsers()[username];
    if (!user) return { ok: false, error: '존재하지 않는 아이디입니다.' };
    if (await hashPassword(password) !== user.passHash) return { ok: false, error: '비밀번호가 올바르지 않습니다.' };
    return { ok: true };
}

// 로그인/게스트 전환: 사용자 설정 → 그 사용자 데이터 로드 → 화면 갱신 → 홈 화면.
function enterAsUser(username) {
    currentUser = username || null; // null이면 게스트(공용 데이터)
    if (currentUser) localStorage.setItem(CURRENT_USER_KEY, currentUser);
    else localStorage.removeItem(CURRENT_USER_KEY);

    loadLogsFromStorage();
    loadGameSummariesFromStorage();
    renderDataLab();
    renderStatsDashboard();
    renderAuthState();
    hideAuthOverlay();
    enterHomeMode(); // 바로 시작하지 않고 홈 화면으로
}

function logoutUser() {
    localStorage.removeItem(CURRENT_USER_KEY);
    currentUser = null;
    renderAuthState();
    showAuthOverlay();
}

function showAuthOverlay() {
    const el = document.getElementById('auth-overlay');
    if (el) el.classList.remove('hidden');
}
function hideAuthOverlay() {
    const el = document.getElementById('auth-overlay');
    if (el) el.classList.add('hidden');
}

// 왼쪽 네비 하단에 로그인 상태(사용자 이름 + 로그아웃/로그인 버튼)를 표시한다.
function renderAuthState() {
    const box = document.getElementById('nav-user');
    if (!box) return;
    if (currentUser) {
        box.innerHTML = `
            <span class="nav-user-name"><i class="fa-solid fa-circle-user"></i> ${currentUser}</span>
            <button type="button" id="logout-btn" class="nav-logout"><i class="fa-solid fa-right-from-bracket"></i> 로그아웃</button>
        `;
        const lo = document.getElementById('logout-btn');
        if (lo) lo.addEventListener('click', logoutUser);
    } else {
        box.innerHTML = `
            <span class="nav-user-name"><i class="fa-solid fa-user-secret"></i> 게스트</span>
            <button type="button" id="login-open-btn" class="nav-logout"><i class="fa-solid fa-right-to-bracket"></i> 로그인</button>
        `;
        const li = document.getElementById('login-open-btn');
        if (li) li.addEventListener('click', showAuthOverlay);
    }
}

// 인증 UI 배선 (로그인/회원가입 탭 전환, 폼 제출, 게스트 버튼)
function initAuthUI() {
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const mode = tab.dataset.auth;
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t === tab));
            document.getElementById('login-form').classList.toggle('hidden', mode !== 'login');
            document.getElementById('signup-form').classList.toggle('hidden', mode !== 'signup');
            document.getElementById('login-error').textContent = '';
            document.getElementById('signup-error').textContent = '';
        });
    });

    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errEl = document.getElementById('login-error');
        errEl.textContent = '';
        const name = document.getElementById('login-username').value;
        const res = await loginUser(name, document.getElementById('login-password').value);
        if (res.ok) enterAsUser(name.trim());
        else errEl.textContent = res.error;
    });

    const signupForm = document.getElementById('signup-form');
    if (signupForm) signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errEl = document.getElementById('signup-error');
        errEl.textContent = '';
        const name = document.getElementById('signup-username').value;
        const res = await signupUser(name, document.getElementById('signup-password').value, document.getElementById('signup-password2').value);
        if (res.ok) enterAsUser(name.trim());
        else errEl.textContent = res.error;
    });

    const guestBtn = document.getElementById('guest-btn');
    if (guestBtn) guestBtn.addEventListener('click', () => enterAsUser(null));
}

window.addEventListener('load', () => {
    initAuthUI();

    // 저장된 로그인 세션이 있으면 자동 로그인, 없으면 인증 화면을 띄운다.
    const saved = localStorage.getItem(CURRENT_USER_KEY);
    currentUser = (saved && getUsers()[saved]) ? saved : null;

    loadLogsFromStorage();
    loadGameSummariesFromStorage();
    renderDataLab();
    renderStatsDashboard();
    renderAuthState();
    enterHomeMode(); // 진입 시 바로 시작하지 않고 홈 화면을 보여준다

    if (currentUser) hideAuthOverlay();
    else showAuthOverlay();
});
