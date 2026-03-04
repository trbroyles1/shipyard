import { vi, describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import { http, HttpResponse, delay } from "msw";
import { server } from "@/test/msw/server";
import { GitLabApiError } from "@/lib/errors";
import { createMockLogger } from "./test-utils";

vi.mock("@/lib/rate-limiter", () => ({
  acquire: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => createMockLogger(),
}));

import { gitlabFetch, gitlabFetchAllPages } from "@/lib/gitlab-client";

const GITLAB_URL = "https://gitlab.test";
const GITLAB_API = `${GITLAB_URL}/api/v4`;
const TEST_TOKEN = "test-token";

beforeAll(() => {
  server.listen();
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  process.env.GITLAB_URL = GITLAB_URL;
  process.env.GITLAB_GROUP_ID = "99";
});

describe("gitlabFetch()", () => {
  it("returns parsed JSON on a successful fetch", async () => {
    const payload = { id: 1, name: "project-alpha" };
    server.use(
      http.get(`${GITLAB_API}/projects/1`, ({ request }) => {
        expect(request.headers.get("Authorization")).toBe(`Bearer ${TEST_TOKEN}`);
        expect(request.headers.get("Content-Type")).toBe("application/json");
        return HttpResponse.json(payload);
      }),
    );

    const result = await gitlabFetch("/projects/1", TEST_TOKEN);

    expect(result).toEqual(payload);
  });

  it("sends POST with serialized body", async () => {
    const body = { title: "New MR", description: "Fix stuff" };
    let receivedMethod = "";
    let receivedBody: unknown = null;

    server.use(
      http.post(`${GITLAB_API}/projects/1/merge_requests`, async ({ request }) => {
        receivedMethod = request.method;
        receivedBody = await request.json();
        expect(request.headers.get("Content-Type")).toBe("application/json");
        return HttpResponse.json({ id: 42 });
      }),
    );

    const result = await gitlabFetch("/projects/1/merge_requests", TEST_TOKEN, {
      method: "POST",
      body,
    });

    expect(receivedMethod).toBe("POST");
    expect(receivedBody).toEqual(body);
    expect(result).toEqual({ id: 42 });
  });

  describe("non-transient errors throw immediately without retry", () => {
    it.each([
      [401, "Unauthorized"],
      [403, "Forbidden"],
      [404, "Not Found"],
    ])("%i response throws GitLabApiError", async (status, statusText) => {
      server.use(
        http.get(`${GITLAB_API}/projects/1`, () => {
          return new HttpResponse(statusText, { status, statusText });
        }),
      );

      await expect(gitlabFetch("/projects/1", TEST_TOKEN)).rejects.toSatisfy(
        (error: unknown) => {
          expect(error).toBeInstanceOf(GitLabApiError);
          expect((error as GitLabApiError).status).toBe(status);
          return true;
        },
      );
    });
  });

  describe("retry behavior (fake timers)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.spyOn(Math, "random").mockReturnValue(0.5);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("retries on 429 using Retry-After header", async () => {
      let callCount = 0;

      server.use(
        http.get(`${GITLAB_API}/projects/1`, () => {
          callCount++;
          if (callCount === 1) {
            return new HttpResponse("Rate limited", {
              status: 429,
              statusText: "Too Many Requests",
              headers: { "Retry-After": "1" },
            });
          }
          return HttpResponse.json({ id: 1 });
        }),
      );

      const promise = gitlabFetch("/projects/1", TEST_TOKEN);
      await vi.advanceTimersByTimeAsync(1_000);
      const result = await promise;

      expect(result).toEqual({ id: 1 });
    });

    it("retries transient 500 errors and succeeds on third attempt", async () => {
      let callCount = 0;

      server.use(
        http.get(`${GITLAB_API}/projects/1`, () => {
          callCount++;
          if (callCount <= 2) {
            return new HttpResponse("Internal Server Error", {
              status: 500,
              statusText: "Internal Server Error",
            });
          }
          return HttpResponse.json({ id: 1 });
        }),
      );

      const promise = gitlabFetch("/projects/1", TEST_TOKEN);
      // Backoff attempt 0: min(1000*1, 10000) * (0.5 + 0.5*0.5) = 750ms
      await vi.advanceTimersByTimeAsync(750);
      // Backoff attempt 1: min(1000*2, 10000) * (0.5 + 0.5*0.5) = 1500ms
      await vi.advanceTimersByTimeAsync(1_500);
      const result = await promise;

      expect(result).toEqual({ id: 1 });
    });

    it("throws after exhausting all retry attempts on persistent 500", async () => {
      server.use(
        http.get(`${GITLAB_API}/projects/1`, () => {
          return new HttpResponse("Internal Server Error", {
            status: 500,
            statusText: "Internal Server Error",
          });
        }),
      );

      const promise = gitlabFetch("/projects/1", TEST_TOKEN);
      // Attach the rejection handler before advancing timers to prevent
      // Node's unhandled-rejection warning.
      const assertion = expect(promise).rejects.toSatisfy((error: unknown) => {
        expect(error).toBeInstanceOf(GitLabApiError);
        expect((error as GitLabApiError).status).toBe(500);
        return true;
      });

      // Advance past both backoff delays so all 3 attempts complete
      await vi.advanceTimersByTimeAsync(750 + 1_500);
      await assertion;
    });
  });

  it("rejects when caller-provided signal aborts", async () => {
    server.use(
      http.get(`${GITLAB_API}/projects/1`, async () => {
        await delay(500);
        return HttpResponse.json({ id: 1 });
      }),
    );

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 20);

    await expect(
      gitlabFetch("/projects/1", TEST_TOKEN, { signal: controller.signal }),
    ).rejects.toThrow();
  }, 10_000);

  it("throws GitLabApiError with status 502 for invalid JSON response", async () => {
    server.use(
      http.get(`${GITLAB_API}/projects/1`, () => {
        return HttpResponse.text("not json", { status: 200 });
      }),
    );

    await expect(gitlabFetch("/projects/1", TEST_TOKEN)).rejects.toSatisfy(
      (error: unknown) => {
        expect(error).toBeInstanceOf(GitLabApiError);
        expect((error as GitLabApiError).status).toBe(502);
        return true;
      },
    );
  });
});

describe("gitlabFetchAllPages()", () => {
  const PATH = "/groups/99/merge_requests";

  it("returns a single page of results", async () => {
    const items = [{ id: 1 }, { id: 2 }];

    server.use(
      http.get(`${GITLAB_API}${PATH}`, () => {
        return HttpResponse.json(items, {
          headers: { "x-total-pages": "1" },
        });
      }),
    );

    const result = await gitlabFetchAllPages(PATH, TEST_TOKEN);

    expect(result).toEqual(items);
  });

  it("accumulates results across multiple pages", async () => {
    const pages: Record<string, unknown[]> = {
      "1": [{ id: 1 }, { id: 2 }],
      "2": [{ id: 3 }, { id: 4 }],
      "3": [{ id: 5 }],
    };

    server.use(
      http.get(`${GITLAB_API}${PATH}`, ({ request }) => {
        const url = new URL(request.url);
        const page = url.searchParams.get("page") || "1";
        return HttpResponse.json(pages[page], {
          headers: { "x-total-pages": "3" },
        });
      }),
    );

    const result = await gitlabFetchAllPages(PATH, TEST_TOKEN);

    expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]);
  });

  it("stops at maxPages even when more pages exist", async () => {
    const pages: Record<string, unknown[]> = {
      "1": [{ id: 1 }],
      "2": [{ id: 2 }],
    };

    server.use(
      http.get(`${GITLAB_API}${PATH}`, ({ request }) => {
        const url = new URL(request.url);
        const page = url.searchParams.get("page") || "1";
        return HttpResponse.json(pages[page] || [], {
          headers: { "x-total-pages": "10" },
        });
      }),
    );

    const result = await gitlabFetchAllPages(PATH, TEST_TOKEN, {}, 2);

    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("includes custom params in the request URL", async () => {
    let capturedUrl = "";

    server.use(
      http.get(`${GITLAB_API}${PATH}`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json([], {
          headers: { "x-total-pages": "1" },
        });
      }),
    );

    await gitlabFetchAllPages(PATH, TEST_TOKEN, { state: "opened" });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get("state")).toBe("opened");
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.get("per_page")).toBe("100");
  });

  describe("error mid-pagination (fake timers)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.spyOn(Math, "random").mockReturnValue(0.5);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("throws on error mid-pagination with no partial results", async () => {
      server.use(
        http.get(`${GITLAB_API}${PATH}`, ({ request }) => {
          const url = new URL(request.url);
          const page = url.searchParams.get("page") || "1";
          if (page === "1") {
            return HttpResponse.json([{ id: 1 }], {
              headers: { "x-total-pages": "3" },
            });
          }
          return new HttpResponse("Internal Server Error", {
            status: 500,
            statusText: "Internal Server Error",
          });
        }),
      );

      const promise = gitlabFetchAllPages(PATH, TEST_TOKEN);
      // Attach the rejection handler before advancing timers to prevent
      // Node's unhandled-rejection warning.
      const assertion = expect(promise).rejects.toSatisfy((error: unknown) => {
        expect(error).toBeInstanceOf(GitLabApiError);
        expect((error as GitLabApiError).status).toBe(500);
        return true;
      });

      // Page 2 fails with 500, retries with backoff, all 3 attempts fail
      await vi.advanceTimersByTimeAsync(750 + 1_500);
      await assertion;
    });
  });
});
