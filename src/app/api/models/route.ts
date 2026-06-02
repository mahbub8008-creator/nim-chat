import OpenAI from "openai"
import { isVisionModel } from "@/lib/constants"

function getClient() {
  return new OpenAI({
    apiKey: process.env.NIM_API_KEY || "",
    baseURL: "https://integrate.api.nvidia.com/v1",
    timeout: 30_000,
    maxRetries: 0,
  })
}

export async function GET() {
  try {
    const client = getClient()
    const response = await client.models.list()
    const models = response.data
      .map((m: { id: string; object: string; created: number; owned_by: string }) => ({
        id: m.id,
        object: m.object,
        created: m.created,
        owned_by: m.owned_by,
        supports_vision: isVisionModel(m.id),
      }))
      .sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id))

    return Response.json(models, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch models"
    return Response.json({ error: message }, { status: 502 })
  }
}
