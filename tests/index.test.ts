import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from "bun:test";
import { launchApp, defaultExit, autoRun } from "../index.ts";
import EventEmitter from "events";
import path from "path";

describe("index.ts (Electron launcher)", () => {
  let logSpy: any;
  let errSpy: any;

  beforeEach(() => {
    logSpy = spyOn(console, "log").mockImplementation(() => {});
    errSpy = spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errSpy.mockRestore();
  });
  it("defaultExit calls process.exit", () => {
    const origExit = process.exit;
    let codeCalled: number | null = null;
    (process as any).exit = (code: number) => {
      codeCalled = code;
      return code as never;
    };
    try {
      defaultExit(7);
      expect(codeCalled as any).toBe(7);
    } finally {
      process.exit = origExit;
    }
  });

  it("exits with 1 when electron executable does not exist", () => {
    let exitCode: number | null = null;
    const mockExit = (code: number) => {
      exitCode = code;
      return code as never;
    };

    launchApp("/non/existent/electron.exe", undefined, mockExit);
    expect(exitCode as any).toBe(1);
  });

  it("spawns electron and handles close event with specific code", () => {
    const fakeChild = new EventEmitter();
    const spawnMock = mock((exe: string, args: string[], options: any) => {
      expect(args).toEqual(["."]);
      expect(options).toEqual({ stdio: "inherit", shell: true });
      return fakeChild as any;
    });

    let exitCode: number | null = null;
    const mockExit = (code: number) => {
      exitCode = code;
      return code as never;
    };

    const existingFile = path.resolve("./package.json");
    const child = launchApp(existingFile, spawnMock as any, mockExit);
    expect(child).toBe(fakeChild as any);

    fakeChild.emit("close", 0);
    expect(exitCode as any).toBe(0);
  });

  it("handles close event with null code (falls back to 0)", () => {
    const fakeChild = new EventEmitter();
    const spawnMock = mock(() => fakeChild as any);

    let exitCode: number | null = null;
    const mockExit = (code: number) => {
      exitCode = code;
      return code as never;
    };

    const existingFile = path.resolve("./package.json");
    launchApp(existingFile, spawnMock as any, mockExit);

    fakeChild.emit("close", null);
    expect(exitCode as any).toBe(0);
  });

  it("handles close event with non-zero exit code", () => {
    const fakeChild = new EventEmitter();
    const spawnMock = mock(() => fakeChild as any);

    let exitCode: number | null = null;
    const mockExit = (code: number) => {
      exitCode = code;
      return code as never;
    };

    const existingFile = path.resolve("./package.json");
    launchApp(existingFile, spawnMock as any, mockExit);

    fakeChild.emit("close", 42);
    expect(exitCode as any).toBe(42);
  });

  it("autoRun returns null when shouldRun is false", () => {
    expect(autoRun(false)).toBeNull();
  });

  it("autoRun calls launcher when shouldRun is true", () => {
    const mockLauncher = mock(() => "launched" as any);
    const result = autoRun(true, mockLauncher);
    expect(result).toBe("launched");
    expect(mockLauncher).toHaveBeenCalledTimes(1);
  });
});
