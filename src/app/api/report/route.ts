import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    contentId?:       string;
    contentType?:     'bubble' | 'dm' | 'post' | 'profile';
    reason?:          string;
    contentSnapshot?: string;
    reportedUserId?:  string | null;
    reporterId?:      string;
  };

  const { contentId, contentType, reason, contentSnapshot, reportedUserId, reporterId } = body;

  if (!contentId || !contentType || !reason) {
    return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 });
  }

  const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 });
  }

  // 重複通報チェック
  if (reporterId) {
    const dupCheck = await fetch(
      `${supabaseUrl}/rest/v1/reports?reporter_id=eq.${reporterId}&content_id=eq.${contentId}&select=id&limit=1`,
      {
        headers: {
          'apikey':        serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
      }
    ).catch(() => null);

    if (dupCheck?.ok) {
      const existing = await dupCheck.json() as { id: string }[];
      if (existing.length > 0) {
        return NextResponse.json({ error: 'すでに通報済みです' }, { status: 409 });
      }
    }
  }

  // reports テーブルに挿入
  const insertRes = await fetch(`${supabaseUrl}/rest/v1/reports`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify({
      reporter_id:      reporterId ?? null,
      reported_user_id: reportedUserId,
      content_type:     contentType,
      content_id:       contentId,
      reason,
      content_snapshot: contentSnapshot ?? null,
      ai_flagged:       false,
      status:           'pending',
    }),
  }).catch(() => null);

  if (!insertRes?.ok) {
    const errText = await insertRes?.text().catch(() => '');
    console.error('[report] insert error:', errText);
    return NextResponse.json({ error: '通報の保存に失敗しました' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
