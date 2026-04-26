import { NextRequest, NextResponse } from 'next/server';
import OpenAI, { toFile } from 'openai';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY が未設定です' }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;
    if (!file || file.size === 0) {
      return NextResponse.json({ error: '画像ファイルを選択してください' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const openai = new OpenAI({ apiKey });

    const response = await openai.images.edit({
      model: 'gpt-image-1',
      image: await toFile(buffer, file.name, { type: file.type || 'image/png' }),
      prompt:
        '3D Pixar-style chibi face icon, ultra cute and charming. ' +
        'Face only, perfectly centered, tight circular crop. ' +
        'Face: very soft baby-like round face, smooth cheeks, small chin. ' +
        'Eyes: large eyes but NOT oversized irises. ' +
        'Increase visible white sclera around the iris (top and bottom visible). ' +
        'Iris slightly smaller relative to eye size. ' +
        'Eyes wide open, relaxed lower eyelids. Soft curved upper eyelids (not sharp). ' +
        'Warm brown irises with glossy highlights and subtle sparkle. ' +
        'Key eye balance: white sclera ratio slightly higher than iris dominance. Clear separation between iris and sclera. ' +
        'Expression: gentle, friendly, slightly curious smile. Closed mouth, subtle upward curve. ' +
        'Nose: tiny and minimal. ' +
        'Cheeks: soft blush. ' +
        'Hair: match reference, slightly rounded and softened. ' +
        'Skin: ultra smooth, soft, slightly glossy. ' +
        'Lighting: soft flat lighting, no harsh shadows, very even exposure. ' +
        'Background: dark navy (#0a0a1a), minimal, subtle soft glow behind head. ' +
        'Style: Pixar, Disney 3D, clean, cute, non-scary, friendly. ' +
        'Identity: preserve facial proportions. ' +
        'Negative: large iris, iris filling entire eye, small sclera, sharp eyes, intense gaze, scary, uncanny, realistic skin, harsh shadows.',
      n: 1,
      size: '1024x1024',
    });

    const item = response.data?.[0];
    if (item.b64_json) {
      return NextResponse.json({ url: `data:image/png;base64,${item.b64_json}` });
    }
    return NextResponse.json({ url: item.url ?? null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[generate-meme]', message);
    return NextResponse.json({ error: `生成に失敗しました: ${message}` }, { status: 500 });
  }
}
