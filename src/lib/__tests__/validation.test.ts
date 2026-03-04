import { describe, it, expect } from "vitest";

import {
  ValidationError,
  validateNumericId,
  validateDiscussionId,
} from "@/lib/validation";

describe("ValidationError", () => {
  it("is an instance of Error", () => {
    const err = new ValidationError("test");
    expect(err).toBeInstanceOf(Error);
  });

  it('has name "ValidationError"', () => {
    const err = new ValidationError("some message");
    expect(err.name).toBe("ValidationError");
  });

  it("preserves the provided message", () => {
    const err = new ValidationError("bad input");
    expect(err.message).toBe("bad input");
  });
});

describe("validateNumericId", () => {
  describe("valid inputs", () => {
    it('parses "123" to 123', () => {
      expect(validateNumericId("123", "projectId")).toBe(123);
    });

    it('parses "0" to 0', () => {
      expect(validateNumericId("0", "projectId")).toBe(0);
    });

    it("parses large numbers", () => {
      expect(validateNumericId("99999999", "projectId")).toBe(99999999);
    });

    it('parses leading-zero string "007" to 7', () => {
      expect(validateNumericId("007", "projectId")).toBe(7);
    });

    it('parses single digit "5"', () => {
      expect(validateNumericId("5", "iid")).toBe(5);
    });
  });

  describe("invalid inputs", () => {
    it('rejects alphabetic string "abc"', () => {
      expect(() => validateNumericId("abc", "projectId")).toThrow(
        ValidationError,
      );
    });

    it("rejects empty string", () => {
      expect(() => validateNumericId("", "projectId")).toThrow(
        ValidationError,
      );
    });

    it('rejects whitespace-padded " 123 "', () => {
      expect(() => validateNumericId(" 123 ", "projectId")).toThrow(
        ValidationError,
      );
    });

    it('rejects decimal "12.5"', () => {
      expect(() => validateNumericId("12.5", "projectId")).toThrow(
        ValidationError,
      );
    });

    it('rejects negative "-1"', () => {
      expect(() => validateNumericId("-1", "projectId")).toThrow(
        ValidationError,
      );
    });

    it("includes the parameter name in the error message", () => {
      expect(() => validateNumericId("abc", "myParam")).toThrow(
        /myParam/,
      );
    });

    it("error message mentions it must be a numeric ID", () => {
      expect(() => validateNumericId("abc", "projectId")).toThrow(
        /must be a numeric ID/,
      );
    });
  });
});

describe("validateDiscussionId", () => {
  const VALID_HEX_40 = "a".repeat(40);
  const VALID_UPPER_40 = "A".repeat(40);
  const VALID_MIXED_40 = "aAbBcCdDeEfF00112233aAbBcCdDeEfF00112233";

  describe("valid inputs", () => {
    it("accepts 40-char lowercase hex", () => {
      expect(validateDiscussionId(VALID_HEX_40)).toBe(VALID_HEX_40);
    });

    it("accepts 40-char uppercase hex", () => {
      expect(validateDiscussionId(VALID_UPPER_40)).toBe(VALID_UPPER_40);
    });

    it("accepts 40-char mixed case hex", () => {
      expect(validateDiscussionId(VALID_MIXED_40)).toBe(VALID_MIXED_40);
    });

    it("accepts a realistic SHA-1 hash", () => {
      const sha = "da39a3ee5e6b4b0d3255bfef95601890afd80709";
      expect(validateDiscussionId(sha)).toBe(sha);
    });
  });

  describe("invalid inputs", () => {
    it("rejects 39-char hex (too short)", () => {
      expect(() => validateDiscussionId("a".repeat(39))).toThrow(
        ValidationError,
      );
    });

    it("rejects 41-char hex (too long)", () => {
      expect(() => validateDiscussionId("a".repeat(41))).toThrow(
        ValidationError,
      );
    });

    it("rejects non-hex characters", () => {
      const nonHex = `${"a".repeat(39)}g`;
      expect(() => validateDiscussionId(nonHex)).toThrow(ValidationError);
    });

    it("rejects empty string", () => {
      expect(() => validateDiscussionId("")).toThrow(ValidationError);
    });

    it("rejects string with spaces", () => {
      expect(() => validateDiscussionId(`${"a".repeat(38)} a`)).toThrow(
        ValidationError,
      );
    });

    it("error message mentions SHA-1 hex string", () => {
      expect(() => validateDiscussionId("bad")).toThrow(
        /SHA-1 hex string/,
      );
    });
  });
});
