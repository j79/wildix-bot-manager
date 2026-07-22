import { Hono } from 'hono'
import { stream } from 'hono/streaming'
import { type AuthVariables } from '../middleware/auth.js'
import {
  streamGenerate, generate, testAiConfig, getAiConfig, invalidateAiConfigCache,
  type LLMMessage, type AiProvider, DEFAULT_MODELS,
} from '../services/llm.js'
import { getAdminPb } from '../services/pocketbase.js'
import { AppError } from '../lib/errors.js'
import { env } from '../lib/env.js'

type GeneratePromptInput = {
  pbxId?: string
  botType: 'voicebot' | 'chatbot'
  companyName: string
  industry: string
  useCase: string
  language?: string
  tone?: string
  extraContext?: string
  declaredTools?: string[]
}

type SuggestToolsInput = {
  botDescription: string
  availableTools: Array<{ id: string; name: string; description: string; url: string }>
}

type TtsPreviewInput = {
  provider: 'elevenlabs' | 'google'
  voiceId: string
  locale: string
  text: string
}

const ai = new Hono<{ Variables: AuthVariables }>()

// ── Multi-provider key management ────────────────────────────────────────────
// Active record: provider = real provider name (e.g. "anthropic")
// Key cache:     provider = "key_anthropic", "key_groq", etc.

async function getKeyRecord(pb: any, provider: string): Promise<any | null> {
  try {
    const cacheKey = 'key_' + provider
    const r = await pb.collection('ai_config').getList(1, 50)
    return r.items.find((x: any) => x['provider'] === cacheKey) ?? null
  } catch { return null }
}

async function getAllSavedProviders(pb: any): Promise<Record<string, { hasKey: boolean; model: string; ollama_url: string }>> {
  try {
    const r = await pb.collection('ai_config').getList(1, 50)
    const result: Record<string, { hasKey: boolean; model: string; ollama_url: string }> = {}
    for (const rec of r.items) {
      const p = rec['provider'] as string
      if (!p?.startsWith('key_')) continue
      const provName = p.slice(4)
      result[provName] = {
        hasKey:     !!(rec['api_key'] as string),
        model:      (rec['model']      as string) || '',
        ollama_url: (rec['ollama_url'] as string) || '',
      }
    }
    return result
  } catch { return {} }
}

async function upsertKeyRecord(pb: any, provider: string, apiKey: string, model: string, ollamaUrl: string) {
  if (!apiKey) return
  const cacheKey = 'key_' + provider
  try {
    const r = await pb.collection('ai_config').getList(1, 50)
    const existing = r.items.find((x: any) => x['provider'] === cacheKey)
    const data = { provider: cacheKey, api_key: apiKey, model: model || '', ollama_url: ollamaUrl || '' }
    if (existing) {
      await pb.collection('ai_config').update(existing.id, data)
    } else {
      await pb.collection('ai_config').create(data)
    }
  } catch (e) { console.error('upsertKeyRecord:', e) }
}

async function getActiveRecord(pb: any): Promise<any | null> {
  try {
    const r = await pb.collection('ai_config').getList(1, 50)
    return r.items.find((x: any) => {
      const p = x['provider'] as string
      return p && !p.startsWith('key_')
    }) ?? null
  } catch { return null }
}


// -- POST /ai/generate-prompt -- retourne JSON structure avec sections --------

const TOOL_DESCRIPTIONS: Record<string, string> = {
  Transfer:    'Transfer(FWD_destination) — transfert vers un numéro SIP, un poste ou une file d\'attente. Le paramètre doit TOUJOURS commencer par FWD_. Ex: Transfer(FWD_commercial), Transfer(FWD_support), Transfer(FWD_urgences)',
  Hangup:      'Hangup() — terminer l\'appel. Doit clôturer toute conversation.',
  Wait:        'Wait(secondes) — mise en attente musicale. Utile pendant une recherche ou un traitement.',
  Delegate:    'Delegate(agentId) — déléguer à un autre agent IA Wildix (handoff IA→IA).',
  SendMessage: 'SendMessage(userId|groupId, message) — message texte interne à un utilisateur ou groupe Wildix. Permet d\'alerter un collègue sans interrompre l\'appel.',
  SendSMS:     'SendSMS(numero, message) — SMS vers un numéro externe.',
  SendEmail:   'SendEmail(to, sujet, corps) — email sortant avec les informations collectées durant l\'appel.',
  WebSearch:   'WebSearch(query, [url|domaine]) — recherche web. Paramètre 2 optionnel : URL exacte ou domaine (ex: "entreprise.com"). Retourne le texte trouvé.',
  Webhooks:    'Webhooks(url, payload) — appel API REST externe avec payload JSON. Retourne la réponse du serveur. Idéal pour CRM, ERP, agenda, réservation.',
  MCP:         'MCP(outil, params) — intégrations avancées : Make, Notion, Google Calendar, CRM, etc.',
}

const EMBEDDED_TOOLS = ['Transfer', 'Hangup', 'Wait', 'Delegate']

ai.post('/generate-prompt', async (c) => {
  const body = await c.req.json<GeneratePromptInput>()

  if (!body.industry || !body.useCase) {
    throw new AppError(400, 'industry et useCase sont requis')
  }

  const lang = body.language ?? 'Français'
  const tone = body.tone ?? 'Professionnel et courtois'

  // Build tool list — only explicitly declared tools + always Hangup
  const declared = body.declaredTools ?? []
  const allTools = Array.from(new Set(['Hangup', ...declared]))
  const toolsBlock = allTools
    .map(t => `• ${TOOL_DESCRIPTIONS[t] ?? t}`)
    .join('\n')

  const isVoice = body.botType === 'voicebot'

  const messages: LLMMessage[] = [
    {
      role: 'system',
      content:
        `Tu es un expert en configuration de VoiceBots Wildix WILMA (IA vocale pour téléphonie professionnelle).\n` +
        `Tu as analysé des dizaines de prompts de production et tu sais ce qui fonctionne réellement.\n\n` +

        `━━━ OUTILS WILDIX WILMA ━━━\n\n` +
        `EMBARQUÉS (toujours disponibles) :\n` +
        `• Transfer(destination) — transfère l'appel vers un poste SIP, un numéro ou une file d'attente\n` +
        `• Hangup() — raccrocher proprement\n` +
        `• Wait(secondes) — mise en musique pendant un traitement\n` +
        `• Delegate(agentId) — déléguer à un autre agent IA Wildix\n\n` +
        `OPTIONNELS (si configurés) :\n` +
        `• SendMessage(userId|groupId, message) — message texte interne Wildix\n` +
        `• SendSMS(numero, message) — SMS vers un numéro externe\n` +
        `• SendEmail(to, sujet, corps) — email sortant\n` +
        `• WebSearch(query, [url|domaine]) — recherche web\n` +
        `• Webhooks(url, payload) — appel API REST externe (CRM, ERP, agenda...)\n` +
        `• MCP(outil, params) — intégrations avancées\n\n` +

        `━━━ PRINCIPES ABSOLUS ━━━\n\n` +
        `1. Le bot AGIT avec ses outils — il ne dit JAMAIS "contactez X" ou "rappelez Y" si un outil peut le faire.\n` +
        `2. Les appels d'outils sont SILENCIEUX : le bot n'annonce pas ce qu'il va faire, il le fait.\n` +
        `3. Une seule question à la fois, sans exception.\n` +
        `4. Chaque conversation se termine TOUJOURS par Transfer() ou Hangup() — jamais de fin suspendue.\n` +
        `5. Phrases courtes${isVoice ? ' — à l\'oral, 2 phrases max par tour de parole' : ''}.\n` +
        `6. Ne jamais inventer d'information non fournie dans le prompt.\n\n` +

        `Réponds UNIQUEMENT avec le contenu demandé, sans introduction ni commentaire.\n` +
        `Langue du prompt généré : ${lang}.`,
    },
    {
      role: 'user',
      content:
        `Génère un prompt système pour ce ${isVoice ? 'VoiceBot' : 'ChatBot'} :

` +
        `ENTREPRISE : ${body.companyName || '(non spécifiée)'}
` +
        `SECTEUR : ${body.industry}
` +
        `CAS D'USAGE : ${body.useCase}
` +
        `TON : ${tone}
` +
        (body.extraContext ? `CONTEXTE SUPPLÉMENTAIRE : ${body.extraContext}
` : '') +
        `TYPE : ${isVoice ? 'VoiceBot vocal — phrases courtes et naturelles, jamais de listes à puces' : 'ChatBot textuel — structuré, peut utiliser des listes'}

` +
        `OUTILS DÉCLARÉS :
${toolsBlock}

` +

        `Génère EXACTEMENT ces 8 sections dans cet ordre, chaque titre précédé de #### sur sa propre ligne :

` +

        `#### IDENTITÉ & MISSION
` +
        `Prénom du bot (naturel, cohérent avec le secteur), nom de l'entreprise, mission principale en 1 phrase.
` +
        `Puis en bullet points : CE QUE LE BOT PEUT FAIRE (actions concrètes via les outils déclarés), CE QU'IL NE PEUT PAS FAIRE (ce qu'il escalade).
` +
        `Puis ORDRE DE PRIORITÉ numéroté : 1. Urgence/sécurité → Transfer immédiat. 2. Demande explicite d'un humain → Transfer. 3. Cas d'usage principal. 4. FAQ/informations. 5. Prise de message.

` +

        `#### COMPORTEMENT & RÈGLES
` +
        `Personnalité et ton en 2-3 phrases.
` +
        `Puis RÈGLES ABSOLUES :
` +
        `- Une seule question à la fois, jamais deux dans le même message
` +
        `- ${isVoice ? 'Maximum 2 phrases par tour de parole' : 'Réponses structurées et concises'}
` +
        `- Appels d'outils silencieux : ne jamais annoncer "je vais transférer" ou "je vais envoyer"
` +
        `- Reformuler brièvement ce qui a été compris avant d'agir
` +
        `- Confirmer les numéros de téléphone par groupes de 2 chiffres, puis demander validation
` +
        `Puis INTERDICTIONS EXPLICITES (minimum 6) : ne jamais poser 2 questions, ne jamais inventer, ne jamais annoncer un outil, ne jamais raccrocher sans clôture, ne jamais Hangup() après Transfer(), ne jamais Wait() sans besoin explicite. Ajouter 2-3 interdictions sectorielles spécifiques.

` +

        `#### INFORMATIONS MÉTIER
` +
        `Données factuelles : horaires, contacts, produits/services, procédures sectorielles. Préciser explicitement la règle sur les informations inconnues (ne pas inventer, orienter vers un humain).

` +

        `#### OUTILS & ACTIONS AUTOMATIQUES
` +
        `Section CRITIQUE. Sélectionner UNIQUEMENT les outils des OUTILS DÉCLARÉS réellement nécessaires pour CE cas d'usage.
` +
        `- Hangup() : TOUJOURS inclure.
` +
        `- Transfer() : seulement si transferts mentionnés. Format FWD_nom obligatoire. Destinations logiques selon contexte. Nombre exact de règles demandées.
` +
        `- Wait() : seulement si attente bloquante explicitement nécessaire.
` +
        `- SendMessage/SendSMS/SendEmail : seulement si notification explicitement mentionnée. Format exact avec {champs} nommés.
` +
        `- Autres outils : seulement si explicitement mentionnés dans le contexte.
` +
        `RAPPEL ABSOLU : Transfer() et Hangup() mutuellement exclusifs. Pour chaque outil : condition déclenchante précise + paramètres concrets.

` +

        `#### SCÉNARIOS & DÉROULÉ
` +
        `Séquence numérotée avec branches SI/SINON explicites. Inclure :
` +
        `- Ordre des questions si collecte de données
` +
        `- Maximum 2-3 tentatives de compréhension avant escalade
` +
        `- Conditions d'escalade (incompréhension répétée, urgence, hors périmètre)
` +
        `- GESTION DES INCOMPRÉHENSIONS : formulation exacte des demandes de répétition, nombre de tentatives (2 max), phrase-type, déclencheur d'escalade sur incompréhension répétée
` +
        `- RAPPEL : après Transfer(), ne pas mettre Hangup()

` +

        `#### EXEMPLES DE DIALOGUES
` +
        `2 à 3 courts échanges illustrant le ton et la longueur des réponses. Couvrir : (1) accueil + qualification initiale, (2) gestion d'une incompréhension, (3) si pertinent : clôture avec outil.
` +
        `Format strict — Appelant : ... / Bot : ...

` +

        `#### MESSAGE D'ACCUEIL
` +
        `Phrase prononcée au décrochage, 20 à 30 mots. Prénom du bot + nom de l'entreprise. ` +
        `${isVoice ? 'Naturelle et chaleureuse.' : 'Accueillante et claire.'}

` +

        `#### RAPPORT
` +
        `Analyse de conception (non intégrée dans le prompt). En 150 à 200 mots : choix retenus, outils utilisés et scénarios, points d'attention, informations manquantes.`,
    },
  ]

  const raw = await generate(messages)

  const SECTION_KEYS = ['identite', 'comportement', 'informations', 'outils', 'scenarios', 'exemples', 'accueil', 'rapport']
  const parts = raw.split(/^####\s+/m).filter(Boolean)
  const allParsed = parts.map((part, i) => {
    const lines = part.trim().split('\n')
    const title = lines[0].trim()
    const content = lines.slice(1).join('\n').trim()
    return { key: SECTION_KEYS[i] ?? `section_${i}`, title, content }
  })

  if (allParsed.length === 0) {
    return c.json({ sections: [{ key: 'full', title: 'PROMPT', content: raw.trim() }], welcomeMessage: '', rapport: '' })
  }

  const welcomePart = allParsed.find(s => s.key === 'accueil')
  const rapportPart = allParsed.find(s => s.key === 'rapport')
  const sections = allParsed.filter(s => s.key !== 'accueil' && s.key !== 'rapport')

  return c.json({
    sections,
    welcomeMessage: welcomePart?.content ?? '',
    rapport: rapportPart?.content ?? '',
  })
})

// -- POST /ai/refine-section -- affine le contenu d'une section de prompt ------

type RefineSectionInput = {
  sectionTitle: string
  sectionContent: string
  userRequest: string
  language?: string
}

ai.post('/refine-section', async (c) => {
  const body = await c.req.json<RefineSectionInput>()
  if (!body.sectionTitle || !body.userRequest?.trim()) {
    throw new AppError(400, 'sectionTitle et userRequest sont requis')
  }

  const lang = body.language ?? 'Français'

  const messages: LLMMessage[] = [
    {
      role: 'system',
      content:
        `Tu es un expert en configuration de VoiceBots Wildix WILMA. ` +
        `L'utilisateur veut modifier le contenu d'une section spécifique d'un prompt système. ` +
        `Respecte le style et le format du contenu existant. ` +
        `Réponds UNIQUEMENT avec le nouveau contenu de la section, sans titre, sans introduction, sans commentaire. ` +
        `Langue : ${lang}.`,
    },
    {
      role: 'user',
      content:
        `Section : ${body.sectionTitle}\n\n` +
        `Contenu actuel :\n${body.sectionContent || '(vide)'}\n\n` +
        `Modification demandée : ${body.userRequest.trim()}`,
    },
  ]

  const content = await generate(messages)
  return c.json({ content: content.trim() })
})

// -- POST /ai/translate-sections -- traduit les sections d'un template (utilisé par scripts CLI) --

ai.post('/translate-sections', async (c) => {
  const body = await c.req.json<{ sections: Array<{ key: string; title: string; content: string }>; targetLanguage: string }>()
  if (!body.sections?.length || !body.targetLanguage?.trim()) {
    throw new AppError(400, 'sections et targetLanguage sont requis')
  }
  const sectionsBlock = body.sections.map((s, i) => `[${i + 1}] ${s.title}\n${s.content}`).join('\n\n---\n\n')
  const messages: LLMMessage[] = [
    {
      role: 'system',
      content:
        `You are a specialized translator for Wildix VoiceBot system prompts.\n` +
        `Translate the provided content to ${body.targetLanguage}.\n\n` +
        `STRICT rules:\n` +
        `- Keep ALL placeholders: [PRENOM], [ENTREPRISE], [COMPLETER...]\n` +
        `- Keep ALL variables: {NOM}, {TEL}, {DATE}, {MOTIF}, etc.\n` +
        `- Keep ALL tool names: Transfer(), Hangup(), SendMessage(), Wait(), FWD_xxx\n` +
        `- Keep line breaks and list structure\n` +
        `- Maintain a professional VoiceBot tone\n\n` +
        `Return EXACTLY ${body.sections.length} sections using this format:\n` +
        `[1]\ntranslated content\n\n[2]\ntranslated content\n\netc.\nNo other text.`,
    },
    { role: 'user', content: `Translate to ${body.targetLanguage}:\n\n${sectionsBlock}` },
  ]
  const raw = await generate(messages)
  const parts = raw.split(/\[(\d+)\]\s*\n/).filter(p => p.trim())
  const translated = body.sections.map((s, i) => {
    const idx2 = parts.findIndex(p => p === String(i + 1))
    const content = idx2 !== -1 && parts[idx2 + 1] ? parts[idx2 + 1].trim() : s.content
    return { ...s, content }
  })
  return c.json({ sections: translated })
})

// -- POST /ai/translate-metadata -- traduit nom, secteur, cas d'usage, titres (utilisé par scripts CLI) --

ai.post('/translate-metadata', async (c) => {
  const body = await c.req.json<{ items: string[]; targetLanguage: string }>()
  if (!body.items?.length || !body.targetLanguage?.trim()) {
    throw new AppError(400, 'items et targetLanguage requis')
  }
  const messages: LLMMessage[] = [
    {
      role: 'system',
      content:
        `Translate the following short texts to ${body.targetLanguage}.\n` +
        `Return ONLY the translations, one per line, same order. No numbering, no explanation.`,
    },
    { role: 'user', content: body.items.join('\n') },
  ]
  const raw = await generate(messages)
  const lines = raw.trim().split('\n').map(l => l.trim().replace(/^\d+\.\s*/, '')).filter(Boolean)
  return c.json({ translations: body.items.map((original, i) => lines[i] ?? original) })
})

// -- POST /ai/translate-template — traduit un template vers toutes les langues (JSON, séquentiel) --

type TranslateTemplateInput = {
  sections: Array<{ key: string; title: string; content: string }>
  name: string
  sector: string
  useCase: string
}

ai.post('/translate-template', async (c) => {
  const body = await c.req.json<TranslateTemplateInput>()
  if (!body.sections?.length || !body.name?.trim()) {
    throw new AppError(400, 'sections et name sont requis')
  }

  const TARGETS = [
    { code: 'en', lang: 'English' },
    { code: 'it', lang: 'Italiano' },
    { code: 'es', lang: 'Español' },
    { code: 'de', lang: 'Deutsch' },
  ]

  const inputPayload = {
    name:    body.name,
    sector:  body.sector ?? '',
    useCase: body.useCase ?? '',
    sections: body.sections.map(s => ({ title: s.title, content: s.content })),
  }

  // Sequential — une langue à la fois pour ne pas saturer Ollama CPU
  const translations: Record<string, { sections: TranslateTemplateInput['sections']; name: string; sector: string; useCase: string }> = {}

  for (const { code, lang } of TARGETS) {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content:
          `You are a specialized translator for Wildix VoiceBot system prompts.\n` +
          `Translate ALL values in the provided JSON to ${lang}.\n\n` +
          `STRICT rules:\n` +
          `- Keep ALL placeholders exactly as-is: [PRENOM], [ENTREPRISE], [COMPLETER...]\n` +
          `- Keep ALL variables exactly: {NOM}, {TEL}, {VEHICULE}, {DATE}, {MOTIF}, etc.\n` +
          `- Keep ALL tool names exactly: Transfer(), Hangup(), SendMessage(), Wait(), FWD_xxx\n` +
          `- Keep line breaks and list structure in section content\n` +
          `- Maintain a professional VoiceBot tone\n\n` +
          `Return ONLY valid JSON with the EXACT same structure as the input. No markdown, no code blocks, no explanation.`,
      },
      {
        role: 'user',
        content: `Translate to ${lang}:\n\n${JSON.stringify(inputPayload)}`,
      },
    ]

    try {
      const raw = await generate(messages)
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        translations[code] = { sections: body.sections, name: body.name, sector: body.sector ?? '', useCase: body.useCase ?? '' }
        continue
      }
      const parsed = JSON.parse(jsonMatch[0]) as {
        name?: string
        sector?: string
        useCase?: string
        sections?: Array<{ title?: string; content?: string }>
      }
      translations[code] = {
        sections: body.sections.map((s, i) => ({
          ...s,
          title:   parsed.sections?.[i]?.title   ?? s.title,
          content: parsed.sections?.[i]?.content ?? s.content,
        })),
        name:    (parsed.name    && parsed.name.trim())    ? parsed.name.trim()    : body.name,
        sector:  (parsed.sector  && parsed.sector.trim())  ? parsed.sector.trim()  : (body.sector ?? ''),
        useCase: (parsed.useCase && parsed.useCase.trim()) ? parsed.useCase.trim() : (body.useCase ?? ''),
      }
    } catch {
      translations[code] = { sections: body.sections, name: body.name, sector: body.sector ?? '', useCase: body.useCase ?? '' }
    }
  }

  return c.json({ translations })
})

// -- POST /ai/suggest-embedded-tools -- config outils embarqués depuis prompt --

type SuggestEmbeddedToolsInput = {
  systemPrompt: string
}

ai.post('/suggest-embedded-tools', async (c) => {
  const body = await c.req.json<SuggestEmbeddedToolsInput>()
  if (!body.systemPrompt?.trim()) throw new AppError(400, 'systemPrompt requis')

  const messages: LLMMessage[] = [
    {
      role: 'system',
      content:
        `Tu es un expert en configuration de VoiceBots Wildix WILMA.\n` +
        `Tu analyses un prompt système et génères la configuration JSON des outils embarqués.\n\n` +
        `OUTILS EMBARQUÉS WILDIX :\n` +
        `• TRANSFER(extension, context, description) — transfère l'appel. Peut avoir plusieurs règles (une par destination).\n` +
        `• HANGUP(context, description) — raccroche. Une seule règle.\n` +
        `• WAIT(context, description) — met en attente musicale. Utile si le bot fait des appels API ou recherches.\n\n` +
        `Le champ "context" contient les INSTRUCTIONS pour le LLM : conditions précises pour déclencher l'outil.\n\n` +
        `Réponds UNIQUEMENT avec un objet JSON valide. Aucun markdown. Aucun texte avant ou après.`,
    },
    {
      role: 'user',
      content:
        `Analyse ce prompt système et génère la configuration des outils embarqués :\n\n` +
        `---\n${body.systemPrompt.trim().slice(0, 4000)}\n---\n\n` +
        `Réponds avec ce JSON (UNIQUEMENT ce JSON) :\n` +
        `{\n` +
        `  "transfer": [\n` +
        `    {\n` +
        `      "name": "Nom court (ex: Commercial, Support, Urgences)",\n` +
        `      "description": "Une phrase",\n` +
        `      "context": "Instructions LLM précises : quand déclencher (intention de l'appelant, mots-clés, situations)"\n` +
        `    }\n` +
        `  ],\n` +
        `  "hangup": {\n` +
        `    "description": "Fin d'appel",\n` +
        `    "context": "Liste exhaustive des cas autorisés : demande résolue, au revoir explicite, après transfert réussi, N refus consécutifs. Et interdictions : ne pas raccrocher si demande non résolue."\n` +
        `  },\n` +
        `  "wait": null\n` +
        `}\n\n` +
        `Règles :\n` +
        `- "transfer" : 1 à 5 règles selon les destinations réelles du prompt\n` +
        `- "wait" : null SAUF si le prompt mentionne recherches web, appels API/webhook, ou traitements longs\n` +
        `- Les "context" sont des instructions opérationnelles pour le LLM, pas de la documentation`,
    },
  ]

  const raw = await generate(messages)

  const fallback = {
    transfer: [{
      name: 'Transfert',
      description: 'Transfert d\'appel',
      context: 'Appeler quand l\'appelant demande à être mis en relation avec une personne ou un service.',
    }],
    hangup: {
      description: 'Fin d\'appel',
      context: 'Raccrocher après résolution complète de la demande, quand l\'appelant dit au revoir, ou après un transfert réussi.',
    },
    wait: null as { description: string; context: string } | null,
  }

  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0]) as typeof fallback
      if (Array.isArray(parsed.transfer) && parsed.hangup) return c.json(parsed)
    }
  } catch { /* use fallback */ }

  return c.json(fallback)
})

// -- POST /ai/suggest-tools -- selection d'outils pertinents ------------------

ai.post('/suggest-tools', async (c) => {
  const body = await c.req.json<SuggestToolsInput>()

  if (!body.botDescription || !body.availableTools?.length) {
    throw new AppError(400, 'botDescription et availableTools sont requis')
  }

  const toolList = body.availableTools
    .map((t) => `- ${t.name} (${t.url}) : ${t.description}`)
    .join('\n')

  const messages: LLMMessage[] = [
    {
      role: 'system',
      content:
        'Tu es un assistant qui selectionne les outils externes pertinents pour un bot. ' +
        'Reponds UNIQUEMENT avec un tableau JSON contenant les id des outils selectionnes. ' +
        'Exemple : ["id1", "id2"]',
    },
    {
      role: 'user',
      content:
        `Bot a configurer :\n${body.botDescription}\n\n` +
        `Outils disponibles :\n${toolList}\n\n` +
        `Quels outils ce bot devrait-il utiliser ? Reponds avec un tableau JSON des id selectionnes.`,
    },
  ]

  const raw = await generate(messages)

  let ids: string[] = []
  try {
    const match = raw.match(/\[[\s\S]*\]/)
    if (match) ids = JSON.parse(match[0]) as string[]
  } catch { /* keep empty */ }

  const suggested = body.availableTools.filter((t) => ids.includes(t.id))
  return c.json({ suggested, rawResponse: raw })
})

// -- POST /ai/tts-preview -- proxy TTS pour previsualisation voix -------------

ai.post('/tts-preview', async (c) => {
  const body = await c.req.json<TtsPreviewInput>()

  if (!body.provider || !body.voiceId || !body.text?.trim()) {
    throw new AppError(400, 'provider, voiceId et text sont requis')
  }

  const text = body.text.trim().slice(0, 500)

  if (body.provider === 'elevenlabs') {
    if (!env.ELEVENLABS_API_KEY) throw new AppError(503, 'ElevenLabs API key non configuree')
    const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${body.voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    })
    if (!resp.ok) throw new AppError(502, `ElevenLabs error: ${resp.status}`)
    const buf = await resp.arrayBuffer()
    const audioBase64 = Buffer.from(buf).toString('base64')
    return c.json({ audioBase64, contentType: 'audio/mpeg' })
  }

  if (body.provider === 'google') {
    if (!env.GOOGLE_TTS_API_KEY) throw new AppError(503, 'Google TTS API key non configuree')
    const voiceName = `${body.locale}-Chirp3-HD-${body.voiceId}`
    const resp = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${env.GOOGLE_TTS_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: body.locale, name: voiceName },
          audioConfig: { audioEncoding: 'MP3' },
        }),
      },
    )
    if (!resp.ok) {
      const errText = await resp.text()
      throw new AppError(502, `Google TTS error ${resp.status}: ${errText.slice(0, 200)}`)
    }
    const data = await resp.json() as { audioContent: string }
    return c.json({ audioBase64: data.audioContent, contentType: 'audio/mpeg' })
  }

  throw new AppError(400, 'Provider invalide (elevenlabs ou google)')
})

// -- POST /ai/chat -- conversation libre avec le LLM --------------------------

type ChatInput = {
  messages: LLMMessage[]
  systemPrompt?: string
}

ai.post('/chat', async (c) => {
  const body = await c.req.json<ChatInput>()

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    throw new AppError(400, 'messages est requis')
  }

  const messages: LLMMessage[] = [
    {
      role: 'system',
      content: body.systemPrompt?.trim() ||
        'Tu es un assistant IA utile et concis. Reponds en francais sauf si on te parle dans une autre langue.',
    },
    ...body.messages,
  ]

  return stream(c, async (s) => {
    c.header('Content-Type', 'text/event-stream')
    c.header('Cache-Control', 'no-cache')
    c.header('Connection', 'keep-alive')

    try {
      await streamGenerate(messages, async (chunk) => {
        await s.write(`data: ${JSON.stringify({ chunk })}\n\n`)
      })
      await s.write('data: [DONE]\n\n')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur LLM'
      await s.write(`data: ${JSON.stringify({ error: msg })}\n\n`)
    }
  })
})

// -- GET /ai/config -- config par utilisateur avec fallback global --------------

ai.get('/config', async (c) => {
  const user = c.get('user')
  const pb = await getAdminPb()

  // 1. Config personnelle de l'utilisateur
  const userRecords = await pb.collection('user_ai_config').getFullList({
    filter: `user = "${user.id}"`,
  }).catch(() => [] as any[])

  const userActive = userRecords.find((r: any) => !String(r['provider'] ?? '').startsWith('key_'))

  if (userActive) {
    const userSaved: Record<string, { hasKey: boolean; model: string; ollama_url: string }> = {}
    for (const rec of userRecords) {
      const p = String(rec['provider'] ?? '')
      if (!p.startsWith('key_')) continue
      userSaved[p.slice(4)] = {
        hasKey:     !!(rec['api_key'] as string),
        model:      (rec['model'] as string) || '',
        ollama_url: (rec['ollama_url'] as string) || '',
      }
    }
    return c.json({
      provider:       userActive['provider'],
      model:          userActive['model'] || DEFAULT_MODELS[userActive['provider'] as keyof typeof DEFAULT_MODELS],
      hasKey:         userActive['provider'] === 'ollama' || !!userActive['api_key'],
      ollama_url:     userActive['ollama_url'],
      savedProviders: userSaved,
    })
  }

  // 2. Fallback config globale
  const cfg = await getAiConfig()
  if (cfg.provider !== 'ollama' && cfg.api_key) {
    await upsertKeyRecord(pb, cfg.provider, cfg.api_key, cfg.model, cfg.ollama_url)
  }
  const savedProviders = await getAllSavedProviders(pb)
  return c.json({
    provider:      cfg.provider,
    model:         cfg.model || DEFAULT_MODELS[cfg.provider],
    hasKey:        cfg.provider === 'ollama' || !!cfg.api_key,
    ollama_url:    cfg.ollama_url,
    savedProviders,
  })
})

// -- PUT /ai/config -- mise à jour de la config --------------------------------

type AiConfigInput = {
  provider: AiProvider
  api_key?: string
  model?: string
  ollama_url?: string
}

ai.put('/config', async (c) => {
  const user = c.get('user')
  const body = await c.req.json<AiConfigInput>()
  const VALID: AiProvider[] = ['ollama', 'openai', 'gemini', 'anthropic', 'groq']
  if (!VALID.includes(body.provider)) throw new AppError(400, 'Provider invalide')

  const pb = await getAdminPb()

  // Enregistrements utilisateur existants
  const userRecords = await pb.collection('user_ai_config').getFullList({
    filter: `user = "${user.id}"`,
  }).catch(() => [] as any[])

  // Clé effective : fournie OU depuis le cache key_ de l'utilisateur
  let effectiveKey = body.api_key?.trim() ?? ''
  if (!effectiveKey && body.provider !== 'ollama') {
    const cacheKey = 'key_' + body.provider
    const cached = userRecords.find((r: any) => r['provider'] === cacheKey)
    effectiveKey = (cached?.['api_key'] as string) || ''
  }
  if (!effectiveKey && body.provider !== 'ollama') {
    throw new AppError(400, 'api_key requis pour ce provider (aucune clé enregistrée)')
  }

  const effectiveModel     = body.model?.trim() || ''
  const effectiveOllamaUrl = body.ollama_url?.trim() || env.OLLAMA_URL

  // Sauvegarder dans le cache key_ de l'utilisateur
  if (body.provider !== 'ollama') {
    const cacheKey = 'key_' + body.provider
    const cached = userRecords.find((r: any) => r['provider'] === cacheKey)
    const keyData = { user: user.id, provider: cacheKey, api_key: effectiveKey, model: effectiveModel, ollama_url: effectiveOllamaUrl }
    if (cached) await pb.collection('user_ai_config').update(cached.id, keyData)
    else await pb.collection('user_ai_config').create(keyData)
  }

  // Mettre à jour l'enregistrement actif de l'utilisateur
  const activeRec = userRecords.find((r: any) => !String(r['provider'] ?? '').startsWith('key_'))
  const data = {
    user:       user.id,
    provider:   body.provider,
    api_key:    body.provider === 'ollama' ? '' : effectiveKey,
    model:      effectiveModel,
    ollama_url: effectiveOllamaUrl,
  }
  if (activeRec) {
    await pb.collection('user_ai_config').update(activeRec.id, data)
  } else {
    await pb.collection('user_ai_config').create(data)
  }

  // Si admin, mettre aussi à jour la config globale (fallback pour nouveaux utilisateurs)
  if (user.role === 'admin') {
    const activeGlobal = await getActiveRecord(pb)
    const globalData = {
      provider:   body.provider,
      api_key:    body.provider === 'ollama' ? '' : effectiveKey,
      model:      effectiveModel,
      ollama_url: effectiveOllamaUrl,
    }
    if (activeGlobal) await pb.collection('ai_config').update(activeGlobal.id, globalData)
    else await pb.collection('ai_config').create(globalData)
    invalidateAiConfigCache()
  }

  return c.json({ ok: true })
})

// -- POST /ai/config/test -- test sans sauvegarder ----------------------------

ai.post('/config/test', async (c) => {
  const body = await c.req.json<AiConfigInput>()

  let apiKey = body.api_key?.trim() ?? ''
  if (!apiKey && body.provider !== 'ollama') {
    const pb2 = await getAdminPb()
    const rec = await getKeyRecord(pb2, body.provider)
    apiKey = (rec?.['api_key'] as string) || ''
    if (!apiKey) {
      const stored = await getAiConfig()
      if (stored.provider === body.provider) apiKey = stored.api_key
    }
  }

  const result = await testAiConfig({
    provider:   body.provider ?? 'ollama',
    api_key:    apiKey,
    model:      body.model ?? '',
    ollama_url: body.ollama_url || env.OLLAMA_URL,
  })
  return c.json(result)
})

export { ai as aiRoutes }
