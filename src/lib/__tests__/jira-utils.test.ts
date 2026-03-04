import { describe, it, expect } from "vitest";
import {
  JIRA_TICKET_RE,
  normalizeJiraBaseUrl,
  jiraTicketUrl,
  linkifyJiraTickets,
} from "@/lib/jira-utils";

describe("JIRA_TICKET_RE", () => {
  it.each([
    ["ABC-123", ["ABC-123"]],
    ["PROJ-1", ["PROJ-1"]],
    ["XX-999999", ["XX-999999"]],
    ["LONGPROJCT-42", ["LONGPROJCT-42"]],
    ["fix ABC-1 and DEF-2", ["ABC-1", "DEF-2"]],
  ])("matches tickets in %s", (input, expected) => {
    expect(input.match(JIRA_TICKET_RE)).toEqual(expected);
  });

  it.each([
    "a-1",
    "A-1",
    "TOOLONGKEYX-1",
    "ABC-",
    "-123",
    "no tickets here",
  ])("does not match %s", (input) => {
    expect(input.match(JIRA_TICKET_RE)).toBeNull();
  });
});

describe("normalizeJiraBaseUrl", () => {
  it("strips trailing slashes", () => {
    expect(normalizeJiraBaseUrl("https://jira.example.com/")).toBe(
      "https://jira.example.com",
    );
  });

  it("strips multiple trailing slashes", () => {
    expect(normalizeJiraBaseUrl("https://jira.example.com///")).toBe(
      "https://jira.example.com",
    );
  });

  it("returns URL unchanged when no trailing slash", () => {
    expect(normalizeJiraBaseUrl("https://jira.example.com")).toBe(
      "https://jira.example.com",
    );
  });

  it("returns undefined for undefined input", () => {
    expect(normalizeJiraBaseUrl(undefined)).toBeUndefined();
  });
});

describe("jiraTicketUrl", () => {
  it("constructs correct browse URL", () => {
    expect(jiraTicketUrl("https://jira.example.com", "PROJ-42")).toBe(
      "https://jira.example.com/browse/PROJ-42",
    );
  });
});

describe("linkifyJiraTickets", () => {
  const BASE_URL = "https://jira.example.com";
  const CLASS_NAME = "jira-link";

  it("returns [text] when no tickets are found", () => {
    const result = linkifyJiraTickets("no tickets here", BASE_URL, CLASS_NAME);
    expect(result).toEqual(["no tickets here"]);
  });

  it("creates anchor elements when baseUrl is provided", () => {
    const result = linkifyJiraTickets("fix PROJ-42 issue", BASE_URL, CLASS_NAME);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe("fix ");
    expect(result[2]).toBe(" issue");

    const anchor = result[1] as { type: string; props: Record<string, unknown> };
    expect(anchor.type).toBe("a");
    expect(anchor.props.href).toBe("https://jira.example.com/browse/PROJ-42");
    expect(anchor.props.target).toBe("_blank");
    expect(anchor.props.rel).toBe("noopener noreferrer");
    expect(anchor.props.className).toBe(CLASS_NAME);
    expect(anchor.props.children).toBe("PROJ-42");
  });

  it("creates span elements when baseUrl is undefined", () => {
    const result = linkifyJiraTickets("fix PROJ-42 issue", undefined, CLASS_NAME);

    expect(result).toHaveLength(3);
    const span = result[1] as { type: string; props: Record<string, unknown> };
    expect(span.type).toBe("span");
    expect(span.props.className).toBe(CLASS_NAME);
    expect(span.props.children).toBe("PROJ-42");
  });

  it("handles multiple tickets", () => {
    const result = linkifyJiraTickets("ABC-1 and DEF-2", BASE_URL, CLASS_NAME);

    expect(result).toHaveLength(3);

    const first = result[0] as { type: string; props: Record<string, unknown> };
    expect(first.type).toBe("a");
    expect(first.props.children).toBe("ABC-1");

    expect(result[1]).toBe(" and ");

    const second = result[2] as { type: string; props: Record<string, unknown> };
    expect(second.type).toBe("a");
    expect(second.props.children).toBe("DEF-2");
  });

  it("handles ticket at start of string", () => {
    const result = linkifyJiraTickets("PROJ-1 is done", BASE_URL, CLASS_NAME);

    expect(result).toHaveLength(2);
    const anchor = result[0] as { type: string; props: Record<string, unknown> };
    expect(anchor.type).toBe("a");
    expect(anchor.props.children).toBe("PROJ-1");
    expect(result[1]).toBe(" is done");
  });

  it("handles ticket at end of string", () => {
    const result = linkifyJiraTickets("relates to PROJ-1", BASE_URL, CLASS_NAME);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe("relates to ");
    const anchor = result[1] as { type: string; props: Record<string, unknown> };
    expect(anchor.type).toBe("a");
    expect(anchor.props.children).toBe("PROJ-1");
  });

  it("normalizes baseUrl trailing slashes in href", () => {
    const result = linkifyJiraTickets(
      "PROJ-42",
      "https://jira.example.com///",
      CLASS_NAME,
    );

    const anchor = result[0] as { type: string; props: Record<string, unknown> };
    expect(anchor.props.href).toBe("https://jira.example.com/browse/PROJ-42");
  });
});
