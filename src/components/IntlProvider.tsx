'use client';
import { useState, useEffect } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getLanguage, type Locale } from '@/hooks/useLanguage';
import jaMessages from '../../messages/ja.json';
import enMessages from '../../messages/en.json';
import koMessages from '../../messages/ko.json';
import zhMessages from '../../messages/zh.json';

type Messages = typeof jaMessages;

const ALL_MESSAGES: Record<Locale, Messages> = {
  ja: jaMessages,
  en: enMessages,
  ko: koMessages,
  zh: zhMessages,
};

export function IntlProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('ja');

  function refresh() {
    setLocale(getLanguage());
  }

  useEffect(() => {
    refresh();
    window.addEventListener('sync-lang-change', refresh);
    return () => window.removeEventListener('sync-lang-change', refresh);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <NextIntlClientProvider locale={locale} messages={ALL_MESSAGES[locale]} timeZone="Asia/Tokyo">
      {children}
    </NextIntlClientProvider>
  );
}
