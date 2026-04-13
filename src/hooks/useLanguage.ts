'use client';
import { locales, defaultLocale, type Locale } from '@/i18n';

function getDeviceLocale(): Locale {
  if (typeof navigator === 'undefined') return defaultLocale;
  const code = navigator.language.split('-')[0].toLowerCase() as Locale;
  return locales.includes(code) ? code : defaultLocale;
}

export function getLanguage(): Locale {
  if (typeof localStorage === 'undefined') return getDeviceLocale();
  const stored = localStorage.getItem('sync_lang') as Locale | null;
  if (stored && locales.includes(stored)) return stored;
  return getDeviceLocale();
}

export function setLanguage(lang: Locale | 'auto'): void {
  if (lang === 'auto') {
    localStorage.removeItem('sync_lang');
  } else {
    localStorage.setItem('sync_lang', lang);
  }
  window.dispatchEvent(new Event('sync-lang-change'));
}

export type { Locale };
