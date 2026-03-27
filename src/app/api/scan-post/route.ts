import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { text } = await req.json();
  console.log('[scan-post] スキャン開始:', text);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'your-api-key-here') {
    console.warn('[scan-post] APIキー未設定 → スキャンをスキップ');
    return NextResponse.json({ blocked: false, reason: '' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: `以下の投稿テキストを判定してください。
冷笑・攻撃・否定・誹謗中傷・ネガティブキャンペーンが含まれる場合はブロックしてください。
ライブや音楽への熱狂・感動・共感の叫びは全てOKです。

テキスト：「${text}」

以下のJSON形式のみで返答してください：
{"blocked": true or false, "reason": "ブロック理由（日本語・20文字以内）"}`,
        }],
      }),
    });

    const data = await response.json();
    console.log('[scan-post] Anthropic レスポンス:', JSON.stringify(data));

    if (!response.ok) {
      console.error('[scan-post] APIエラー status:', response.status);
      return NextResponse.json({ blocked: false, reason: '' });
    }

    const content = (data.content[0].text as string).trim();
    const result = JSON.parse(content);
    console.log('[scan-post] 判定結果:', result);
    return NextResponse.json(result);
  } catch (e) {
    console.error('[scan-post] 例外:', e);
    return NextResponse.json({ blocked: false, reason: '' });
  }
}
