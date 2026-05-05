import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json() as { text?: string; contentId?: string; contentType?: 'bubble' | 'dm' };
  const { text, contentId, contentType } = body;

  if (!text || !contentId || !contentType) {
    return NextResponse.json({ flagged: false, score: 0, categories: [] });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'your-api-key-here') {
    return NextResponse.json({ flagged: false, score: 0, categories: [] });
  }

  let flagged = false;
  let score = 0;
  let categories: string[] = [];

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 150,
        system:     'あなたはコンテンツモデレーターです。テキストを分析して有害コンテンツを検知してください。必ずJSONのみで返答してください。',
        messages: [{
          role:    'user',
          content: `以下のテキストをモデレーションしてください。ヘイトスピーチ・暴力・性的コンテンツ・嫌がらせを検知してください。

テキスト: "${text}"

JSONのみで返答:
{"flagged": true/false, "score": 0.0〜1.0, "categories": ["hate","violence","sexual","harassment"の中から該当するもの]}`,
        }],
      }),
    });

    if (!response.ok) {
      console.error('[moderate] Anthropic API error:', response.status);
      return NextResponse.json({ flagged: false, score: 0, categories: [] });
    }

    const data = await response.json() as { content: { text: string }[] };
    const content = data.content[0]?.text?.trim() ?? '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]) as { flagged: boolean; score: number; categories: string[] };
      flagged    = result.flagged    ?? false;
      score      = result.score      ?? 0;
      categories = result.categories ?? [];
    }
  } catch (e) {
    console.error('[moderate] AI scan error:', e);
    return NextResponse.json({ flagged: false, score: 0, categories: [] });
  }

  // flagged の場合: is_hidden=true に更新 + reports に自動記録
  if (flagged) {
    const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceRoleKey) {
      const table = contentType === 'bubble' ? 'bubbles' : 'messages';

      // is_hidden=true に更新
      await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${contentId}`, {
        method:  'PATCH',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Prefer':        'return=minimal',
        },
        body: JSON.stringify({ is_hidden: true }),
      }).catch((e) => console.error('[moderate] is_hidden update error:', e));

      // AI 自動通報を reports に記録
      await fetch(`${supabaseUrl}/rest/v1/reports`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Prefer':        'return=minimal',
        },
        body: JSON.stringify({
          content_type:     contentType,
          content_id:       contentId,
          reason:           categories.includes('harassment') ? 'harassment' : 'inappropriate',
          content_snapshot: text,
          ai_flagged:       true,
          ai_score:         score,
          status:           'pending',
        }),
      }).catch((e) => console.error('[moderate] reports insert error:', e));
    }
  }

  return NextResponse.json({ flagged, score, categories });
}
