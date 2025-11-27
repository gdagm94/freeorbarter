import Constants from 'expo-constants';

const normalizeUrl = (url: string) => url.replace(/\/$/, '');

const resolvePasswordResetRedirect = () => {
  const envValue = process.env.EXPO_PUBLIC_PASSWORD_RESET_REDIRECT;
  if (envValue) return envValue;

  const extraValue = Constants.expoConfig?.extra?.passwordResetRedirect;
  if (typeof extraValue === 'string' && extraValue.length > 0) {
    return extraValue;
  }

  return 'https://freeorbarter.com/reset-password';
};

export const PASSWORD_RESET_REDIRECT = normalizeUrl(resolvePasswordResetRedirect());

