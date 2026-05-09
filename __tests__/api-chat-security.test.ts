import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("fs", () => ({
  default: {
    readFileSync: vi.fn(() =>
      JSON.stringify({
        url: "https://api.example.com",
        apiKey: "sk-secret-test-key-12345",
        model: "gpt-4o",
        creationModel: "gpt-4o",
      })
    ),
  },
}));

let POST: (req: Request) => Promise<Response>;

beforeEach(async () => {
  vi.resetModules();
  const mod = await import("../app/api/chat/route");
  POST = mod.POST as unknown as (req: Request) => Promise<Response>;
});

function makeRequest(body: unknown) {
  return new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/chat — security", () => {
  it("rejects invalid JSON body", async () => {
    const req = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("JSON");
  });

  it("rejects empty messages array", async () => {
    const res = await POST(makeRequest({ messages: [] }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("messages");
  });

  it("rejects non-array messages", async () => {
    const res = await POST(makeRequest({ messages: "hello" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("messages");
  });

  it("does not leak API URL in connection error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new Error("connect ECONNREFUSED");
      })
    );
    const res = await POST(
      makeRequest({ messages: [{ role: "user", content: "hi" }] })
    );
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error).not.toContain("api.example.com");
    expect(data.error).not.toContain("sk-");
    vi.unstubAllGlobals();
  });

  it("does not leak upstream error body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              error: { message: "Internal: apiKey=sk-secret-test-key-12345" },
            }),
            { status: 500 }
          )
        )
      )
    );
    const res = await POST(
      makeRequest({ messages: [{ role: "user", content: "hi" }] })
    );
    const data = await res.json();
    expect(data.error).not.toContain("sk-secret-test-key-12345");
    expect(data.error).not.toContain("apiKey");
    expect(data.error).toBe("API 返回错误 (500)");
    vi.unstubAllGlobals();
  });

  it("clamps max_tokens to upper bound", async () => {
    let capturedBody: string | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        capturedBody = init.body as string;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: "ok" } }],
            }),
            { headers: { "Content-Type": "application/json" } }
          )
        );
      })
    );
    await POST(
      makeRequest({
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 999999,
        stream: false,
      })
    );
    const parsed = JSON.parse(capturedBody!);
    expect(parsed.max_tokens).toBeLessThanOrEqual(16384);
    vi.unstubAllGlobals();
  });

  it("clamps temperature to valid range", async () => {
    let capturedBody: string | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        capturedBody = init.body as string;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: "ok" } }],
            }),
            { headers: { "Content-Type": "application/json" } }
          )
        );
      })
    );
    await POST(
      makeRequest({
        messages: [{ role: "user", content: "hi" }],
        temperature: 100,
        stream: false,
      })
    );
    const parsed = JSON.parse(capturedBody!);
    expect(parsed.temperature).toBeLessThanOrEqual(2);
    expect(parsed.temperature).toBeGreaterThanOrEqual(0);
    vi.unstubAllGlobals();
  });
});
