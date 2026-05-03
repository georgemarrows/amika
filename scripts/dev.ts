import { spawn } from "node:child_process";

const processes = [
  spawn("bun", ["run", "dev:server"], { stdio: "inherit" }),
  spawn("bun", ["run", "dev:client"], { stdio: "inherit" }),
];

function shutdown(signal: NodeJS.Signals) {
  for (const child of processes) {
    child.kill(signal);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

for (const child of processes) {
  child.on("exit", (code) => {
    if (code && code !== 0) {
      shutdown("SIGTERM");
      process.exit(code);
    }
  });
}

