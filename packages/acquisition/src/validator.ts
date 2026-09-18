import * as path from "path";
import type { AcquisitionRequest, AcquisitionConfig } from "./types";

export class ValidationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ValidationError";
    this.code = code;
  }
}

export function validateQuarantinePath(quarantinePath: string): void {
  if (!quarantinePath.startsWith("content/quarantine/")) {
    throw new ValidationError(
      "invalid-quarantine-path",
      `quarantinePath must start with content/quarantine/ — got ${quarantinePath}`,
    );
  }
  if (
    quarantinePath.includes("..") ||
    quarantinePath.includes("//") ||
    path.isAbsolute(quarantinePath)
  ) {
    throw new ValidationError(
      "path-traversal",
      `quarantinePath traversal detected: ${quarantinePath}`,
    );
  }
  // No shell interpolation characters
  if (/[;&|`$()]/.test(quarantinePath)) {
    throw new ValidationError(
      "shell-interpolation",
      `quarantinePath contains shell metacharacters: ${quarantinePath}`,
    );
  }
  // No null bytes or control chars
  if (/[\x00-\x1F\x7F]/.test(quarantinePath)) {
    throw new ValidationError(
      "control-characters",
      `quarantinePath contains control characters`,
    );
  }
}

export function validateHost(url: string, config: AcquisitionConfig): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ValidationError("invalid-url", `Invalid URL: ${url}`);
  }
  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new ValidationError(
      "invalid-protocol",
      `Only https/http allowed: ${url}`,
    );
  }
  if (!config.allowedHosts.includes(parsed.hostname)) {
    throw new ValidationError(
      "host-not-allowed",
      `Host ${parsed.hostname} not in allow-list ${config.allowedHosts.join(", ")}`,
    );
  }
  if (config.allowedPathPrefixes && config.allowedPathPrefixes.length > 0) {
    const allowed = config.allowedPathPrefixes.some((p) =>
      parsed.pathname.startsWith(p),
    );
    // For example.invalid (synthetic) we allow any path
    if (parsed.hostname !== "example.invalid" && !allowed) {
      throw new ValidationError(
        "path-not-allowed",
        `Path ${parsed.pathname} not in allow-list`,
      );
    }
  }
  // No shell interpolation in URL
  if (/[;&|`$()]/.test(url)) {
    throw new ValidationError(
      "shell-interpolation-url",
      `URL contains shell metacharacters`,
    );
  }
}

export function validateRequest(
  request: AcquisitionRequest,
  config: AcquisitionConfig,
): void {
  validateQuarantinePath(request.quarantinePath);
  validateHost(request.url, config);
  if (
    request.expectedByteSize &&
    request.expectedByteSize > config.maxByteSize
  ) {
    throw new ValidationError(
      "size-exceeds-limit",
      `expectedByteSize ${request.expectedByteSize} exceeds max ${config.maxByteSize}`,
    );
  }
  if (
    request.expectedMediaType &&
    !config.allowedMediaTypes.includes(request.expectedMediaType)
  ) {
    throw new ValidationError(
      "media-type-not-allowed",
      `Media type ${request.expectedMediaType} not allowed`,
    );
  }
  // Branch as release identity is forbidden — releaseKey must contain commit/tag not branch
  if (
    request.releaseKey.includes("@main:") ||
    request.releaseKey.includes("@master:") ||
    request.releaseKey.includes("@HEAD:")
  ) {
    throw new ValidationError(
      "branch-as-release",
      `releaseKey must use immutable commit/tag, not branch`,
    );
  }
}

export function validateMediaType(
  actual: string,
  expected: string | undefined,
  allowed: string[],
): void {
  if (expected && actual !== expected) {
    throw new ValidationError(
      "media-type-mismatch",
      `Expected mediaType ${expected} but got ${actual}`,
    );
  }
  if (!allowed.includes(actual)) {
    throw new ValidationError(
      "media-type-not-allowed",
      `Media type ${actual} not in allow-list`,
    );
  }
}

export function validateByteSize(
  actual: number,
  expected: number | undefined,
  max: number,
): void {
  if (expected !== undefined && actual !== expected) {
    throw new ValidationError(
      "size-mismatch",
      `Expected byteSize ${expected} but got ${actual}`,
    );
  }
  if (actual > max) {
    throw new ValidationError(
      "size-exceeds-limit",
      `byteSize ${actual} exceeds max ${max}`,
    );
  }
  if (actual <= 0) {
    throw new ValidationError("invalid-size", `byteSize must be >0`);
  }
}
