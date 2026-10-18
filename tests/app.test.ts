import { describe, it, expect, beforeEach, mock } from "bun:test";
import { Window } from "happy-dom";
import fs from "fs";
import path from "path";

// Mock Web Audio API
class MockGainNode {
  gain = {
    value: 1,
    setValueAtTime: mock(),
    exponentialRampToValueAtTime: mock(),
    linearRampToValueAtTime: mock(),
  };
  connect = mock();
}

class MockOscillatorNode {
  type = "sine";
  frequency = {
    value: 440,
    setValueAtTime: mock(),
    exponentialRampToValueAtTime: mock(),
  };
  connect = mock();
  start = mock();
  stop = mock();
}

class MockAudioContext {
  currentTime = 0;
  state = "running";
  destination = {};
  resume = mock(() => {
    this.state = "running";
  });
  createOscillator() {
    return new MockOscillatorNode();
  }
  createGain() {
    return new MockGainNode();
  }
}

// Global DOM setup
const htmlContent = fs.readFileSync(path.resolve("index.html"), "utf8");
const happyWindow = new Window();
happyWindow.document.write(htmlContent);

(globalThis as any).window = happyWindow;
(globalThis as any).document = happyWindow.document;
(globalThis as any).AudioContext = MockAudioContext;
(globalThis as any).webkitAudioContext = MockAudioContext;
(happyWindow as any).AudioContext = MockAudioContext;
(happyWindow as any).webkitAudioContext = MockAudioContext;
(globalThis as any).localStorage = happyWindow.localStorage;

// Mock Notification
class MockNotification {
  static permission = "default";
  static requestPermission = mock(() => Promise.resolve("granted"));
  title: string;
  options: any;
  constructor(title: string, options: any) {
    this.title = title;
    this.options = options;
  }
}
(globalThis as any).Notification = MockNotification;
(happyWindow as any).Notification = MockNotification;

// Mock electronAPI
const electronApiMock = {
  minimize: mock(),
  close: mock(),
  togglePin: mock(),
  onPinStatus: mock(),
};
(happyWindow as any).electronAPI = electronApiMock;

// Import app.js
const app = require("../src/app.js");

describe("src/app.js", () => {
  beforeEach(() => {
    (happyWindow as any).AudioContext = MockAudioContext;
    (happyWindow as any).webkitAudioContext = MockAudioContext;
    (globalThis as any).AudioContext = MockAudioContext;
    (globalThis as any).webkitAudioContext = MockAudioContext;

    happyWindow.document.body.innerHTML = "";
    happyWindow.document.write(htmlContent);
    app.queryDOMElements();

    app.state.isRunning = false;
    app.state.isCompleted = false;
    if (app.state.timerInterval) {
      clearInterval(app.state.timerInterval);
      app.state.timerInterval = null;
    }
    app.state.streak = 0;
    app.state.todayCompleted = 0;
    app.state.totalMinutes = 0;
    app.state.lastActiveDate = null;
    app.state.durations = { break: 5, study: 25, work: 50 };
    app.state.mode = "break";
    app.state.currentMinutes = 5;
    app.state.remainingSeconds = 5 * 60;
    app.state.isPinned = false;
    app.state.sound = new app.SoundPlayer();
    app.state.activeDates = new Set();
    app.state.calendarViewDate = new Date();
    happyWindow.localStorage.clear();
  });

  describe("SoundPlayer", () => {
    it("initializes AudioContext via window.AudioContext", () => {
      const sp = new app.SoundPlayer();
      expect(sp.ctx).toBeNull();
      sp.init();
      expect(sp.ctx).not.toBeNull();

      // Does not re-init if ctx exists
      const oldCtx = sp.ctx;
      sp.init();
      expect(sp.ctx).toBe(oldCtx);
    });

    it("falls back to webkitAudioContext when AudioContext is missing", () => {
      const origAudioCtx = (happyWindow as any).AudioContext;
      const origGlobalAudioCtx = (globalThis as any).AudioContext;
      delete (happyWindow as any).AudioContext;
      delete (globalThis as any).AudioContext;

      const sp = new app.SoundPlayer();
      sp.init();
      expect(sp.ctx).not.toBeNull();

      (happyWindow as any).AudioContext = origAudioCtx;
      (globalThis as any).AudioContext = origGlobalAudioCtx;
    });

    it("leaves ctx null when no audio context constructor is available", () => {
      const origAudio = (happyWindow as any).AudioContext;
      const origWebkit = (happyWindow as any).webkitAudioContext;
      delete (happyWindow as any).AudioContext;
      delete (happyWindow as any).webkitAudioContext;

      const sp = new app.SoundPlayer();
      sp.init();
      expect(sp.ctx).toBeNull();

      (happyWindow as any).AudioContext = origAudio;
      (happyWindow as any).webkitAudioContext = origWebkit;
    });

    it("playPop plays audio when enabled and handles suspended / disabled states", () => {
      const sp = new app.SoundPlayer();

      // When soundEnabled is false
      sp.soundEnabled = false;
      sp.playPop();
      expect(sp.ctx).toBeNull();

      // When soundEnabled is true and ctx is null (audio unsupported)
      sp.soundEnabled = true;
      const origAudio = (happyWindow as any).AudioContext;
      delete (happyWindow as any).AudioContext;
      sp.playPop();
      (happyWindow as any).AudioContext = origAudio;

      // When ctx is suspended
      const spSuspended = new app.SoundPlayer();
      spSuspended.init();
      spSuspended.ctx.state = "suspended";
      spSuspended.playPop();
      expect(spSuspended.ctx.resume).toHaveBeenCalled();

      // Normal play (running)
      const spRunning = new app.SoundPlayer();
      spRunning.playPop();
      expect(spRunning.ctx).not.toBeNull();
    });

    it("playTick plays audio and handles suspended / disabled / null states", () => {
      const sp = new app.SoundPlayer();

      // Disabled
      sp.soundEnabled = false;
      sp.playTick();
      expect(sp.ctx).toBeNull();

      // Null ctx
      sp.soundEnabled = true;
      const origAudio = (happyWindow as any).AudioContext;
      delete (happyWindow as any).AudioContext;
      sp.playTick();
      (happyWindow as any).AudioContext = origAudio;

      // Suspended
      const spSuspended = new app.SoundPlayer();
      spSuspended.init();
      spSuspended.ctx.state = "suspended";
      spSuspended.playTick();
      expect(spSuspended.ctx.resume).toHaveBeenCalled();

      // Running
      const spRunning = new app.SoundPlayer();
      spRunning.playTick();
      expect(spRunning.ctx).not.toBeNull();
    });

    it("playChime plays arpeggio notes and handles suspended / disabled / null states", () => {
      const sp = new app.SoundPlayer();

      // Disabled
      sp.soundEnabled = false;
      sp.playChime();
      expect(sp.ctx).toBeNull();

      // Null ctx
      sp.soundEnabled = true;
      const origAudio = (happyWindow as any).AudioContext;
      delete (happyWindow as any).AudioContext;
      sp.playChime();
      (happyWindow as any).AudioContext = origAudio;

      // Suspended
      const spSuspended = new app.SoundPlayer();
      spSuspended.init();
      spSuspended.ctx.state = "suspended";
      spSuspended.playChime();
      expect(spSuspended.ctx.resume).toHaveBeenCalled();

      // Running
      const spRunning = new app.SoundPlayer();
      spRunning.playChime();
      expect(spRunning.ctx).not.toBeNull();
    });
  });

  describe("LocalStorage & State", () => {
    it("loads saved data successfully with all values", () => {
      happyWindow.localStorage.setItem("focusme_streak", "5");
      happyWindow.localStorage.setItem("focusme_completed", "12");
      happyWindow.localStorage.setItem("focusme_total_min", "150");
      happyWindow.localStorage.setItem(
        "focusme_durations",
        JSON.stringify({ break: 10, study: 30, work: 60 })
      );

      app.loadSavedData();
      expect(app.state.streak).toBe(5);
      expect(app.state.todayCompleted).toBe(12);
      expect(app.state.totalMinutes).toBe(150);
      expect(app.state.durations.break).toBe(10);
      expect(app.state.durations.study).toBe(30);
      expect(app.state.durations.work).toBe(60);
    });

    it("handles invalid or NaN saved data gracefully", () => {
      happyWindow.localStorage.setItem("focusme_streak", "not-a-number");
      happyWindow.localStorage.setItem("focusme_completed", "NaN");
      happyWindow.localStorage.setItem("focusme_total_min", "invalid");
      app.loadSavedData();
      expect(app.state.streak).toBe(0);
      expect(app.state.todayCompleted).toBe(0);
      expect(app.state.totalMinutes).toBe(0);
    });

    it("handles localStorage errors in loadSavedData via malformed JSON", () => {
      const origError = console.error;
      console.error = () => {};
      try {
        happyWindow.localStorage.setItem("focusme_durations", "INVALID_JSON{{");
        expect(() => app.loadSavedData()).not.toThrow();
      } finally {
        console.error = origError;
      }
    });

    it("handles focusme_active_dates in loadSavedData with valid, non-array, and invalid JSON", () => {
      // Valid array
      happyWindow.localStorage.setItem("focusme_active_dates", JSON.stringify(["2026-10-18", "2026-10-19"]));
      app.loadSavedData();
      expect(app.state.activeDates.has("2026-10-18")).toBe(true);
      expect(app.state.activeDates.has("2026-10-19")).toBe(true);
      expect(app.state.activeDates.size).toBe(2);

      // Non-array JSON fallback to empty array
      happyWindow.localStorage.setItem("focusme_active_dates", JSON.stringify({ notAnArray: true }));
      app.loadSavedData();
      expect(app.state.activeDates.size).toBe(0);

      // Malformed JSON caught by catch block
      happyWindow.localStorage.setItem("focusme_active_dates", "INVALID_JSON{{{");
      app.loadSavedData();
      expect(app.state.activeDates.size).toBe(0);
    });

    it("saves state to localStorage", () => {
      app.state.streak = 7;
      app.state.todayCompleted = 4;
      app.state.totalMinutes = 120;
      app.state.durations = { break: 7, study: 25, work: 50 };
      app.state.activeDates = new Set(["2026-10-18"]);

      app.saveData();
      expect(happyWindow.localStorage.getItem("focusme_streak")).toBe("7");
      expect(happyWindow.localStorage.getItem("focusme_completed")).toBe("4");
      expect(happyWindow.localStorage.getItem("focusme_total_min")).toBe("120");
      expect(happyWindow.localStorage.getItem("focusme_active_dates")).toBe(JSON.stringify(["2026-10-18"]));
    });

    it("handles loadSavedData when savedLastDate is today (diff = 0)", () => {
      const today = app.getTodayDateStr();
      happyWindow.localStorage.setItem("focusme_last_date", today);
      happyWindow.localStorage.setItem("focusme_streak", "3");
      happyWindow.localStorage.setItem("focusme_completed", "5");

      app.loadSavedData();
      expect(app.state.streak).toBe(3);
      expect(app.state.todayCompleted).toBe(5);
      expect(app.state.lastActiveDate).toBe(today);
    });

    it("handles loadSavedData when savedLastDate was yesterday (diff = 1)", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = app.getTodayDateStr(yesterday);

      happyWindow.localStorage.setItem("focusme_last_date", yesterdayStr);
      happyWindow.localStorage.setItem("focusme_streak", "3");
      happyWindow.localStorage.setItem("focusme_completed", "5");

      app.loadSavedData();
      expect(app.state.streak).toBe(3);
      expect(app.state.todayCompleted).toBe(0);
    });

    it("handles loadSavedData when savedLastDate was 2 or more days ago (diff > 1)", () => {
      const past = new Date();
      past.setDate(past.getDate() - 3);
      const pastStr = app.getTodayDateStr(past);

      happyWindow.localStorage.setItem("focusme_last_date", pastStr);
      happyWindow.localStorage.setItem("focusme_streak", "5");
      happyWindow.localStorage.setItem("focusme_completed", "5");

      app.loadSavedData();
      expect(app.state.streak).toBe(0);
      expect(app.state.todayCompleted).toBe(0);
    });

    it("saves and removes focusme_last_date in saveData", () => {
      app.state.lastActiveDate = "2026-10-18";
      app.saveData();
      expect(happyWindow.localStorage.getItem("focusme_last_date")).toBe("2026-10-18");

      app.state.lastActiveDate = null;
      app.saveData();
      expect(happyWindow.localStorage.getItem("focusme_last_date")).toBeNull();
    });

    it("handles errors in saveData via circular structure", () => {
      const origError = console.error;
      console.error = () => {};
      try {
        const circular: any = {};
        circular.self = circular;
        app.state.durations = circular;
        expect(() => app.saveData()).not.toThrow();
      } finally {
        console.error = origError;
      }
    });
  });

  describe("formatTime", () => {
    it("formats total seconds into MM:SS correctly", () => {
      expect(app.formatTime(0)).toBe("00:00");
      expect(app.formatTime(9)).toBe("00:09");
      expect(app.formatTime(60)).toBe("01:00");
      expect(app.formatTime(125)).toBe("02:05");
      expect(app.formatTime(3599)).toBe("59:59");
    });
  });

  describe("updateClockHands", () => {
    it("updates transform attributes when hands exist", () => {
      app.state.currentMinutes = 5;
      app.state.remainingSeconds = 150;
      app.updateClockHands();

      const elems = app.getElements();
      expect(elems.minuteHand.getAttribute("transform")).toContain("rotate(");
      expect(elems.hourHand.getAttribute("transform")).toContain("rotate(");
    });

    it("handles currentMinutes = 0 branch", () => {
      app.state.currentMinutes = 0;
      app.state.remainingSeconds = 0;
      expect(() => app.updateClockHands()).not.toThrow();
    });

    it("handles missing minuteHand and hourHand gracefully", () => {
      app.setElements({ minuteHand: null, hourHand: null });
      expect(() => app.updateClockHands()).not.toThrow();
    });
  });

  describe("updateUI", () => {
    it("updates UI elements based on state", () => {
      app.state.isRunning = false;
      app.state.currentMinutes = 5;
      app.state.remainingSeconds = 300;
      app.updateUI();

      const elems = app.getElements();
      expect(elems.timeDisplay.textContent).toBe("05:00");
      expect(elems.sliderLabel.textContent).toBe("5 min");
      expect(elems.durationSlider.value).toBe("5");
      expect(elems.statusBadge.textContent).toBe("START");
      expect(elems.clockIllustration.classList.contains("anim-ticking")).toBe(false);
    });

    it("displays RESUME when timer is paused halfway", () => {
      app.state.isRunning = false;
      app.state.currentMinutes = 5;
      app.state.remainingSeconds = 120;
      app.updateUI();

      const elems = app.getElements();
      expect(elems.statusBadge.textContent).toBe("RESUME");
    });

    it("displays PAUSE and anim-ticking when timer is running", () => {
      app.state.isRunning = true;
      app.state.currentMinutes = 5;
      app.state.remainingSeconds = 250;
      app.updateUI();

      const elems = app.getElements();
      expect(elems.statusBadge.textContent).toBe("PAUSE");
      expect(elems.clockIllustration.classList.contains("anim-ticking")).toBe(true);
    });

    it("handles missing UI elements defensively", () => {
      app.setElements({
        timeDisplay: null,
        sliderLabel: null,
        durationSlider: null,
        statusBadge: null,
        clockIllustration: null,
        modeBreakBtn: null,
        modeStudyBtn: null,
        modeWorkBtn: null,
      });
      expect(() => app.updateUI()).not.toThrow();
    });

    it("applies active styles for different modes", () => {
      app.queryDOMElements();
      app.state.mode = "study";
      app.updateUI();
      const elems = app.getElements();
      expect(elems.modeStudyBtn.classList.contains("scale-110")).toBe(true);
      expect(elems.modeBreakBtn.classList.contains("opacity-70")).toBe(true);

      app.state.mode = "work";
      app.updateUI();
      expect(elems.modeWorkBtn.classList.contains("scale-110")).toBe(true);
    });
  });

  describe("Timer operations (start, pause, toggle, tick, complete)", () => {
    it("starts and pauses timer", () => {
      expect(app.state.isRunning).toBe(false);
      app.startTimer();
      expect(app.state.isRunning).toBe(true);
      expect(app.state.timerInterval).not.toBeNull();

      // Redundant startTimer does nothing
      app.startTimer();
      expect(app.state.isRunning).toBe(true);

      app.pauseTimer();
      expect(app.state.isRunning).toBe(false);

      // Redundant pauseTimer does nothing
      app.pauseTimer();
      expect(app.state.isRunning).toBe(false);
    });

    it("toggleTimer switches between start and pause", () => {
      expect(app.state.isRunning).toBe(false);
      app.toggleTimer();
      expect(app.state.isRunning).toBe(true);
      app.toggleTimer();
      expect(app.state.isRunning).toBe(false);
    });

    it("ticks interval countdown and completes session when remainingSeconds reaches 0", async () => {
      app.state.remainingSeconds = 1;
      app.startTimer();

      // At 1.05s, targetEndTime has elapsed and completeSession() completes the session accurately
      await new Promise((r) => setTimeout(r, 1100));
      expect(app.state.isRunning).toBe(false);
      expect(app.state.todayCompleted).toBe(1);
    });

    it("completeSession updates stats, plays chime, rings clock, and triggers notification", async () => {
      MockNotification.permission = "granted";
      app.state.currentMinutes = 25;
      app.state.remainingSeconds = 0;
      app.completeSession();

      expect(app.state.streak).toBe(1);
      expect(app.state.todayCompleted).toBe(1);
      expect(app.state.totalMinutes).toBe(25);
      expect(app.state.remainingSeconds).toBe(25 * 60);

      const elems = app.getElements();
      expect(elems.clockIllustration.classList.contains("anim-ringing")).toBe(true);

      // Verify the 4s ringing timeout callback executes
      await new Promise((r) => setTimeout(r, 4100));
      expect(elems.clockIllustration.classList.contains("anim-ringing")).toBe(false);
    });

    it("completeSession handles clockIllustration being null and permission not granted", () => {
      MockNotification.permission = "denied";
      app.setElements({ clockIllustration: null });
      expect(() => app.completeSession()).not.toThrow();
    });
  });

  describe("setMode and handleSliderChange", () => {
    it("setMode pauses timer, updates mode, duration, and UI", () => {
      app.startTimer();
      app.setMode("study");
      expect(app.state.isRunning).toBe(false);
      expect(app.state.mode).toBe("study");
      expect(app.state.currentMinutes).toBe(25);
      expect(app.state.remainingSeconds).toBe(25 * 60);

      app.setMode("work");
      expect(app.state.mode).toBe("work");
      expect(app.state.currentMinutes).toBe(50);

      app.setMode("break");
      expect(app.state.mode).toBe("break");
      expect(app.state.currentMinutes).toBe(5);
    });

    it("handleSliderChange updates current minutes, duration and remaining seconds", () => {
      app.startTimer();
      app.handleSliderChange("15");
      expect(app.state.isRunning).toBe(false);
      expect(app.state.currentMinutes).toBe(15);
      expect(app.state.durations[app.state.mode]).toBe(15);
      expect(app.state.remainingSeconds).toBe(15 * 60);
    });
  });

  describe("updateStatsDisplay", () => {
    it("updates stats elements with state", () => {
      app.state.streak = 5;
      app.state.todayCompleted = 3;
      app.state.totalMinutes = 75;
      app.updateStatsDisplay();

      const elems = app.getElements();
      expect(elems.streakCountEl.textContent).toBe("5");
      expect(elems.completedCountEl.textContent).toBe("3");
      expect(elems.totalTimeEl.textContent).toBe("75 min");
    });

    it("handles missing stats elements defensively", () => {
      app.setElements({
        streakCountEl: null,
        completedCountEl: null,
        totalTimeEl: null,
      });
      expect(() => app.updateStatsDisplay()).not.toThrow();
    });
  });

  describe("setupWindowControls", () => {
    it("attaches listeners and handles minimize, close, and toggle pin", () => {
      app.setupWindowControls();
      const elems = app.getElements();

      elems.btnClose.dispatchEvent(new happyWindow.MouseEvent("click"));
      expect(electronApiMock.close).toHaveBeenCalled();

      elems.btnMin.dispatchEvent(new happyWindow.MouseEvent("click"));
      expect(electronApiMock.minimize).toHaveBeenCalled();

      // Pin toggle
      expect(app.state.isPinned).toBe(false);
      elems.btnPin.dispatchEvent(new happyWindow.MouseEvent("click"));
      expect(app.state.isPinned).toBe(true);
      expect(electronApiMock.togglePin).toHaveBeenCalledWith(true);
      expect(elems.pinToggleInput.checked).toBe(true);

      // Unpin
      elems.btnPin.dispatchEvent(new happyWindow.MouseEvent("click"));
      expect(app.state.isPinned).toBe(false);
      expect(electronApiMock.togglePin).toHaveBeenCalledWith(false);
      expect(elems.pinToggleInput.checked).toBe(false);
    });

    it("handles pin toggle when pinToggleInput is null", () => {
      app.setElements({ pinToggleInput: null });
      const elems = app.getElements();
      expect(() => elems.btnPin.dispatchEvent(new happyWindow.MouseEvent("click"))).not.toThrow();
    });

    it("does nothing if electronAPI is not on window", () => {
      const origApi = (happyWindow as any).electronAPI;
      delete (happyWindow as any).electronAPI;
      expect(() => app.setupWindowControls()).not.toThrow();
      (happyWindow as any).electronAPI = origApi;
    });

    it("handles missing window buttons defensively", () => {
      app.setElements({ btnClose: null, btnMin: null, btnPin: null });
      expect(() => app.setupWindowControls()).not.toThrow();
    });
  });

  describe("Event listeners in setupEvents", () => {
    beforeEach(() => {
      app.queryDOMElements();
      app.setupEvents();
    });

    it("toggles timer on clock and timeDisplay clicks", () => {
      const elems = app.getElements();
      expect(app.state.isRunning).toBe(false);
      elems.clockIllustration.dispatchEvent(new happyWindow.MouseEvent("click", { bubbles: true }));
      expect(app.state.isRunning).toBe(true);
      elems.timeDisplay.dispatchEvent(new happyWindow.MouseEvent("click", { bubbles: true }));
      expect(app.state.isRunning).toBe(false);
    });

    it("sets mode on mode button clicks", () => {
      const elems = app.getElements();
      elems.modeStudyBtn.dispatchEvent(new happyWindow.MouseEvent("click"));
      expect(app.state.mode).toBe("study");
      elems.modeWorkBtn.dispatchEvent(new happyWindow.MouseEvent("click"));
      expect(app.state.mode).toBe("work");
      elems.modeBreakBtn.dispatchEvent(new happyWindow.MouseEvent("click"));
      expect(app.state.mode).toBe("break");
    });

    it("handles duration slider input event", () => {
      const elems = app.getElements();
      elems.durationSlider.value = "20";
      elems.durationSlider.dispatchEvent(new happyWindow.Event("input"));
      expect(app.state.currentMinutes).toBe(20);
    });

    it("opens and closes stats modal", () => {
      const elems = app.getElements();
      elems.flameBtn.dispatchEvent(new happyWindow.MouseEvent("click"));
      expect(elems.statsModal.classList.contains("hidden")).toBe(false);

      elems.closeStatsBtn.dispatchEvent(new happyWindow.MouseEvent("click"));
      expect(elems.statsModal.classList.contains("hidden")).toBe(true);
    });

    it("opens and closes info modal", () => {
      const elems = app.getElements();
      elems.infoBtn.dispatchEvent(new happyWindow.MouseEvent("click"));
      expect(elems.infoModal.classList.contains("hidden")).toBe(false);
      expect(elems.inputBreakDuration.value).toBe(app.state.durations.break.toString());

      elems.closeInfoBtn.dispatchEvent(new happyWindow.MouseEvent("click"));
      expect(elems.infoModal.classList.contains("hidden")).toBe(true);
    });

    it("resets streak on resetStreakBtn click and clears activeDates", () => {
      app.state.streak = 5;
      app.state.todayCompleted = 2;
      app.state.totalMinutes = 50;
      app.state.activeDates.add("2026-10-18");

      const elems = app.getElements();
      elems.resetStreakBtn.dispatchEvent(new happyWindow.MouseEvent("click"));
      expect(app.state.streak).toBe(0);
      expect(app.state.todayCompleted).toBe(0);
      expect(app.state.totalMinutes).toBe(0);
      expect(app.state.activeDates.size).toBe(0);
      expect(happyWindow.localStorage.getItem("focusme_active_dates")).toBe("[]");
    });

    it("navigates calendar months when calPrevBtn and calNextBtn are clicked", () => {
      const elems = app.getElements();
      app.state.calendarViewDate = new Date(2026, 9, 15);
      elems.calPrevBtn.dispatchEvent(new happyWindow.MouseEvent("click"));
      expect(app.state.calendarViewDate.getMonth()).toBe(8);

      elems.calNextBtn.dispatchEvent(new happyWindow.MouseEvent("click"));
      expect(app.state.calendarViewDate.getMonth()).toBe(9);
    });

    it("toggles sound setting on soundToggleInput change", () => {
      const elems = app.getElements();
      elems.soundToggleInput.checked = false;
      elems.soundToggleInput.dispatchEvent(new happyWindow.Event("change"));
      expect(app.state.sound.soundEnabled).toBe(false);

      elems.soundToggleInput.checked = true;
      elems.soundToggleInput.dispatchEvent(new happyWindow.Event("change"));
      expect(app.state.sound.soundEnabled).toBe(true);
    });

    it("toggles pin on pinToggleInput change", () => {
      const elems = app.getElements();
      elems.pinToggleInput.checked = true;
      elems.pinToggleInput.dispatchEvent(new happyWindow.Event("change"));
      expect(app.state.isPinned).toBe(true);
      expect(electronApiMock.togglePin).toHaveBeenCalledWith(true);

      // Pin without btnPin
      app.setElements({ btnPin: null });
      elems.pinToggleInput.checked = false;
      elems.pinToggleInput.dispatchEvent(new happyWindow.Event("change"));
      expect(app.state.isPinned).toBe(false);
    });

    it("handles duration setting inputs for break, study, and work", () => {
      const elems = app.getElements();

      // Break duration input while mode is break
      app.state.mode = "break";
      elems.inputBreakDuration.value = "12";
      elems.inputBreakDuration.dispatchEvent(new happyWindow.Event("change"));
      expect(app.state.durations.break).toBe(12);
      expect(app.state.currentMinutes).toBe(12);

      // Break duration input while mode is NOT break
      app.setMode("study");
      expect(app.state.currentMinutes).toBe(25);
      elems.inputBreakDuration.value = "7";
      elems.inputBreakDuration.dispatchEvent(new happyWindow.Event("change"));
      expect(app.state.durations.break).toBe(7);
      expect(app.state.currentMinutes).toBe(25); // unchanged

      // Study duration input while mode is study
      elems.inputStudyDuration.value = "35";
      elems.inputStudyDuration.dispatchEvent(new happyWindow.Event("change"));
      expect(app.state.durations.study).toBe(35);
      expect(app.state.currentMinutes).toBe(35);

      // Study duration input while mode is NOT study
      app.setMode("work");
      expect(app.state.currentMinutes).toBe(50);
      elems.inputStudyDuration.value = "40";
      elems.inputStudyDuration.dispatchEvent(new happyWindow.Event("change"));
      expect(app.state.durations.study).toBe(40);
      expect(app.state.currentMinutes).toBe(50); // unchanged

      // Work duration input while mode is work
      elems.inputWorkDuration.value = "55";
      elems.inputWorkDuration.dispatchEvent(new happyWindow.Event("change"));
      expect(app.state.durations.work).toBe(55);
      expect(app.state.currentMinutes).toBe(55);

      // Work duration input while mode is NOT work
      app.setMode("break");
      elems.inputWorkDuration.value = "60";
      elems.inputWorkDuration.dispatchEvent(new happyWindow.Event("change"));
      expect(app.state.durations.work).toBe(60);
      expect(app.state.currentMinutes).toBe(app.state.durations.break);
    });

    it("handles keyboard shortcuts: Space, KeyR, and INPUT ignore", () => {
      // Keydown on input element is ignored
      const inputEl = happyWindow.document.createElement("input");
      const ignoredEvent = new happyWindow.KeyboardEvent("keydown", { code: "Space" });
      Object.defineProperty(ignoredEvent, "target", { value: inputEl });
      happyWindow.dispatchEvent(ignoredEvent);
      expect(app.state.isRunning).toBe(false);

      // Space toggles timer
      const spaceEvent = new happyWindow.KeyboardEvent("keydown", { code: "Space" });
      let prevented = false;
      spaceEvent.preventDefault = () => {
        prevented = true;
      };
      happyWindow.dispatchEvent(spaceEvent);
      expect(app.state.isRunning).toBe(true);
      expect(prevented).toBe(true);

      // KeyR resets timer
      app.state.currentMinutes = 10;
      app.state.remainingSeconds = 120;
      const rEvent = new happyWindow.KeyboardEvent("keydown", { code: "KeyR" });
      happyWindow.dispatchEvent(rEvent);
      expect(app.state.isRunning).toBe(false);
      expect(app.state.remainingSeconds).toBe(10 * 60);

      // Other key does nothing
      const aEvent = new happyWindow.KeyboardEvent("keydown", { code: "KeyA" });
      expect(() => happyWindow.dispatchEvent(aEvent)).not.toThrow();
    });

    it("requests notification permissions when permission is default", () => {
      MockNotification.permission = "default";
      MockNotification.requestPermission = mock(() => Promise.resolve("granted"));
      app.setupEvents();
      expect(MockNotification.requestPermission).toHaveBeenCalled();
    });
  });

  describe("queryDOMElements, setElements and init", () => {
    it("handles queryDOMElements when document is undefined", () => {
      const origDoc = (globalThis as any).document;
      delete (globalThis as any).document;
      expect(() => app.queryDOMElements()).not.toThrow();
      (globalThis as any).document = origDoc;
    });

    it("setElements covers setting all individual elements", () => {
      app.setElements({
        timeDisplay: null,
        statusBadge: null,
        durationSlider: null,
        sliderLabel: null,
        clockIllustration: null,
        minuteHand: null,
        hourHand: null,
        modeBreakBtn: null,
        modeStudyBtn: null,
        modeWorkBtn: null,
        flameBtn: null,
        infoBtn: null,
        statsModal: null,
        infoModal: null,
        closeStatsBtn: null,
        closeInfoBtn: null,
        streakCountEl: null,
        completedCountEl: null,
        totalTimeEl: null,
        soundToggleInput: null,
        pinToggleInput: null,
        inputBreakDuration: null,
        inputStudyDuration: null,
        inputWorkDuration: null,
        resetStreakBtn: null,
        calPrevBtn: null,
        calNextBtn: null,
        calMonthLabel: null,
        calGrid: null,
        btnClose: null,
        btnMin: null,
        btnPin: null,
      });
      const elems = app.getElements();
      expect(elems.timeDisplay).toBeNull();
      expect(elems.calPrevBtn).toBeNull();
      expect(elems.calNextBtn).toBeNull();
      expect(elems.calMonthLabel).toBeNull();
      expect(elems.calGrid).toBeNull();
      expect(elems.btnPin).toBeNull();
    });

    it("init runs complete initialization cycle", () => {
      expect(() => app.init()).not.toThrow();
    });
  });

  describe("Calendar logic and rendering", () => {
    it("renderCalendar returns early if calGrid or calMonthLabel is null", () => {
      app.setElements({ calGrid: null });
      expect(() => app.renderCalendar()).not.toThrow();

      app.setElements({ calGrid: happyWindow.document.getElementById("cal-grid"), calMonthLabel: null });
      expect(() => app.renderCalendar()).not.toThrow();
    });

    it("renderCalendar renders correct month header, empty offsets, and active dates", () => {
      app.queryDOMElements();
      // Oct 2026: 1 Oct is Thursday (getDay() = 4 -> startOffset = 3)
      app.state.calendarViewDate = new Date(2026, 9, 1);
      app.state.activeDates = new Set(["2026-10-05"]);
      app.renderCalendar();

      const elems = app.getElements();
      expect(elems.calMonthLabel.textContent).toBe("2026 Oktober");
      expect(elems.calGrid.innerHTML).toContain("bg-[#E6934A]");
      expect(elems.calGrid.innerHTML).toContain("5");
    });

    it("renderCalendar handles month starting on Sunday (firstDay === 0 -> offset 6)", () => {
      app.queryDOMElements();
      // Nov 2026 starts on Sunday (getDay() = 0 -> startOffset = 6)
      app.state.calendarViewDate = new Date(2026, 10, 1);
      app.renderCalendar();

      const elems = app.getElements();
      expect(elems.calMonthLabel.textContent).toBe("2026 November");
    });

    it("renderCalendar highlights today's date if not already marked active", () => {
      app.queryDOMElements();
      const today = new Date();
      app.state.calendarViewDate = today;
      app.state.activeDates.clear();
      app.renderCalendar();

      const elems = app.getElements();
      expect(elems.calGrid.innerHTML).toContain("ring-1 ring-[#fca0b5]");
    });

    it("calendarPrevMonth and calendarNextMonth update calendarViewDate and render", () => {
      app.queryDOMElements();
      app.state.calendarViewDate = new Date(2026, 5, 15); // June 2026
      app.calendarPrevMonth();
      expect(app.state.calendarViewDate.getMonth()).toBe(4); // May

      app.calendarNextMonth();
      expect(app.state.calendarViewDate.getMonth()).toBe(5); // June
    });
  });

  describe("Date helpers & Daily Streak logic", () => {
    it("getTodayDateStr returns formatted YYYY-MM-DD", () => {
      const d = new Date(2026, 9, 18); // Oct 18, 2026
      expect(app.getTodayDateStr(d)).toBe("2026-10-18");
      expect(app.getTodayDateStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("getDaysDifference calculates day differences accurately", () => {
      expect(app.getDaysDifference("", "2026-10-18")).toBe(0);
      expect(app.getDaysDifference("2026-10-18", "")).toBe(0);
      expect(app.getDaysDifference("2026-10-18", "2026-10-18")).toBe(0);
      expect(app.getDaysDifference("2026-10-17", "2026-10-18")).toBe(1);
      expect(app.getDaysDifference("2026-10-13", "2026-10-18")).toBe(5);
    });

    it("completeSession sets streak to 1 on first session ever", () => {
      app.state.lastActiveDate = null;
      app.state.streak = 0;
      app.completeSession();
      expect(app.state.streak).toBe(1);
      expect(app.state.todayCompleted).toBe(1);
      expect(app.state.lastActiveDate).toBe(app.getTodayDateStr());
    });

    it("completeSession maintains streak on additional sessions on same day", () => {
      const today = app.getTodayDateStr();
      app.state.lastActiveDate = today;
      app.state.streak = 3;
      app.completeSession();
      expect(app.state.streak).toBe(3);
      expect(app.state.todayCompleted).toBe(1);

      // Even if streak was 0 on same day
      app.state.streak = 0;
      app.completeSession();
      expect(app.state.streak).toBe(1);
    });

    it("completeSession increments streak on consecutive day", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      app.state.lastActiveDate = app.getTodayDateStr(yesterday);
      app.state.streak = 2;

      app.completeSession();
      expect(app.state.streak).toBe(3);
    });

    it("completeSession resets streak to 1 after missing a day", () => {
      const past = new Date();
      past.setDate(past.getDate() - 4);
      app.state.lastActiveDate = app.getTodayDateStr(past);
      app.state.streak = 5;

      app.completeSession();
      expect(app.state.streak).toBe(1);
    });

    it("resets lastActiveDate when resetStreakBtn is clicked", () => {
      app.queryDOMElements();
      app.setupEvents();
      app.state.lastActiveDate = "2026-10-18";
      app.state.streak = 5;
      const elems = app.getElements();
      elems.resetStreakBtn.dispatchEvent(new happyWindow.MouseEvent("click"));

      expect(app.state.lastActiveDate).toBeNull();
      expect(app.state.streak).toBe(0);
      expect(happyWindow.localStorage.getItem("focusme_last_date")).toBeNull();
    });
  });
});

