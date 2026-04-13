import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { text } = await req.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'your-api-key-here') {
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
          content: `以下の投稿テキストを審査してください。言語は日本語・英語・韓国語・中国語など何でも対応してください。
投稿: "${text}"

【ブロック条件】自分以外の対象（人・サービス・物・団体）への否定的・攻撃的表現
- 日本語例：「運営うざい」「あいつ最悪」「〇〇くそ」
- 英語例：「The staff were rude」「This app is trash」「They are so stupid」
- 韓国語例：「걔 짜증나」「서비스 최악」

【通過条件】自分自身への愚痴・日常のつぶやき・ポジティブな表現
- 日本語例：「自分ダメだな」「今日疲れた」「最高だった」
- 英語例：「I'm such an idiot」「I'm so tired」「Best day ever」

判定基準：否定語の向き先が「自分」→通過、「自分以外」→ブロック

JSONのみで返答。形式：{"blocked": true, "reason": "20文字以内"} または {"blocked": false, "reason": ""}`,
        }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[scan-post] APIエラー status:', response.status);
      return NextResponse.json({ blocked: false, reason: '' });
    }

    const content = (data.content[0].text as string).trim();

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[scan-post] JSONが見つからない:', content);
      return NextResponse.json({ blocked: false, reason: '' });
    }
    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch (e) {
    console.error('[scan-post] 例外:', e);
    return NextResponse.json({ blocked: false, reason: '' });
  }
}
