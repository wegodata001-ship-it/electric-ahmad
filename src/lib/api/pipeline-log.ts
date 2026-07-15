export type PipelineStage =
  | "UPLOAD"
  | "STORAGE"
  | "DATABASE"
  | "AI"
  | "RESPONSE"
  | "ERROR";

export function pipelineLog(stage: PipelineStage, message: string, meta?: unknown) {
  const prefix = `[${stage}]`;
  if (meta !== undefined) {
    console.log(prefix, message, meta);
  } else {
    console.log(prefix, message);
  }
}

export class PipelineError extends Error {
  stage: PipelineStage;
  step: string;

  constructor(stage: PipelineStage, step: string, message: string, cause?: unknown) {
    super(`[${stage}] ${step}: ${message}`);
    this.name = "PipelineError";
    this.stage = stage;
    this.step = step;
    if (cause instanceof Error && cause.stack) {
      this.stack = `${this.message}\nCaused by: ${cause.stack}`;
    }
  }
}
