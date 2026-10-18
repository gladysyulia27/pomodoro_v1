import { spawn } from "child_process";
import path from "path";
import fs from "fs";

export const defaultExit = (code: number) => process.exit(code);

export function launchApp(
  electronExe = path.resolve("./node_modules/electron/dist/electron.exe"),
  spawnFn = spawn,
  exitFn: (code: number) => any = defaultExit
) {
  console.log("🌸 Launching FocusME! Pomodoro Desktop App via Bun...");

  // Find electron executable
  if (!fs.existsSync(electronExe)) {
    console.error("❌ Electron executable not found in node_modules. Please run: bun run node_modules/electron/install.js");
    return exitFn(1);
  }

  const child = spawnFn(electronExe, ["."], {
    stdio: "inherit",
    shell: true
  });

  child.on("close", (code: number | null) => {
    exitFn(code ?? 0);
  });

  return child;
}

export const autoRun = (shouldRun = import.meta.main, launcher = launchApp) => {
  if (shouldRun) {
    return launcher();
  }
  return null;
};

autoRun();