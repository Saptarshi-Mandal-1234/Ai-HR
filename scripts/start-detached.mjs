import { spawn } from "node:child_process";

const port = process.env.PORT || "3100";
const child = spawn(process.execPath, ["server.js"], {
  cwd: new URL("..", import.meta.url),
  env: { ...process.env, PORT: port },
  detached: true,
  stdio: "ignore"
});

child.unref();
console.log(`AI HR started at http://localhost:${port}`);
