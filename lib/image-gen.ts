let configuredCache: boolean | null = null;

export async function isImageGenConfigured(): Promise<boolean> {
  if (configuredCache !== null) return configuredCache;
  try {
    const res = await fetch("/api/settings");
    const data = await res.json();
    configuredCache = !!(data.imageUrl && data.imageUrl.trim());
    return configuredCache;
  } catch {
    configuredCache = false;
    return false;
  }
}

export function resetImageConfigCache() {
  configuredCache = null;
}

export async function generateImage(
  prompt: string,
  size?: string
): Promise<string | null> {
  try {
    const res = await fetch("/api/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, size }),
    });
    const data = await res.json();
    if (data.configured === false) {
      configuredCache = false;
      return null;
    }
    return data.url || null;
  } catch {
    return null;
  }
}
