import { getRequestConfig } from 'next-intl/server';
import { locales, defaultLocale, type Locale } from '@/i18n';

function detectLocale(acceptLang: string | null): Locale {
  if (!acceptLang) return defaultLocale;
  for (const part of acceptLang.split(',')) {
    const code = part.trim().split(';')[0].split('-')[0].toLowerCase() as Locale;
    if (locales.includes(code)) return code;
  }
  return defaultLocale;
}

export default getRequestConfig(async () => {
  let locale: Locale = defaultLocale;

  try {
    const { headers } = await import('next/headers');
    const headersList = await headers();
    locale = detectLocale(headersList.get('accept-language'));
  } catch {
    // Static generation — fall back to default locale
    locale = defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
