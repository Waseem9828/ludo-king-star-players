// Starts backend + frontend together with `npm run dev` from the repo root.
// Plain Node child_process — no extra dependency (e.g. concurrently) needed.
import { spawn } from "node:child_process";

const procs = [
  { name: "backend", cmd: "npm", args: ["run", "dev"], cwd: "backend" },
  { name: "frontend", cmd: "npm", args: ["run", "dev", "--", "--host", "0.0.0.0"], cwd: "frontend" },
];

const children = procs.map(({ name, cmd, args, cwd }) => {
  const child = spawn(cmd, args, { cwd, shell: true, stdio: "pipe" });

  const prefix = `[${name}] `;
  const pipe = (stream, out) => {
    stream.on("data", (chunk) => {
      const text = chunk.toString().replace(/\r?\n$/, "");
      for (const line of text.split(/\r?\n/)) out.write(prefix + line + "\n");
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);

  child.on("exit", (code) => {
    console.log(`${prefix}exited with code ${code}`);
  });

  return child;
});

function shutdown() {
  for (const child of children) child.kill();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
