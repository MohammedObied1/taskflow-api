import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, request, session } from "./api.js";

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe("request", () => {
  beforeEach(() => {
    session.set(null);
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends a bearer token when a session is present", async () => {
    session.set({ access_token: "abc", refresh_token: "ref" });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await request("/projects");

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer abc");
  });

  it("throws ApiError with the server's detail message on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, { detail: "Not found" })));

    await expect(request("/projects/999")).rejects.toMatchObject({ status: 404, message: "Not found" });
  });

  it("joins pydantic validation errors into one message", async () => {
    const detail = [{ loc: ["body", "email"], msg: "invalid email" }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(422, { detail })));

    await expect(request("/auth/register")).rejects.toMatchObject({ message: "email: invalid email" });
  });

  it("treats a network failure as ApiError(0)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(request("/projects")).rejects.toBeInstanceOf(ApiError);
  });

  it("treats a 502/503/504 gateway error like a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(503, {})));

    await expect(request("/projects")).rejects.toMatchObject({ status: 0, message: "Network error" });
  });

  it("refreshes an expired access token once and retries the original request", async () => {
    session.set({ access_token: "old", refresh_token: "ref" });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { detail: "expired" }))
      .mockResolvedValueOnce(jsonResponse(200, { access_token: "new", refresh_token: "ref2" }))
      .mockResolvedValueOnce(jsonResponse(200, { items: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await request("/projects");

    expect(result).toEqual({ items: [] });
    expect(session.get().access_token).toBe("new");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // The retried request must carry the freshly rotated token.
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe("Bearer new");
  });

  it("logs the session out when the refresh call itself fails", async () => {
    session.set({ access_token: "old", refresh_token: "ref" });
    let expired = false;
    session.onExpired(() => {
      expired = true;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(jsonResponse(401, {})).mockResolvedValueOnce(jsonResponse(401, {}))
    );

    await expect(request("/projects")).rejects.toBeInstanceOf(ApiError);
    expect(session.get()).toBeNull();
    expect(expired).toBe(true);
  });
});

describe("api.login", () => {
  it("posts credentials as a form body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { access_token: "a", refresh_token: "b" }));
    vi.stubGlobal("fetch", fetchMock);

    await api.login("alice", "Passw0rd123");

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(options.body.toString()).toBe("username=alice&password=Passw0rd123");
  });
});
