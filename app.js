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

// DATA ENGINEERING STUDENT PROJECT
// 이 배열은 체스 게임에서 발생하는 "원천 로그(raw event log)"를 담는 저장소입니다.
// 학생 과제는 아래 TODO 함수들을 완성해서 이 로그를 수집, 저장, 변환, 출력하는 것입니다.
const DATA_LOG_STORAGE_KEY = 'chessDataEngineeringMoveLogs';
const GAME_SUMMARY_STORAGE_KEY = 'chessDataEngineeringGameSummaries';
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
    localStorage.setItem(DATA_LOG_STORAGE_KEY, JSON.stringify(moveLogs));
}

function saveGameSummariesToStorage() {
    localStorage.setItem(GAME_SUMMARY_STORAGE_KEY, JSON.stringify(gameSummaries));
}

function loadLogsFromStorage() {
    // TODO 3: JSON.parse가 실패하는 상황을 가정하고 예외 처리를 개선해보세요.
    const savedLogs = localStorage.getItem(DATA_LOG_STORAGE_KEY);
    moveLogs = savedLogs ? JSON.parse(savedLogs) : [];
}

function loadGameSummariesFromStorage() {
    const savedGames = localStorage.getItem(GAME_SUMMARY_STORAGE_KEY);
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
        gameSummaryBody.innerHTML = '<tr><td colspan="8">아직 완료된 경기 데이터가 없습니다.</td></tr>';
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
    depth: 12,
    _pending: null,
    _readyResolve: null,
    _readyPromise: null,

    init() {
        if (this.worker) return this._readyPromise || Promise.resolve();
        this._readyPromise = new Promise((resolve, reject) => {
            this._readyResolve = resolve;
            try {
                this.worker = new Worker('stockfish.js');
            } catch (e) {
                reject(e);
                return;
            }
            this.worker.onmessage = (e) => this._onLine(typeof e.data === 'string' ? e.data : String(e.data));
            this.worker.onerror = (err) => { console.error('Stockfish worker error:', err && (err.message || err)); reject(err); };
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
            p.resolve({ scoreCp: p.scoreCp, isMate: p.isMate });
        }
    },

    // 한 국면(FEN)을 평가해 "둘 차례인 쪽" 관점 centipawn 점수를 돌려준다.
    evaluateFen(fen) {
        return new Promise((resolve) => {
            this._pending = { resolve, scoreCp: 0, isMate: false };
            this.worker.postMessage('position fen ' + fen);
            this.worker.postMessage('go depth ' + this.depth);
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

// 센티폰 손실을 사람이 읽는 등급으로 분류한다 (Lichess/Chess.com과 유사한 기준).
function classifyLoss(lossCp) {
    if (lossCp < 20) return 'best';
    if (lossCp < 90) return 'inaccuracy';
    if (lossCp < 200) return 'mistake';
    return 'blunder';
}

const LOSS_LABEL_KO = { best: '좋은 수', inaccuracy: '부정확', mistake: '실수', blunder: '블런더' };

// 각 FEN 평가(cpList, 둘 차례 관점)를 사람 관점 손실로 바꿔 정밀 리포트를 만든다.
function computeStockfishReport(cpList, orderedLogs) {
    // cpList[k] = fens[k] 평가. fens[0]은 백 차례라, k가 짝수면 백 차례 → White 관점으로 통일한다.
    const cpWhite = cpList.map((cp, k) => (k % 2 === 0 ? cp : -cp));

    const report = { analyzed: false, playerMoves: 0, best: 0, inaccuracy: 0, mistake: 0, blunder: 0, avgLoss: 0, worst: [] };
    const playerLogs = orderedLogs.filter(l => l.playerType === 'player');
    if (playerLogs.length === 0) return report;

    const sign = playerLogs[0].color === 'white' ? 1 : -1; // 사람이 흑이면 부호를 뒤집는다
    let lossSum = 0;
    const moveLosses = [];

    for (let i = 0; i < orderedLogs.length; i++) {
        const log = orderedLogs[i];
        if (log.playerType !== 'player') continue;
        if (i + 1 >= cpWhite.length) break; // 평가가 부족하면 방어적으로 중단

        const beforeW = cpWhite[i];
        const afterW = cpWhite[i + 1];
        let loss = (beforeW - afterW) * sign;      // 사람 관점: 양수 = 형세가 나빠짐
        loss = Math.max(0, Math.min(loss, 1000));  // 이득(음수)은 0, 상한 1000으로 클램프

        lossSum += loss;
        report.playerMoves++;
        report[classifyLoss(loss)]++;
        moveLosses.push({ san: log.san, moveNumber: log.moveNumber, loss: Math.round(loss) });
    }

    report.analyzed = true;
    report.avgLoss = report.playerMoves ? Math.round(lossSum / report.playerMoves) : 0;
    report.worst = moveLosses.sort((a, b) => b.loss - a.loss).slice(0, 3);
    return report;
}

let stockfishBusy = false;
async function analyzeCurrentGameWithStockfish() {
    if (stockfishBusy) return;
    const statusEl = document.getElementById('sf-status');
    const btn = document.getElementById('sf-analyze-btn');

    const orderedLogs = getCurrentGameLogs().slice().sort((a, b) => a.moveNumber - b.moveNumber);
    if (!orderedLogs.some(l => l.playerType === 'player')) {
        if (statusEl) statusEl.textContent = '분석할 내 수가 없습니다. VS Computer로 몇 수 두어 보세요.';
        return;
    }

    stockfishBusy = true;
    if (btn) btn.disabled = true;
    try {
        if (statusEl) statusEl.textContent = '엔진 로딩 중...';
        await StockfishAnalyzer.init();

        const fens = reconstructFens(orderedLogs);
        const cpList = [];
        for (let k = 0; k < fens.length; k++) {
            if (statusEl) statusEl.textContent = `분석 중... ${k + 1}/${fens.length} 국면`;
            const res = await StockfishAnalyzer.evaluateFen(fens[k]);
            cpList.push(res.scoreCp);
        }

        const report = computeStockfishReport(cpList, orderedLogs);
        renderStockfishReport(report);
        if (statusEl) statusEl.textContent = `분석 완료 (depth ${StockfishAnalyzer.depth}, ${report.playerMoves}수 채점).`;
    } catch (err) {
        console.error('Stockfish 분석 실패:', err);
        if (statusEl) statusEl.textContent = '분석 실패: 엔진(stockfish.js)을 불러오지 못했습니다.';
    } finally {
        stockfishBusy = false;
        if (btn) btn.disabled = false;
    }
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

    grid.innerHTML = `
        <div class="data-stat-card"><span class="stat-label">채점한 내 수</span><strong>${report.playerMoves}</strong></div>
        <div class="data-stat-card"><span class="stat-label">평균 손실(cp)</span><strong>${report.avgLoss}</strong></div>
        <div class="data-stat-card"><span class="stat-label">블런더</span><strong>${report.blunder}</strong></div>
        <div class="data-stat-card"><span class="stat-label">실수</span><strong>${report.mistake}</strong></div>
        <div class="data-stat-card"><span class="stat-label">부정확</span><strong>${report.inaccuracy}</strong></div>
        <div class="data-stat-card"><span class="stat-label">좋은 수</span><strong>${report.best}</strong></div>
    `;

    if (worstEl) {
        worstEl.innerHTML = report.worst.length
            ? '<h4><i class="fa-solid fa-arrow-trend-down"></i> 가장 아쉬웠던 수</h4><ul>' +
              report.worst.map(w => `<li><strong>${w.san}</strong> — ${w.loss}cp 손실 <span class="sf-tag sf-${classifyLoss(w.loss)}">${LOSS_LABEL_KO[classifyLoss(w.loss)]}</span></li>`).join('') +
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
    if (game.game_over()) return;
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
    if (game.game_over()) { e.preventDefault(); return; }
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
        showGameOverOverlay(title, reason, isWin);
        return true;
    }
    return false;
}

function showGameOverOverlay(title, reason, isWin) {
    document.getElementById('game-over-title').textContent = title;
    document.getElementById('game-over-reason').textContent = reason;
    document.getElementById('final-moves').textContent = Math.ceil(game.history().length / 2);
    document.getElementById('final-time').textContent = gameTimer.textContent;
    
    // Trophy icon update
    const icon = document.getElementById('game-over-icon');
    if (isWin) {
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
    
    // Read game mode & setup details
    const activeMode = document.querySelector('input[name="game-mode"]:checked').value;
    gameMode = activeMode;
    
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

const navPlay = document.getElementById('nav-play');
if (navPlay) navPlay.addEventListener('click', (event) => {
    event.preventDefault();
    activateConsoleTab('game-tab');
    setActiveNav('nav-play');
});

const navStats = document.getElementById('nav-stats');
if (navStats) navStats.addEventListener('click', (event) => {
    event.preventDefault();
    activateConsoleTab('stats-tab');
    setActiveNav('nav-stats');
    renderStatsDashboard(); // 열 때 최신 데이터로 갱신
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

document.getElementById('undo-btn').addEventListener('click', performUndo);
document.getElementById('redo-btn').addEventListener('click', performRedo);
exportCsvBtn.addEventListener('click', downloadCSV);
clearDataBtn.addEventListener('click', clearMoveLogs);
exportGamesCsvBtn.addEventListener('click', downloadGameSummariesCSV);
clearGamesBtn.addEventListener('click', clearGameSummaries);

const sfAnalyzeBtn = document.getElementById('sf-analyze-btn');
if (sfAnalyzeBtn) sfAnalyzeBtn.addEventListener('click', analyzeCurrentGameWithStockfish);

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
window.addEventListener('load', () => {
    loadLogsFromStorage();
    loadGameSummariesFromStorage();
    renderDataLab();
    renderStatsDashboard();
    startNewGame();
});
