import { describe, it, expect, mock } from "bun:test";

const appHandlers: Record<string, Function> = {};
const ipcHandlers: Record<string, Function> = {};
let whenReadyCallback: Function | null = null;
let quitCalled = false;
let allWindows: any[] = [];
const createdWindows: any[] = [];

class MockBrowserWindow {
  options: any;
  winHandlers: Record<string, Function> = {};
  isPinned = false;
  minimized = false;
  closed = false;
  loadedFile = "";

  constructor(options: any) {
    this.options = options;
    createdWindows.push(this);
  }

  loadFile(file: string) {
    this.loadedFile = file;
  }

  minimize() {
    this.minimized = true;
  }

  close() {
    this.closed = true;
  }

  setAlwaysOnTop(pinned: boolean) {
    this.isPinned = pinned;
  }

  isAlwaysOnTop() {
    return this.isPinned;
  }

  on(event: string, handler: Function) {
    this.winHandlers[event] = handler;
  }

  static getAllWindows() {
    return allWindows;
  }
}

mock.module("electron", () => ({
  app: {
    commandLine: {
      appendSwitch: mock(),
    },
    whenReady: () => ({
      then: (cb: Function) => {
        whenReadyCallback = cb;
        cb();
      },
    }),
    on: (event: string, handler: Function) => {
      appHandlers[event] = handler;
    },
    quit: () => {
      quitCalled = true;
    },
  },
  BrowserWindow: MockBrowserWindow,
  ipcMain: {
    on: (channel: string, handler: Function) => {
      ipcHandlers[channel] = handler;
    },
  },
}));

// Load main.js
const main = require("../main.js");

describe("main.js", () => {
  it("initializes window and IPC handlers on whenReady", () => {
    expect(main.getMainWindow()).toBeDefined();
    expect(main.getMainWindow().loadedFile).toBe("index.html");
    expect(typeof ipcHandlers["window-minimize"]).toBe("function");
    expect(typeof ipcHandlers["window-close"]).toBe("function");
    expect(typeof ipcHandlers["window-toggle-pin"]).toBe("function");
    expect(typeof appHandlers["window-all-closed"]).toBe("function");
    expect(typeof appHandlers["activate"]).toBe("function");
  });

  it("handles window-minimize when window exists and when null", () => {
    const win = main.getMainWindow();
    win.minimized = false;
    ipcHandlers["window-minimize"]!();
    expect(win.minimized).toBe(true);

    // Test when mainWindow is null
    main.setMainWindow(null);
    expect(() => ipcHandlers["window-minimize"]!()).not.toThrow();
    main.setMainWindow(win);
  });

  it("handles window-close when window exists and when null", () => {
    const win = main.getMainWindow();
    win.closed = false;
    ipcHandlers["window-close"]!();
    expect(win.closed).toBe(true);

    // Test when mainWindow is null
    main.setMainWindow(null);
    expect(() => ipcHandlers["window-close"]!()).not.toThrow();
    main.setMainWindow(win);
  });

  it("handles window-toggle-pin when window exists and when null", () => {
    const win = main.getMainWindow();
    let replyChannel = "";
    let replyStatus: boolean | null = null;
    const fakeEvent = {
      reply: (channel: string, status: boolean) => {
        replyChannel = channel;
        replyStatus = status;
      },
    };

    ipcHandlers["window-toggle-pin"]!(fakeEvent, true);
    expect(win.isAlwaysOnTop()).toBe(true);
    expect(replyChannel).toBe("window-pin-status");
    expect(replyStatus as any).toBe(true);

    ipcHandlers["window-toggle-pin"]!(fakeEvent, false);
    expect(win.isAlwaysOnTop()).toBe(false);
    expect(replyStatus as any).toBe(false);

    // Test when mainWindow is null
    main.setMainWindow(null);
    expect(() => ipcHandlers["window-toggle-pin"]!(fakeEvent, true)).not.toThrow();
    main.setMainWindow(win);
  });

  it("resets mainWindow on window closed event", () => {
    const win = main.getMainWindow();
    expect(typeof win.winHandlers["closed"]).toBe("function");
    win.winHandlers["closed"]!();
    expect(main.getMainWindow()).toBeNull();
  });

  it("handles app activate event", () => {
    // When no windows exist: creates one
    allWindows = [];
    appHandlers["activate"]!();
    expect(main.getMainWindow()).not.toBeNull();

    // When a window exists: doesn't create new
    allWindows = [main.getMainWindow()];
    const currentWin = main.getMainWindow();
    appHandlers["activate"]!();
    expect(main.getMainWindow()).toBe(currentWin);
  });

  it("handles window-all-closed event on non-darwin and darwin platforms", () => {
    const originalPlatform = process.platform;

    try {
      // Non-darwin (e.g. win32)
      Object.defineProperty(process, "platform", { value: "win32", configurable: true });
      quitCalled = false;
      appHandlers["window-all-closed"]!();
      expect(quitCalled).toBe(true);

      // Darwin (macOS)
      Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
      quitCalled = false;
      appHandlers["window-all-closed"]!();
      expect(quitCalled).toBe(false);
    } finally {
      Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    }
  });
});
