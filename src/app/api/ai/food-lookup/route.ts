import { NextResponse } from 'next/server'
import { anthropic, AI_MODEL } from '@/src/lib/ai/client'

export async function POST(req: Request) {
  try {
    const { query } = await req.json()
    if (!query?.trim()) return NextResponse.json({ error: 'Query is required' }, { status: 400 })

    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `You are a nutrition database. Return macros for this food as JSON only — no markdown, no explanation.

Food: "${query}"

Return exactly this JSON structure:
{
  "name": "descriptive food name with portion",
  "servingSize": "portion with unit (e.g. 150g, 1 cup, 2 slices)",
  "calories": <integer>,
  "proteinG": <number to 1 decimal place>,
  "carbsG": <number to 1 decimal place>,
  "fatG": <number to 1 decimal place>
}

Use standard nutrition data. Reasonable estimates are fine.`,
      }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const result = JSON.parse(cleaned)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
