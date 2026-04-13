import { NextRequest, NextResponse } from 'next/server';

// DeepL free API endpoint (キーが :fx で終わる場合は free tier)
const DEEPL_ENDPOINT = 'https://api-free.deepl.com/v2/translate';

export async function POST(req: NextRequest) {
  const { text, targetLang } = await req.json() as { text: string; targetLang: string };

  if (!text || !targetLang) {
    return NextResponse.json({ error: 'text and targetLang are required' }, { status: 400 });
  }

  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'DEEPL_API_KEY not configured' }, { status: 500 });
  }

  const body = new URLSearchParams({
    text,
    target_lang: targetLang,
  });

  const response = await fetch(DEEPL_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[translate] DeepL error:', response.status, errText);
    return NextResponse.json({ error: 'Translation failed' }, { status: 502 });
  }

  const data = await response.json() as { translations: { text: string }[] };
  const translatedText = data.translations[0]?.text ?? '';

  return NextResponse.json({ translatedText });
}
