import { spawn } from "node:child_process";

const serverHost = process.env.HOST ?? "127.0.0.1";
const serverPort = process.env.PORT ?? "3000";
const clientPort = process.env.CLIENT_PORT ?? "5173";
const serverOrigin = `http://${serverHost}:${serverPort}`;

const processes = [
  spawn("bun", ["run", "dev:server"], {
    stdio: "inherit",
    env: { ...process.env, HOST: serverHost, PORT: serverPort },
  }),
  spawn("bun", ["run", "dev:client"], {
    stdio: "inherit",
    env: {
      ...process.env,
      CLIENT_PORT: clientPort,
      SERVER_ORIGIN: serverOrigin,
    },
  }),
];

let shuttingDown = false;

function shutdown(signal: NodeJS.Signals) {
  shuttingDown = true;

  for (const child of processes) {
    child.kill(signal);
  }
}

process.on("SIGINT", () => {
  shutdown("SIGINT");
  process.exit(130);
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
  process.exit(143);
});

for (const child of processes) {
  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    shutdown("SIGTERM");
    process.exit(code ?? (signal ? 1 : 0));
  });
}
