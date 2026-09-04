import { spawn } from "node:child_process";

export type ProcessResult = {
  command: string;
  args: string[];
  code: number;
  stdout: string;
  stderr: string;
};

export function runProcess(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
    onOutput?: (line: string) => void;
  } = {}
) {
  return new Promise<ProcessResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let buffer = "";

    const emitLines = (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";
      for (const line of lines) if (line.trim()) options.onOutput?.(line.trim());
    };

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      emitLines(text);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      emitLines(text);
    });
    child.on("error", reject);

    const timer = options.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGTERM");
          setTimeout(() => child.kill("SIGKILL"), 5_000).unref();
        }, options.timeoutMs)
      : undefined;

    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (buffer.trim()) options.onOutput?.(buffer.trim());
      if (timedOut) {
        reject(new Error(`${command} timed out after ${options.timeoutMs}ms.`));
        return;
      }
      const result = { command, args, code: code ?? -1, stdout, stderr };
      if (result.code !== 0) {
        reject(new Error(`${command} exited with code ${result.code}: ${(stderr || stdout).trim()}`));
        return;
      }
      resolve(result);
    });
  });
}
