const NUMERIC_ID_PATTERN = /^\d+$/;
const DISCUSSION_ID_PATTERN = /^[0-9a-f]{40}$/i;

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function validateNumericId(value: string, name: string): number {
  if (!NUMERIC_ID_PATTERN.test(value)) {
    throw new ValidationError(`Invalid ${name}: must be a numeric ID`);
  }
  return parseInt(value, 10);
}

export function validateDiscussionId(value: string): string {
  if (!DISCUSSION_ID_PATTERN.test(value)) {
    throw new ValidationError("Invalid discussionId: must be a SHA-1 hex string");
  }
  return value;
}
