import { describe, it, expect, mock } from "bun:test";

let exposedApiKey = "";
let exposedApi: any = null;
const sendCalls: Array<[string, ...any[]]> = [];
const onHandlers: Record<string, Function> = {};

mock.module("electron", () => ({
  contextBridge: {
    exposeInMainWorld: mock((key: string, api: any) => {
      exposedApiKey = key;
      exposedApi = api;
    }),
  },
  ipcRenderer: {
    send: mock((channel: string, ...args: any[]) => {
      sendCalls.push([channel, ...args]);
    }),
    on: mock((channel: string, handler: Function) => {
      onHandlers[channel] = handler;
    }),
  },
}));

// Load preload.js
require("../preload.js");

describe("preload.js", () => {
  it("exposes electronAPI into main world", () => {
    expect(exposedApiKey).toBe("electronAPI");
    expect(exposedApi).toBeDefined();
    expect(typeof exposedApi.minimize).toBe("function");
    expect(typeof exposedApi.close).toBe("function");
    expect(typeof exposedApi.togglePin).toBe("function");
    expect(typeof exposedApi.onPinStatus).toBe("function");
  });

  it("calls ipcRenderer.send for window-minimize", () => {
    sendCalls.length = 0;
    exposedApi.minimize();
    expect(sendCalls).toEqual([["window-minimize"]]);
  });

  it("calls ipcRenderer.send for window-close", () => {
    sendCalls.length = 0;
    exposedApi.close();
    expect(sendCalls).toEqual([["window-close"]]);
  });

  it("calls ipcRenderer.send for window-toggle-pin", () => {
    sendCalls.length = 0;
    exposedApi.togglePin(true);
    expect(sendCalls).toEqual([["window-toggle-pin", true]]);

    sendCalls.length = 0;
    exposedApi.togglePin(false);
    expect(sendCalls).toEqual([["window-toggle-pin", false]]);
  });

  it("registers listener and invokes callback on window-pin-status", () => {
    let pinStatusResult: boolean | null = null;
    exposedApi.onPinStatus((status: boolean) => {
      pinStatusResult = status;
    });

    expect(typeof onHandlers["window-pin-status"]).toBe("function");
    onHandlers["window-pin-status"]!({}, true);
    expect(pinStatusResult as any).toBe(true);

    onHandlers["window-pin-status"]!({}, false);
    expect(pinStatusResult as any).toBe(false);
  });
});
