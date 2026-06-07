import { z } from 'zod'

const schema = z.object({
  PORT:                      z.string().default('3000'),
  POCKETBASE_URL:            z.string().url(),
  POCKETBASE_ADMIN_EMAIL:    z.string().email(),
  POCKETBASE_ADMIN_PASSWORD: z.string().min(1),

  LLM_PROVIDER: z.enum(['ollama', 'openai', 'groq']).default('ollama'),
  OLLAMA_URL:   z.string().url().default('http://ollama:11434'),
  OLLAMA_MODEL: z.string().default('qwen2.5:3b'),
  OPENAI_API_KEY: z.string().optional(),
  GROQ_API_KEY:   z.string().optional(),

  GOOGLE_TTS_API_KEY:  z.string().optional(),
  ELEVENLABS_API_KEY:  z.string().optional(),

  ALLOWED_ORIGINS: z.string().default('http://192.168.1.76:8180'),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error('Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
