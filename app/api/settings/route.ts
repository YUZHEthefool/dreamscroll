import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const raw = fs.readFileSync(
      path.join(process.cwd(), "settings.json"),
      "utf-8"
    );
    const settings = JSON.parse(raw);
    return new Response(
      JSON.stringify({
        model: settings.model,
        creationModel: settings.creationModel || settings.model,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ model: "", creationModel: "" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
