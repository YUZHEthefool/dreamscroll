import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFs = {
  readFileSync: vi.fn(() =>
    JSON.stringify({
      url: "https://api.example.com",
      apiKey: "sk-realkey1234567890abcd",
      model: "gpt-4o",
      imageApiKey: "sk-imagekey1234567890ab",
    })
  ),
  accessSync: vi.fn(),
  writeFileSync: vi.fn(),
};

vi.mock("fs", () => ({ default: mockFs }));

let GET: () => Promise<Response>;
let POST: (req: Request) => Promise<Response>;

beforeEach(async () => {
  vi.resetModules();
  mockFs.readFileSync.mockReturnValue(
    JSON.stringify({
      url: "https://api.example.com",
      apiKey: "sk-realkey1234567890abcd",
      model: "gpt-4o",
      imageApiKey: "sk-imagekey1234567890ab",
    })
  );
  mockFs.writeFileSync.mockClear();
  const mod = await import("../app/api/settings/route");
  GET = mod.GET;
  POST = mod.POST as unknown as (req: Request) => Promise<Response>;
});

function makeRequest(body: unknown) {
  return new Request("http://localhost:3000/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/settings — key masking", () => {
  it("masks API key to first4 + **** + last4", async () => {
    const res = await GET();
    const data = await res.json();
    expect(data.apiKey).toBe("sk-r****abcd");
    expect(data.apiKey).not.toContain("realkey");
  });

  it("masks image API key", async () => {
    const res = await GET();
    const data = await res.json();
    expect(data.imageApiKey).toBe("sk-i****90ab");
  });

  it("fully masks short keys", async () => {
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({ apiKey: "short", model: "gpt-4o" })
    );
    vi.resetModules();
    const mod = await import("../app/api/settings/route");
    const res = await mod.GET();
    const data = await res.json();
    expect(data.apiKey).toBe("****");
  });

  it("returns empty string for missing keys", async () => {
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({ model: "gpt-4o" })
    );
    vi.resetModules();
    const mod = await import("../app/api/settings/route");
    const res = await mod.GET();
    const data = await res.json();
    expect(data.apiKey).toBe("");
  });
});

describe("POST /api/settings — input validation", () => {
  it("rejects invalid JSON body", async () => {
    const req = new Request("http://localhost:3000/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "bad json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("JSON");
  });

  it("rejects non-http URL", async () => {
    const res = await POST(makeRequest({ url: "ftp://evil.com" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("http");
  });

  it("rejects javascript: URL", async () => {
    const res = await POST(makeRequest({ url: "javascript:alert(1)" }));
    expect(res.status).toBe(400);
  });

  it("rejects invalid image URL", async () => {
    const res = await POST(makeRequest({ imageUrl: "file:///etc/passwd" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("图像 API URL");
  });

  it("accepts valid https URL", async () => {
    const res = await POST(
      makeRequest({ url: "https://api.openai.com", model: "gpt-4o" })
    );
    expect(res.status).toBe(200);
  });

  it("accepts empty URL (uses existing)", async () => {
    const res = await POST(makeRequest({ model: "gpt-4o" }));
    expect(res.status).toBe(200);
  });

  it("does not overwrite key with masked value (regex pattern)", async () => {
    await POST(makeRequest({ apiKey: "sk-r****abcd" }));
    const written = JSON.parse(mockFs.writeFileSync.mock.calls[0][1]);
    expect(written.apiKey).toBe("sk-realkey1234567890abcd");
  });

  it("does not overwrite key with full mask", async () => {
    await POST(makeRequest({ apiKey: "****" }));
    const written = JSON.parse(mockFs.writeFileSync.mock.calls[0][1]);
    expect(written.apiKey).toBe("sk-realkey1234567890abcd");
  });

  it("updates key when a new, non-masked value is provided", async () => {
    await POST(makeRequest({ apiKey: "sk-brand-new-key-here!!" }));
    const written = JSON.parse(mockFs.writeFileSync.mock.calls[0][1]);
    expect(written.apiKey).toBe("sk-brand-new-key-here!!");
  });

  it("response masks the newly saved key", async () => {
    const res = await POST(makeRequest({ apiKey: "sk-brand-new-key-here!!" }));
    const data = await res.json();
    expect(data.apiKey).not.toContain("brand-new");
    expect(data.apiKey).toMatch(/^\S{4}\*{4}\S{4}$/);
  });
});
