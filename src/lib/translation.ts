'use client';

import { getLanguage } from '@/hooks/useLanguage';
import type { Locale } from '@/i18n';

// アプリの言語コード → DeepL の言語コード
const LOCALE_TO_DEEPL: Record<Locale, string> = {
  ja: 'JA',
  en: 'EN',
  ko: 'KO',
  zh: 'ZH',
};

// キャッシュ: `${text}__${targetLang}` → translatedText
const cache = new Map<string, string>();

/**
 * テキストを現在の設定言語に翻訳する。
 * 同じ (text, targetLang) の組み合わせはキャッシュから返す。
 * 翻訳対象: 投稿本文、コメント、プロフィール、通知文
 */
export async function translateText(text: string): Promise<string> {
  const locale = getLanguage();
  const targetLang = LOCALE_TO_DEEPL[locale];

  const cacheKey = `${text}__${targetLang}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  const response = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, targetLang }),
  });

  if (!response.ok) {
    throw new Error(`Translation request failed: ${response.status}`);
  }

  const data = await response.json() as { translatedText: string };
  cache.set(cacheKey, data.translatedText);
  return data.translatedText;
}

/**
 * 現在の設定言語の DeepL コードを返す (デバッグ・表示用)
 */
export function getCurrentDeeplLang(): string {
  return LOCALE_TO_DEEPL[getLanguage()];
}
