// FocusME! Pomodoro Timer Logic

// Sound Synthesizer via Web Audio API (100% offline & reliable)
class SoundPlayer {
    constructor() {
        this.ctx = null;
        this.soundEnabled = true;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
    }

    playPop() {
        if (!this.soundEnabled) return;
        this.init();
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.08);

        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.09);
    }

    playTick() {
        if (!this.soundEnabled) return;
        this.init();
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(900, this.ctx.currentTime);

        gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.035);
    }

    playChime() {
        if (!this.soundEnabled) return;
        this.init();
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        // Cute kawaii bell chime: C5, E5, G5, C6 arpeggio
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const startTime = this.ctx.currentTime + idx * 0.16;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, startTime);

            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.3, startTime + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.8);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(startTime);
            osc.stop(startTime + 0.85);
        });
    }
}

// App State
const state = {
    mode: 'break', // 'break' (5m), 'study' (25m), 'work' (50m)
    durations: {
        break: 5,
        study: 25,
        work: 50
    },
    currentMinutes: 5,
    remainingSeconds: 5 * 60,
    isRunning: false,
    timerInterval: null,
    targetEndTime: null,
    isCompleting: false,
    isCompleted: false,
    onComplete: null,
    streak: 0,
    todayCompleted: 0,
    totalMinutes: 0,
    lastActiveDate: null,
    isPinned: false,
    sound: new SoundPlayer(),
    activeDates: new Set(),
    calendarViewDate: new Date(),
};

// Date helpers for Daily Streak
function getTodayDateStr(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getDaysDifference(fromStr, toStr) {
    if (!fromStr || !toStr) return 0;
    const d1 = new Date(fromStr);
    const d2 = new Date(toStr);
    const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
    const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
    return Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));
}

// Load saved data from localStorage
function loadSavedData() {
    try {
        const savedStreak = localStorage.getItem('focusme_streak');
        const savedCompleted = localStorage.getItem('focusme_completed');
        const savedTotalMinutes = localStorage.getItem('focusme_total_min');
        const savedDurations = localStorage.getItem('focusme_durations');
        const savedLastDate = localStorage.getItem('focusme_last_date');
        const savedActiveDates = localStorage.getItem('focusme_active_dates');

        const todayStr = getTodayDateStr();

        if (savedLastDate) {
            state.lastActiveDate = savedLastDate;
            const diff = getDaysDifference(savedLastDate, todayStr);

            if (diff === 0) {
                if (savedStreak) state.streak = parseInt(savedStreak, 10) || 0;
                if (savedCompleted) state.todayCompleted = parseInt(savedCompleted, 10) || 0;
            } else if (diff === 1) {
                if (savedStreak) state.streak = parseInt(savedStreak, 10) || 0;
                state.todayCompleted = 0;
            } else {
                state.streak = 0;
                state.todayCompleted = 0;
            }
        } else {
            if (savedStreak) state.streak = parseInt(savedStreak, 10) || 0;
            if (savedCompleted) state.todayCompleted = parseInt(savedCompleted, 10) || 0;
        }

        if (savedTotalMinutes) state.totalMinutes = parseInt(savedTotalMinutes, 10) || 0;
        if (savedDurations) {
            state.durations = Object.assign(state.durations, JSON.parse(savedDurations));
        }
        if (savedActiveDates) {
            try {
                const parsed = JSON.parse(savedActiveDates);
                state.activeDates = new Set(Array.isArray(parsed) ? parsed : []);
            } catch (_) {
                state.activeDates = new Set();
            }
        }
    } catch (e) {
        console.error('Failed to load local storage:', e);
    }
}

function saveData() {
    try {
        localStorage.setItem('focusme_streak', state.streak.toString());
        localStorage.setItem('focusme_completed', state.todayCompleted.toString());
        localStorage.setItem('focusme_total_min', state.totalMinutes.toString());
        localStorage.setItem('focusme_durations', JSON.stringify(state.durations));
        if (state.lastActiveDate) {
            localStorage.setItem('focusme_last_date', state.lastActiveDate);
        } else {
            localStorage.removeItem('focusme_last_date');
        }
        localStorage.setItem('focusme_active_dates', JSON.stringify([...state.activeDates]));
    } catch (e) {
        console.error('Failed to save state:', e);
    }
}

// Format seconds into MM:SS
function formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// DOM Elements
let timeDisplay = null;
let statusBadge = null;
let durationSlider = null;
let sliderLabel = null;
let clockIllustration = null;
let minuteHand = null;
let hourHand = null;

let modeBreakBtn = null;
let modeStudyBtn = null;
let modeWorkBtn = null;

let flameBtn = null;
let infoBtn = null;
let statsModal = null;
let infoModal = null;
let closeStatsBtn = null;
let closeInfoBtn = null;

let streakCountEl = null;
let completedCountEl = null;
let totalTimeEl = null;

let soundToggleInput = null;
let pinToggleInput = null;
let inputBreakDuration = null;
let inputStudyDuration = null;
let inputWorkDuration = null;
let resetStreakBtn = null;

// Calendar elements
let calPrevBtn = null;
let calNextBtn = null;
let calMonthLabel = null;
let calGrid = null;

// Window controls (via Electron preload)
let btnClose = null;
let btnMin = null;
let btnPin = null;

function queryDOMElements() {
    if (typeof document === 'undefined') return;
    timeDisplay = document.getElementById('time-display');
    statusBadge = document.getElementById('status-badge');
    durationSlider = document.getElementById('duration-slider');
    sliderLabel = document.getElementById('slider-label');
    clockIllustration = document.getElementById('clock-illustration');
    minuteHand = document.getElementById('minute-hand-group');
    hourHand = document.getElementById('hour-hand-group');

    modeBreakBtn = document.getElementById('mode-break');
    modeStudyBtn = document.getElementById('mode-study');
    modeWorkBtn = document.getElementById('mode-work');

    flameBtn = document.getElementById('btn-flame');
    infoBtn = document.getElementById('btn-info');
    statsModal = document.getElementById('stats-modal');
    infoModal = document.getElementById('info-modal');
    closeStatsBtn = document.getElementById('close-stats');
    closeInfoBtn = document.getElementById('close-info');

    streakCountEl = document.getElementById('streak-count');
    completedCountEl = document.getElementById('completed-count');
    totalTimeEl = document.getElementById('total-time');

    soundToggleInput = document.getElementById('sound-toggle');
    pinToggleInput = document.getElementById('pin-toggle');
    inputBreakDuration = document.getElementById('input-break-duration');
    inputStudyDuration = document.getElementById('input-study-duration');
    inputWorkDuration = document.getElementById('input-work-duration');
    resetStreakBtn = document.getElementById('reset-streak-btn');

    calPrevBtn = document.getElementById('cal-prev');
    calNextBtn = document.getElementById('cal-next');
    calMonthLabel = document.getElementById('cal-month-label');
    calGrid = document.getElementById('cal-grid');

    btnClose = document.getElementById('win-close');
    btnMin = document.getElementById('win-min');
    btnPin = document.getElementById('win-pin');
}

function setupWindowControls() {
    if (typeof window !== 'undefined' && window.electronAPI) {
        if (btnClose) btnClose.addEventListener('click', () => window.electronAPI.close());
        if (btnMin) btnMin.addEventListener('click', () => window.electronAPI.minimize());
        if (btnPin) {
            btnPin.addEventListener('click', () => {
                state.isPinned = !state.isPinned;
                window.electronAPI.togglePin(state.isPinned);
                btnPin.classList.toggle('opacity-100', state.isPinned);
                btnPin.classList.toggle('opacity-50', !state.isPinned);
                if (pinToggleInput) pinToggleInput.checked = state.isPinned;
            });
        }
    }
}

// Update clock hands based on remaining time
function updateClockHands() {
    const totalDurationSecs = state.currentMinutes * 60;
    const elapsedSecs = totalDurationSecs - state.remainingSeconds;
    const progressRatio = totalDurationSecs > 0 ? elapsedSecs / totalDurationSecs : 0;

    // Minute hand starts at 120deg (approx 4 o'clock) and rotates full circle
    const baseMinuteAngle = 125;
    const minuteAngle = baseMinuteAngle + (progressRatio * 360);

    // Hour hand starts at 0deg (12 o'clock)
    const hourAngle = (progressRatio * 30);

    if (minuteHand) {
        minuteHand.setAttribute('transform', `rotate(${minuteAngle} 130 140)`);
    }
    if (hourHand) {
        hourHand.setAttribute('transform', `rotate(${hourAngle} 130 140)`);
    }
}

// Update UI
function updateUI() {
    if (timeDisplay) {
        timeDisplay.textContent = formatTime(state.remainingSeconds);
    }

    if (sliderLabel) {
        sliderLabel.textContent = `${state.currentMinutes} min`;
    }

    if (durationSlider) {
        durationSlider.value = state.currentMinutes;
    }

    if (statusBadge) {
        if (state.isRunning) {
            statusBadge.textContent = 'PAUSE';
            statusBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#fca0b5] text-white shadow-xs';
        } else {
            statusBadge.textContent = state.remainingSeconds === state.currentMinutes * 60 ? 'START' : 'RESUME';
            statusBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#a3cff0] text-[#1e4e79] shadow-xs';
        }
    }

    // Animation states on clock
    if (clockIllustration) {
        if (state.isRunning) {
            clockIllustration.classList.add('anim-ticking');
        } else {
            clockIllustration.classList.remove('anim-ticking');
        }
    }

    // Active mode styling
    [{
            el: modeBreakBtn,
            key: 'break'
        },
        {
            el: modeStudyBtn,
            key: 'study'
        },
        {
            el: modeWorkBtn,
            key: 'work'
        },
    ].forEach(({
        el,
        key
    }) => {
        if (!el) return;
        if (state.mode === key) {
            el.classList.add('ring-3', 'ring-[#fca0b5]', 'scale-110', 'shadow-md');
            el.classList.remove('opacity-70');
        } else {
            el.classList.remove('ring-3', 'ring-[#fca0b5]', 'scale-110', 'shadow-md');
            el.classList.add('opacity-70');
        }
    });

    updateClockHands();
}

// Start Timer
function startTimer(onComplete) {
    if (typeof onComplete === 'function') {
        state.onComplete = onComplete;
    }

    // 1. Guard against Double Interval: Always clear existing interval
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }

    if (state.isRunning) return;
    state.isRunning = true;
    state.sound.playPop();

    // 2. Guard against Timer Drift: Anchor to real wall-clock time
    state.targetEndTime = Date.now() + state.remainingSeconds * 1000;

    updateUI();

    state.timerInterval = setInterval(() => {
        tickTimer();
    }, 1000);
}

// Timer tick handler (drift-free)
function tickTimer() {
    if (!state.isRunning) {
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
        return;
    }

    // Drift-free calculation based on wall-clock time
    if (state.targetEndTime) {
        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((state.targetEndTime - now) / 1000));
        state.remainingSeconds = remaining;
    } else if (state.remainingSeconds > 0) {
        state.remainingSeconds--;
    }

    if (state.remainingSeconds <= 0) {
        completeSession();
    } else {
        updateUI();
    }
}

// Pause Timer
function pauseTimer() {
    if (!state.isRunning && !state.timerInterval) return;
    state.isRunning = false;

    // Clear and nullify interval
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }

    // Recalculate remaining seconds before clearing targetEndTime to freeze exactly
    if (state.targetEndTime) {
        const now = Date.now();
        state.remainingSeconds = Math.max(0, Math.ceil((state.targetEndTime - now) / 1000));
        state.targetEndTime = null;
    }

    state.sound.playPop();
    updateUI();
}

// Toggle Timer
function toggleTimer() {
    if (state.isRunning) {
        pauseTimer();
    } else {
        startTimer();
    }
}

// Complete Session
function completeSession() {
    // 3. Guard against duplicate completeSession / onComplete calls
    if (state.isCompleting) return;
    state.isCompleting = true;

    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }
    state.isRunning = false;
    state.targetEndTime = null;

    // Trigger onComplete hook if provided (guaranteed exactly once)
    if (typeof state.onComplete === 'function') {
        const cb = state.onComplete;
        state.onComplete = null;
        try {
            cb();
        } catch (e) {
            console.error('Error in onComplete callback:', e);
        }
    }

    // Sound chime
    state.sound.playChime();

    // Trigger ringing shake
    if (clockIllustration) {
        clockIllustration.classList.remove('anim-ticking');
        clockIllustration.classList.add('anim-ringing');
        setTimeout(() => {
            if (clockIllustration) clockIllustration.classList.remove('anim-ringing');
        }, 4000);
    }

    // Update stats
    const todayStr = getTodayDateStr();
    if (!state.lastActiveDate) {
        state.streak = 1;
    } else {
        const diff = getDaysDifference(state.lastActiveDate, todayStr);
        if (diff === 0) {
            if (state.streak === 0) state.streak = 1;
        } else if (diff === 1) {
            state.streak++;
        } else {
            state.streak = 1;
        }
    }
    state.lastActiveDate = todayStr;
    state.activeDates.add(todayStr);
    state.todayCompleted++;
    state.totalMinutes += state.currentMinutes;
    saveData();

    // Reset timer
    state.remainingSeconds = state.currentMinutes * 60;
    updateUI();
    updateStatsDisplay();

    // Native notification if available
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('FocusME! 🎉', {
            body: `Sesi ${state.mode.toUpperCase()} selesai! Kerja bagus!`,
            icon: 'assets/icon.png',
        });
    }

    state.isCompleting = false;
}

// Switch Mode
function setMode(mode) {
    pauseTimer();
    state.mode = mode;
    state.currentMinutes = state.durations[mode];
    state.remainingSeconds = state.currentMinutes * 60;
    state.sound.playPop();
    updateUI();
}

// Slider Change
function handleSliderChange(val) {
    pauseTimer();
    const mins = parseInt(val, 10);
    state.currentMinutes = mins;
    state.durations[state.mode] = mins;
    state.remainingSeconds = mins * 60;
    saveData();
    updateUI();
}

// Stats modal display
function updateStatsDisplay() {
    if (streakCountEl) streakCountEl.textContent = state.streak;
    if (completedCountEl) completedCountEl.textContent = state.todayCompleted;
    if (totalTimeEl) totalTimeEl.textContent = `${state.totalMinutes} min`;
    renderCalendar();
}

// Indonesian month names
const MONTH_NAMES = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

// Calendar rendering
function renderCalendar() {
    if (!calGrid || !calMonthLabel) return;

    const viewDate = state.calendarViewDate;
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    calMonthLabel.textContent = `${year} ${MONTH_NAMES[month]}`;

    // First day of month (0=Sun, convert to Mon=0)
    const firstDay = new Date(year, month, 1).getDay();
    const startOffset = (firstDay === 0) ? 6 : firstDay - 1; // Mon-based offset
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const todayStr = getTodayDateStr();

    let html = '';

    // Leading cells from previous month (grayed out)
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
        const prevDay = prevMonthDays - i;
        html += `<div class="py-1.5 border border-[#e47b80] flex items-center justify-center font-pixel text-[10px] text-[#8c7482]">${prevDay}</div>`;
    }

    // Current month day cells
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isActive = state.activeDates.has(dateStr);
        const isToday = dateStr === todayStr;

        let classes = 'py-1.5 border border-[#e47b80] flex items-center justify-center font-pixel text-[10px] transition-all';
        if (isActive) {
            classes += ' bg-[#E6934A] text-white font-bold shadow-xs';
        } else if (isToday) {
            classes += ' ring-1 ring-[#fca0b5] text-[#222222] font-bold';
        } else {
            classes += ' text-[#222222]';
        }

        html += `<div class="${classes}">${day}</div>`;
    }

    // Trailing cells into next month (grayed out)
    const totalRendered = startOffset + daysInMonth;
    const trailingCells = (totalRendered % 7 === 0) ? 0 : 7 - (totalRendered % 7);
    for (let i = 1; i <= trailingCells; i++) {
        html += `<div class="py-1.5 border border-[#e47b80] flex items-center justify-center font-pixel text-[10px] text-[#8c7482]">${i}</div>`;
    }

    calGrid.innerHTML = html;
}

function calendarPrevMonth() {
    const d = state.calendarViewDate;
    state.calendarViewDate = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    renderCalendar();
}

function calendarNextMonth() {
    const d = state.calendarViewDate;
    state.calendarViewDate = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    renderCalendar();
}

function handleKeyDown(e) {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') {
        e.preventDefault();
        toggleTimer();
    } else if (e.code === 'KeyR') {
        pauseTimer();
        state.remainingSeconds = state.currentMinutes * 60;
        updateUI();
    }
}

// Event Listeners
function setupEvents() {
    setupWindowControls();

    // Click on clock or time display to start/pause
    if (clockIllustration) {
        clockIllustration.addEventListener('click', () => toggleTimer());
    }
    if (timeDisplay) {
        timeDisplay.addEventListener('click', () => toggleTimer());
    }

    // Mode buttons
    if (modeBreakBtn) modeBreakBtn.addEventListener('click', () => setMode('break'));
    if (modeStudyBtn) modeStudyBtn.addEventListener('click', () => setMode('study'));
    if (modeWorkBtn) modeWorkBtn.addEventListener('click', () => setMode('work'));

    // Slider
    if (durationSlider) {
        durationSlider.addEventListener('input', (e) => {
            handleSliderChange(e.target.value);
        });
    }

    // Flame button (Stats Modal)
    if (flameBtn && statsModal) {
        flameBtn.addEventListener('click', () => {
            state.sound.playPop();
            state.calendarViewDate = new Date();
            updateStatsDisplay();
            statsModal.classList.remove('hidden');
        });
    }
    if (closeStatsBtn && statsModal) {
        closeStatsBtn.addEventListener('click', () => {
            state.sound.playPop();
            statsModal.classList.add('hidden');
        });
    }

    // Info button (Settings & Guide Modal)
    if (infoBtn && infoModal) {
        infoBtn.addEventListener('click', () => {
            state.sound.playPop();
            if (inputBreakDuration) inputBreakDuration.value = state.durations.break;
            if (inputStudyDuration) inputStudyDuration.value = state.durations.study;
            if (inputWorkDuration) inputWorkDuration.value = state.durations.work;
            infoModal.classList.remove('hidden');
        });
    }
    if (closeInfoBtn && infoModal) {
        closeInfoBtn.addEventListener('click', () => {
            state.sound.playPop();
            infoModal.classList.add('hidden');
        });
    }

    // Reset streak
    if (resetStreakBtn) {
        resetStreakBtn.addEventListener('click', () => {
            state.streak = 0;
            state.todayCompleted = 0;
            state.totalMinutes = 0;
            state.lastActiveDate = null;
            state.activeDates = new Set();
            saveData();
            updateStatsDisplay();
            state.sound.playPop();
        });
    }

    // Calendar navigation
    if (calPrevBtn) {
        calPrevBtn.addEventListener('click', () => {
            calendarPrevMonth();
            state.sound.playPop();
        });
    }
    if (calNextBtn) {
        calNextBtn.addEventListener('click', () => {
            calendarNextMonth();
            state.sound.playPop();
        });
    }

    // Settings inputs
    if (soundToggleInput) {
        soundToggleInput.checked = state.sound.soundEnabled;
        soundToggleInput.addEventListener('change', (e) => {
            state.sound.soundEnabled = e.target.checked;
        });
    }

    if (pinToggleInput && window.electronAPI) {
        pinToggleInput.addEventListener('change', (e) => {
            state.isPinned = e.target.checked;
            window.electronAPI.togglePin(state.isPinned);
            if (btnPin) {
                btnPin.classList.toggle('opacity-100', state.isPinned);
                btnPin.classList.toggle('opacity-50', !state.isPinned);
            }
        });
    }

    if (inputBreakDuration) {
        inputBreakDuration.addEventListener('change', (e) => {
            state.durations.break = Math.max(1, parseInt(e.target.value, 10) || 5);
            if (state.mode === 'break') handleSliderChange(state.durations.break);
        });
    }
    if (inputStudyDuration) {
        inputStudyDuration.addEventListener('change', (e) => {
            state.durations.study = Math.max(1, parseInt(e.target.value, 10) || 25);
            if (state.mode === 'study') handleSliderChange(state.durations.study);
        });
    }
    if (inputWorkDuration) {
        inputWorkDuration.addEventListener('change', (e) => {
            state.durations.work = Math.max(1, parseInt(e.target.value, 10) || 50);
            if (state.mode === 'work') handleSliderChange(state.durations.work);
        });
    }

    // Keyboard shortcuts (Space = Start/Pause, R = Reset)
    window.removeEventListener('keydown', handleKeyDown);
    window.addEventListener('keydown', handleKeyDown);

    // Request notifications
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

// Initialization
function init() {
    queryDOMElements();
    loadSavedData();
    setupEvents();
    updateUI();
}

function getElements() {
    return {
        timeDisplay,
        statusBadge,
        durationSlider,
        sliderLabel,
        clockIllustration,
        minuteHand,
        hourHand,
        modeBreakBtn,
        modeStudyBtn,
        modeWorkBtn,
        flameBtn,
        infoBtn,
        statsModal,
        infoModal,
        closeStatsBtn,
        closeInfoBtn,
        streakCountEl,
        completedCountEl,
        totalTimeEl,
        soundToggleInput,
        pinToggleInput,
        inputBreakDuration,
        inputStudyDuration,
        inputWorkDuration,
        resetStreakBtn,
        calPrevBtn,
        calNextBtn,
        calMonthLabel,
        calGrid,
        btnClose,
        btnMin,
        btnPin,
    };
}

function setElements(elements = {}) {
    if (elements.timeDisplay !== undefined) timeDisplay = elements.timeDisplay;
    if (elements.statusBadge !== undefined) statusBadge = elements.statusBadge;
    if (elements.durationSlider !== undefined) durationSlider = elements.durationSlider;
    if (elements.sliderLabel !== undefined) sliderLabel = elements.sliderLabel;
    if (elements.clockIllustration !== undefined) clockIllustration = elements.clockIllustration;
    if (elements.minuteHand !== undefined) minuteHand = elements.minuteHand;
    if (elements.hourHand !== undefined) hourHand = elements.hourHand;
    if (elements.modeBreakBtn !== undefined) modeBreakBtn = elements.modeBreakBtn;
    if (elements.modeStudyBtn !== undefined) modeStudyBtn = elements.modeStudyBtn;
    if (elements.modeWorkBtn !== undefined) modeWorkBtn = elements.modeWorkBtn;
    if (elements.flameBtn !== undefined) flameBtn = elements.flameBtn;
    if (elements.infoBtn !== undefined) infoBtn = elements.infoBtn;
    if (elements.statsModal !== undefined) statsModal = elements.statsModal;
    if (elements.infoModal !== undefined) infoModal = elements.infoModal;
    if (elements.closeStatsBtn !== undefined) closeStatsBtn = elements.closeStatsBtn;
    if (elements.closeInfoBtn !== undefined) closeInfoBtn = elements.closeInfoBtn;
    if (elements.streakCountEl !== undefined) streakCountEl = elements.streakCountEl;
    if (elements.completedCountEl !== undefined) completedCountEl = elements.completedCountEl;
    if (elements.totalTimeEl !== undefined) totalTimeEl = elements.totalTimeEl;
    if (elements.soundToggleInput !== undefined) soundToggleInput = elements.soundToggleInput;
    if (elements.pinToggleInput !== undefined) pinToggleInput = elements.pinToggleInput;
    if (elements.inputBreakDuration !== undefined) inputBreakDuration = elements.inputBreakDuration;
    if (elements.inputStudyDuration !== undefined) inputStudyDuration = elements.inputStudyDuration;
    if (elements.inputWorkDuration !== undefined) inputWorkDuration = elements.inputWorkDuration;
    if (elements.resetStreakBtn !== undefined) resetStreakBtn = elements.resetStreakBtn;
    if (elements.calPrevBtn !== undefined) calPrevBtn = elements.calPrevBtn;
    if (elements.calNextBtn !== undefined) calNextBtn = elements.calNextBtn;
    if (elements.calMonthLabel !== undefined) calMonthLabel = elements.calMonthLabel;
    if (elements.calGrid !== undefined) calGrid = elements.calGrid;
    if (elements.btnClose !== undefined) btnClose = elements.btnClose;
    if (elements.btnMin !== undefined) btnMin = elements.btnMin;
    if (elements.btnPin !== undefined) btnPin = elements.btnPin;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    init();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SoundPlayer,
        state,
        loadSavedData,
        saveData,
        formatTime,
        updateClockHands,
        updateUI,
        startTimer,
        tickTimer,
        pauseTimer,
        toggleTimer,
        completeSession,
        setMode,
        handleSliderChange,
        updateStatsDisplay,
        setupEvents,
        setupWindowControls,
        queryDOMElements,
        init,
        getElements,
        setElements,
        getTodayDateStr,
        getDaysDifference,
        renderCalendar,
        calendarPrevMonth,
        calendarNextMonth,
        MONTH_NAMES,
        handleKeyDown,
    };
}