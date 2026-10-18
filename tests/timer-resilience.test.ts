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

const app = require("../src/app.js");

describe("Timer Resilience Tests: Double Interval, Timer Drift, & onComplete Deduplication", () => {
  beforeEach(() => {
    app.queryDOMElements();
    app.pauseTimer();
    app.state.isRunning = false;
    if (app.state.timerInterval) {
      clearInterval(app.state.timerInterval);
      app.state.timerInterval = null;
    }
    app.state.streak = 0;
    app.state.todayCompleted = 0;
    app.state.totalMinutes = 0;
    app.state.isCompleting = false;
    app.state.onComplete = null;
    app.state.targetEndTime = null;
  });

  // Test Case 1: Risiko Interval Ganda (Double Interval Risk)
  describe("Test Case 1: Risiko Interval Ganda", () => {
    it("memastikan interval lama selalu dibersihkan dan tidak terjadi interval ganda yang bocor saat startTimer dipanggil berulang", () => {
      const originalSetInterval = globalThis.setInterval;
      const originalClearInterval = globalThis.clearInterval;

      const activeIntervalIds = new Set<any>();

      (globalThis as any).setInterval = (fn: any, ms?: any) => {
        const id = originalSetInterval(fn, ms);
        activeIntervalIds.add(id);
        return id;
      };
      (globalThis as any).clearInterval = (id: any) => {
        activeIntervalIds.delete(id);
        originalClearInterval(id);
      };

      try {
        app.state.remainingSeconds = 300;

        // Panggilan startTimer pertama
        app.startTimer();
        expect(app.state.isRunning).toBe(true);
        expect(activeIntervalIds.size).toBe(1);

        // Simulasi kondisi desinkronisasi atau pemanggilan startTimer kedua saat interval lama masih ada
        app.state.isRunning = false; // flag false tapi timerInterval masih terpasang
        app.startTimer(); // panggilan startTimer kedua

        // SESUDAH PATCH: interval lama dibersihkan tuntas, tepat 1 interval aktif di background
        expect(activeIntervalIds.size).toBe(1);
        expect(app.state.isRunning).toBe(true);

        // Setelah pauseTimer, interval harus 0 (tidak ada dangling interval ID)
        app.pauseTimer();
        expect(activeIntervalIds.size).toBe(0);
        expect(app.state.timerInterval).toBeNull();
      } finally {
        (globalThis as any).setInterval = originalSetInterval;
        (globalThis as any).clearInterval = originalClearInterval;
      }
    });
  });

  // Test Case 2: Risiko Timer Drift (Pergeseran Waktu Akumulatif)
  describe("Test Case 2: Risiko Timer Drift", () => {
    it("menghitung sisa detik secara presisi terhadap Date.now() saat terjadi delay / background throttling", () => {
      const originalNow = Date.now;
      let mockCurrentTime = 1700000000000;
      Date.now = () => mockCurrentTime;

      try {
        app.state.currentMinutes = 5;
        app.state.remainingSeconds = 300; // 300 detik (5 menit)

        app.startTimer();
        // targetEndTime harus tepat 300.000 ms dari waktu mulai
        expect(app.state.targetEndTime).toBe(mockCurrentTime + 300000);

        // Simulasi background throttling / window minimized / CPU lag:
        // Callback interval tertunda selama 4,5 detik di event loop
        mockCurrentTime += 4500; // 4.5 detik waktu nyata berlalu
        app.tickTimer();

        // SEBELUM PATCH: remainingSeconds hanya berkurang 1 (menjadi 299), drift 3.5 detik!
        // SESUDAH PATCH: remainingSeconds langsung tersinkronisasi menjadi 296 detik (300 - ceil(4.5) = 295.5 -> 296)
        expect(app.state.remainingSeconds).toBe(296);

        // Lanjutkan lagi setelah 1.0 detik
        mockCurrentTime += 1000;
        app.tickTimer();
        expect(app.state.remainingSeconds).toBe(295);
      } finally {
        Date.now = originalNow;
        app.pauseTimer();
      }
    });
  });

  // Test Case 3: Risiko Pemanggilan onComplete / completeSession Lebih dari Sekali
  describe("Test Case 3: Risiko Pemanggilan onComplete Ganda", () => {
    it("menjamin callback onComplete dan efek samping statistik hanya dieksekusi tepat satu kali (idempotent)", () => {
      let onCompleteCallCount = 0;
      const onCompleteMock = () => {
        onCompleteCallCount++;
      };

      app.state.streak = 0;
      app.state.todayCompleted = 0;
      app.state.totalMinutes = 0;
      app.state.currentMinutes = 25;
      app.state.remainingSeconds = 1;

      // Jalankan timer dengan callback onComplete
      app.startTimer(onCompleteMock);
      expect(app.state.isRunning).toBe(true);

      // Simulasi waktu habis dan tick interval berulang (misal antrean tick tertunda di event loop)
      app.state.targetEndTime = Date.now() - 1000;
      app.tickTimer(); // Tick 1: menyelesaikan sesi
      app.tickTimer(); // Tick 2: sisa antrean tick di event loop
      app.tickTimer(); // Tick 3: sisa antrean tick di event loop

      // SESUDAH PATCH: onComplete hanya dipanggil tepat 1 kali
      expect(onCompleteCallCount).toBe(1);

      // Statistik hanya bertambah 1 kali
      expect(app.state.todayCompleted).toBe(1);
      expect(app.state.totalMinutes).toBe(25);
      expect(app.state.streak).toBe(1);

      // Interval dan targetEndTime harus dibersihkan seketika
      expect(app.state.isRunning).toBe(false);
      expect(app.state.timerInterval).toBeNull();
      expect(app.state.targetEndTime).toBeNull();
    });

    it("menangani tickTimer saat timer tidak lagi aktif namun interval belum dibersihkan", () => {
      app.state.isRunning = false;
      app.state.timerInterval = 999 as any;
      app.tickTimer();
      expect(app.state.timerInterval).toBeNull();
    });

    it("menangani tickTimer saat targetEndTime tidak disetel (fallback decrement)", () => {
      app.state.isRunning = true;
      app.state.targetEndTime = null;
      app.state.remainingSeconds = 10;
      app.tickTimer();
      expect(app.state.remainingSeconds).toBe(9);
    });

    it("menangani error yang dilemparkan oleh callback onComplete secara aman", () => {
      const origError = console.error;
      console.error = () => {};
      try {
        app.state.isRunning = true;
        app.state.onComplete = () => {
          throw new Error("Simulated onComplete error");
        };
        expect(() => app.completeSession()).not.toThrow();
        expect(app.state.onComplete).toBeNull();
      } finally {
        console.error = origError;
      }
    });
  });
});
