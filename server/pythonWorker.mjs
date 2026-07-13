import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const parseError = (error) => (error instanceof Error ? error.message : String(error));
const PROGRESS_PREFIX = "__PROGRESS__";

export const runWorkerExtraction = async ({
  session,
  profile,
  config,
  onProgress,
}) => {
  const outputDir = path.join(session.workspaceDir, "outputs");
  await fs.mkdir(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, "result.json");

  const args = [
    config.workerScript,
    "--session-id",
    session.id,
    "--session-dir",
    session.workspaceDir,
    "--input-pdf",
    session.uploadedFilePath,
    "--output-json",
    outputPath,
    "--profile",
    profile,
    "--ollama-base-url",
    config.ollamaBaseUrl,
    "--model",
    config.ollamaModel,
    "--max-pages",
    String(config.maxPdfPages),
    "--pageindex-root",
    config.pageIndexRoot,
  ];

  let commandResult;
  try {
    commandResult = await runCommand(config.pythonExecutable, args, {
      cwd: config.repoRoot,
      onProgress,
    });
  } catch (error) {
    let cleanWorkerError = null;
    try {
      const raw = await fs.readFile(outputPath, "utf8");
      const workerOutput = JSON.parse(raw);
      if (workerOutput?.status !== "ok" && typeof workerOutput?.error === "string" && workerOutput.error) {
        cleanWorkerError = new Error(workerOutput.error);
      }
    } catch {
      // Fall back to the original process error when the worker did not emit a structured error file.
    }
    if (cleanWorkerError) {
      throw cleanWorkerError;
    }
    throw error;
  }

  const { stdout, stderr } = commandResult;

  let workerOutput;
  try {
    const raw = await fs.readFile(outputPath, "utf8");
    workerOutput = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Worker did not produce valid JSON output: ${parseError(error)}`);
  }

  if (workerOutput?.status !== "ok") {
    throw new Error(
      `Worker reported failure: ${workerOutput?.error ?? "unknown error"}\n${stderr ?? ""}`
    );
  }

  return {
    workerOutput,
    logs: {
      stdout,
      stderr,
    },
  };
};

const runCommand = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
        PYTHONIOENCODING: "utf-8",
      },
    });

    let stdout = "";
    let stderr = "";
    let stdoutBuffer = "";

    const handleStdoutLine = (line) => {
      if (!line) {
        return;
      }

      if (line.startsWith(PROGRESS_PREFIX)) {
        try {
          const payload = JSON.parse(line.slice(PROGRESS_PREFIX.length));
          options.onProgress?.(payload);
        } catch (error) {
          stdout += `[progress-parse-error] ${parseError(error)} :: ${line}\n`;
        }
        return;
      }

      stdout += `${line}\n`;
    };

    child.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() ?? "";
      for (const line of lines) {
        handleStdoutLine(line);
      }
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(new Error(`Failed to start worker process: ${parseError(error)}`));
    });

    child.on("close", (code) => {
      if (stdoutBuffer) {
        handleStdoutLine(stdoutBuffer);
      }
      if (code !== 0) {
        reject(
          new Error(
            `Worker exited with code ${code}.\nSTDERR:\n${stderr}\nSTDOUT:\n${stdout}`
          )
        );
        return;
      }
      resolve({ stdout, stderr });
    });
  });
