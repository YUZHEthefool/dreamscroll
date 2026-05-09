import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("fs", () => ({
  default: {
    readFileSync: vi.fn(() =>
      JSON.stringify({
        imageUrl: "https://api.example.com",
        imageApiKey: "sk-test-image-key-123456",
        imageModel: "dall-e-3",
        imageApiType: "openai",
      })
    ),
  },
}));

let POST: (req: Request) => Promise<Response>;

beforeEach(async () => {
  vi.resetModules();
  const mod = await import("../app/api/image/route");
  POST = mod.POST as unknown as (req: Request) => Promise<Response>;
});

function makeRequest(body: unknown) {
  return new Request("http://localhost:3000/api/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/image — security", () => {
  it("rejects invalid JSON body", async () => {
    const req = new Request("http://localhost:3000/api/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "bad",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("JSON");
  });

  it("rejects missing prompt", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("prompt");
  });

  it("rejects empty string prompt", async () => {
    const res = await POST(makeRequest({ prompt: "   " }));
    expect(res.status).toBe(400);
  });

  it("rejects non-string prompt", async () => {
    const res = await POST(makeRequest({ prompt: 12345 }));
    expect(res.status).toBe(400);
  });

  it("rejects prompt exceeding max length", async () => {
    const res = await POST(makeRequest({ prompt: "a".repeat(4001) }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("4000");
  });

  it("accepts valid prompt", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ data: [{ b64_json: "abc123==" }] }),
            { headers: { "Content-Type": "application/json" } }
          )
        )
      )
    );
    const res = await POST(makeRequest({ prompt: "a red circle" }));
    expect(res.status).toBe(200);
    vi.unstubAllGlobals();
  });

  it("does not leak upstream error details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                message: "Your API key sk-test-image-key-123456 is invalid",
              },
            }),
            { status: 401 }
          )
        )
      )
    );
    const res = await POST(makeRequest({ prompt: "test" }));
    const data = await res.json();
    expect(data.error).not.toContain("sk-test-image-key-123456");
    vi.unstubAllGlobals();
  });
});
