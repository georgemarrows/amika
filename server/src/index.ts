import { createHttpServer } from "./http.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";

const server = createHttpServer();

server.listen(port, host, () => {
  console.log(`Amika server listening on http://${host}:${port}`);
});
