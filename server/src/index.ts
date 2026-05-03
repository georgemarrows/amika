import { createHttpServer } from "./http.js";

const portValue = process.env.PORT ?? "3000";
const port = Number(portValue);
const host = process.env.HOST ?? "127.0.0.1";

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  console.error(`Invalid PORT: ${portValue}`);
  process.exit(1);
}

const server = createHttpServer();

server.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(`Amika server listening on http://${host}:${port}`);
});

function shutdown() {
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exit(1);
    }

    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
