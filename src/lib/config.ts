const normalizeUrl = (url: string) => url.replace(/\/$/, '');

const resolveSiteUrl = () => {
  if (import.meta.env.VITE_SITE_URL) {
    return import.meta.env.VITE_SITE_URL as string;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return 'http://localhost:5173';
};

const SITE_URL = normalizeUrl(resolveSiteUrl());

export const PASSWORD_RESET_REDIRECT = normalizeUrl(
  (import.meta.env.VITE_PASSWORD_RESET_REDIRECT as string | undefined) ??
    `${SITE_URL}/reset-password`
);

export { SITE_URL };

