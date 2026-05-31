import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get Authorization header
    // Supabase edge function clients sometimes send it as Authorization: Bearer <jwt>
    // or as Authorization: <jwt>. We accept either and also accept x-authorization.
    const authHeader = req.headers.get('Authorization') || req.headers.get('x-authorization')

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header missing' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Ensure the header is in Bearer format for the Supabase client
    const token = authHeader.startsWith('Bearer ') ? authHeader : `Bearer ${authHeader}`


    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: token },
        },
      }
    )


    // Get user from auth
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get request body
    const { message, acao, imagemBase64, mimeType, conversationId, context: requestContext } = await req.json()

    // Only for debugging if needed: avoid printing secrets

    
    // Get user's family (optional for general conversations)
    let familyMember = null
    try {
      const { data } = await supabaseClient
        .from('family_members')
        .select('family_id')
        .eq('user_id', user.id)
        .single()
      familyMember = data
    } catch (e) {
      // Family not required for general conversations
    }
    
    // Handle conversation management
    if (acao === 'create-conversation') {
      const title = message || 'Nova Conversa'
      const { data: conversation, error: createError } = await supabaseClient
        .from('ai_conversations')
        .insert({
          user_id: user.id,
          family_id: familyMember?.family_id,
          title: title.substring(0, 255),
          context: requestContext || 'general'
        })
        .select()
        .single()

      if (createError) {
        return new Response(
          JSON.stringify({ error: 'Failed to create conversation' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(JSON.stringify({ conversation }), { headers: corsHeaders })
    }

    if (acao === 'list-conversations') {
      const { data: conversations, error: listError } = await supabaseClient
        .from('ai_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(20)

      if (listError) {
        return new Response(
          JSON.stringify({ error: 'Failed to list conversations' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(JSON.stringify({ conversations }), { headers: corsHeaders })
    }

    if (acao === 'load-conversation') {
      if (!conversationId) {
        return new Response(
          JSON.stringify({ error: 'Conversation ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: messages, error: loadError } = await supabaseClient
        .from('ai_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (loadError) {
        return new Response(
          JSON.stringify({ error: 'Failed to load conversation' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(JSON.stringify({ messages }), { headers: corsHeaders })
    }

    if (acao === 'delete-conversation') {
      if (!conversationId) {
        return new Response(
          JSON.stringify({ error: 'Conversation ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { error: deleteError } = await supabaseClient
        .from('ai_conversations')
        .delete()
        .eq('id', conversationId)
        .eq('user_id', user.id)

      if (deleteError) {
        return new Response(
          JSON.stringify({ error: 'Failed to delete conversation' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders })
    }

    // Handle image processing for receipts
    if (acao === 'processar-comprovante') {
      if (!imagemBase64 || !mimeType) {
        return new Response(
          JSON.stringify({ error: 'Image data and mimeType are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
      if (!geminiApiKey) {
        return new Response(
          JSON.stringify({ error: 'AI service not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const prompt = `Analise este comprovante de pagamento. Extraia estritamente os seguintes dados em formato JSON válido, sem markdown, sem blocos de código adicionais e sem texto extra:

SE O COMPROVANTE TIVER APENAS UM ITEM:
{
  "tipo": "unico",
  "item": {
    "valor": 0.00,
    "metodo": "Cartão de Crédito" ou "PIX" ou "Dinheiro" ou "Vale Alimentação",
    "descricao": "Nome do estabelecimento ou recebedor",
    "categoria": "Sugestão de categoria (ex: Alimentação, Transporte, Lazer)"
  }
}

SE O COMPROVANTE TIVER VÁRIOS ITENS DIFERENTES (como nota de mercado ou restaurante):
{
  "tipo": "multiplo",
  "itens": [
    {
      "descricao": "Nome do produto",
      "valor": 0.00,
      "categoria": "Sugestão de categoria"
    }
  ],
  "total": 0.00,
  "metodo": "Método de pagamento geral",
  "estabelecimento": "Nome do estabelecimento"
}`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: imagemBase64
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1000,
          },
        })
      })

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: 'Failed to process image with AI' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const data = await response.json()
      const textoResposta = data.candidates[0].content.parts[0].text
      
      // Log audit for receipt processing
      await supabaseClient.from('ai_audit_logs').insert({
        user_id: user.id,
        family_id: familyMember?.family_id,
        action: 'processar-comprovante',
        status: 'success',
        metadata: { mimeType }
      })

      try {
        const dadosExtraidos = JSON.parse(textoResposta.trim())
        return new Response(JSON.stringify(dadosExtraidos), { headers: corsHeaders })
      } catch (parseError) {
        // Try to extract JSON from markdown if parsing fails
        const jsonMatch = textoResposta.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const dadosExtraidos = JSON.parse(jsonMatch[0])
          return new Response(JSON.stringify(dadosExtraidos), { headers: corsHeaders })
        }
        
        return new Response(
          JSON.stringify({ error: 'Failed to parse AI response' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Handle regular chat messages
    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get financial data if family exists
    let context = { currentBalance: 0, incomes: [], expenses: [], cardLimit: 0, cardClosingDay: 1, cardDueDay: 10 }
    
    if (familyMember) {
      try {
        const { data: financeData } = await supabaseClient
          .from('finance_states')
          .select('data')
          .eq('family_id', familyMember.family_id)
          .single()

        if (financeData) {
          context = {
            currentBalance: financeData.data?.settings?.vaInitialBalance || 0,
            incomes: financeData.data?.incomes?.slice(-15) || [],
            expenses: financeData.data?.expenses?.slice(-15) || [],
            cardLimit: financeData.data?.settings?.cardLimit || 0,
            cardClosingDay: financeData.data?.settings?.cardClosingDay || 1,
            cardDueDay: financeData.data?.settings?.cardDueDay || 10,
          }
        }
      } catch (e) {
        // Financial data not available
      }
    }

    // Calculate current month summary
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    const monthlyExpenses = context.expenses.filter((exp: any) => {
      const expDate = new Date(exp.date)
      return expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear
    })

    const monthlyIncomes = context.incomes.filter((inc: any) => {
      const incDate = new Date(inc.date)
      return incDate.getMonth() === currentMonth && incDate.getFullYear() === currentYear
    })

    const totalExpenses = monthlyExpenses.reduce((sum: number, exp: any) => sum + exp.amount, 0)
    const totalIncomes = monthlyIncomes.reduce((sum: number, inc: any) => sum + inc.amount, 0)

    // Get system prompt from database or use default
    let systemPrompt = 'You are a helpful assistant.'
    try {
      const { data: promptData } = await supabaseClient
        .from('ai_system_prompts')
        .select('prompt')
        .eq('context', requestContext || 'finance')
        .eq('is_active', true)
        .single()
      
      if (promptData) {
        systemPrompt = promptData.prompt
      }
    } catch (e) {
      // Use default prompt if database fetch fails
    }

    // Build conversation history if conversationId provided
    let conversationHistory = ''
    if (conversationId) {
      try {
        const { data: messages } = await supabaseClient
          .from('ai_messages')
          .select('role, content')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })
          .limit(10)

        if (messages && messages.length > 0) {
          conversationHistory = '\n\nPrevious conversation:\n' + 
            messages.map((m: any) => `${m.role}: ${m.content}`).join('\n')
        }
      } catch (e) {
        // Conversation history not available
      }
    }

    // Build full system prompt with financial context if available
    let fullSystemPrompt = systemPrompt
    
    if (familyMember && context.incomes.length > 0 || context.expenses.length > 0) {
      // Calculate current month summary
      const now = new Date()
      const currentMonth = now.getMonth()
      const currentYear = now.getFullYear()

      const monthlyExpenses = context.expenses.filter((exp: any) => {
        const expDate = new Date(exp.date)
        return expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear
      })

      const monthlyIncomes = context.incomes.filter((inc: any) => {
        const incDate = new Date(inc.date)
        return incDate.getMonth() === currentMonth && incDate.getFullYear() === currentYear
      })

      const totalExpenses = monthlyExpenses.reduce((sum: number, exp: any) => sum + exp.amount, 0)
      const totalIncomes = monthlyIncomes.reduce((sum: number, inc: any) => sum + inc.amount, 0)

      fullSystemPrompt = `You are an objective and professional financial analyst assistant. Your role is to help users understand their financial situation and provide actionable insights.

Current Financial Context:
- Current Balance: R$ ${context.currentBalance.toFixed(2)}
- Credit Card Limit: R$ ${context.cardLimit.toFixed(2)}
- Card Closing Day: ${context.cardClosingDay}
- Card Due Day: ${context.cardDueDay}
- This Month's Income: R$ ${totalIncomes.toFixed(2)}
- This Month's Expenses: R$ ${totalExpenses.toFixed(2)}
- Net Cash Flow: R$ ${(totalIncomes - totalExpenses).toFixed(2)}

Recent Transactions (last 15):
${context.expenses.slice(-10).map((exp: any) => `- ${exp.description}: R$ ${exp.amount.toFixed(2)} (${exp.category})`).join('\n')}
${context.incomes.slice(-10).map((inc: any) => `- ${inc.description}: R$ ${inc.amount.toFixed(2)} (${inc.type})`).join('\n')}

Guidelines:
1. Be objective and data-driven in your analysis
2. Use markdown formatting for better readability (headers, lists, bold text)
3. Provide specific, actionable recommendations based on the data
4. Highlight positive trends and areas for improvement
5. Keep responses concise but comprehensive
6. Use professional but accessible language
7. When suggesting actions, consider the user's current financial situation
8. If the user asks for specific calculations, show your work

Respond to the user's question or request based on this financial context.`
    }

    // Add conversation history to prompt
    const finalPrompt = fullSystemPrompt + conversationHistory + `\n\nUser: ${message}\n\nAssistant:`

    // Call Gemini API
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      console.log('GEMINI_API_KEY not found in environment variables')
      return new Response(
        JSON.stringify({ error: 'AI service not configured - GEMINI_API_KEY not found' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: finalPrompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        }),
      }
    )

    if (!geminiResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to get AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const geminiData = await geminiResponse.json()
    const aiResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.'

    // Save user message to conversation if conversationId provided
    if (conversationId) {
      try {
        await supabaseClient.from('ai_messages').insert({
          conversation_id: conversationId,
          role: 'user',
          content: message,
          metadata: { context: requestContext || 'general' }
        })

        // Save assistant response
        await supabaseClient.from('ai_messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: aiResponse,
          metadata: { model: 'gemini-pro' }
        })
      } catch (e) {
        // Message saving failed, but continue with response
      }
    }

    // Log audit for AI interaction
    await supabaseClient.from('ai_audit_logs').insert({
      user_id: user.id,
      family_id: familyMember?.family_id,
      action: 'chat-message',
      status: 'success',
      metadata: { 
        conversationId,
        context: requestContext || 'general',
        messageLength: message.length,
        responseLength: aiResponse.length
      }
    })

    return new Response(
      JSON.stringify({ response: aiResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const message = error?.message ? String(error.message) : 'Internal server error'
    // Return safer debug info for front-end testing (no secrets)
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

})
