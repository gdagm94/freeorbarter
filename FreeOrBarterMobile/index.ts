import { registerRootComponent } from 'expo';

const DEBUG_ENDPOINT =
  process.env.EXPO_PUBLIC_DEBUG_ENDPOINT ||
  'http://10.0.0.207:7242/ingest/7324c825-d016-44a1-91f7-2f773ba2ff20';

const sendDebugLog = (hypothesisId: string, message: string, data: Record<string, unknown>) => {
  fetch(DEBUG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'debug-session',
      runId: 'pre-fix-4',
      hypothesisId,
      location: 'index.ts',
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch((err) => {
    // Provide console visibility if the ingest endpoint is unreachable (e.g., physical device)
    // #region agent log
    console.log('[agent-log] sendDebugLog failed', { message, error: String(err) });
    // #endregion
  });
};

// Attempt to capture errors even if core modules blow up early
try {
  const ErrorUtils = require('ErrorUtils');
  const prevHandler = ErrorUtils.getGlobalHandler?.();
  ErrorUtils.setGlobalHandler?.((error: any, isFatal?: boolean) => {
    // #region agent log
    sendDebugLog('H4', 'Global error captured', {
      message: error?.message ?? null,
      stack: error?.stack ?? null,
      isFatal: !!isFatal,
    });
    // #endregion
    if (prevHandler) prevHandler(error, isFatal);
  });
} catch (err) {
  // #region agent log
  sendDebugLog('H4', 'ErrorUtils hook failed', { error: String(err) });
  // #endregion
}

// Probe NativeModules directly (should not require PlatformConstants TurboModule)
try {
  const NativeModules = require('react-native/Libraries/BatchedBridge/NativeModules');
  const platformConstants = NativeModules?.PlatformConstants;
  // #region agent log
  sendDebugLog('H1', 'NativeModules probe', {
    hasNativeModules: !!NativeModules,
    platformConstantsExists: !!platformConstants,
    nativeModuleKeys: NativeModules ? Object.keys(NativeModules) : null,
  });
  // #endregion
  // #region agent log
  sendDebugLog('H6', 'NativeModules detail', {
    hasDefault: !!(NativeModules as any)?.default,
    defaultKeys: (NativeModules as any)?.default ? Object.keys((NativeModules as any).default) : null,
    platformConstantsDefault: (NativeModules as any)?.default?.PlatformConstants ?? null,
  });
  // #endregion
} catch (err) {
  // #region agent log
  sendDebugLog('H1', 'NativeModules probe failed', { error: String(err) });
  // #endregion
}

// Probe TurboModuleRegistry lazily to see if PlatformConstants is registered
try {
  const TMR =
    require('react-native/Libraries/TurboModule/TurboModuleRegistry').default ??
    require('react-native/Libraries/TurboModule/TurboModuleRegistry');
  const platformModule = TMR?.get?.('PlatformConstants');
  // #region agent log
  sendDebugLog('H2', 'TurboModuleRegistry probe', {
    turboProxyPresent: typeof (globalThis as any).__turboModuleProxy !== 'undefined',
    hasTMR: !!TMR,
    platformModuleExists: !!platformModule,
  });
  // #endregion
  // #region agent log
  sendDebugLog('H7', 'TurboModuleRegistry platform detail', {
    platformModuleType: platformModule ? typeof platformModule : null,
    platformModuleKeys: platformModule ? Object.keys(platformModule) : null,
  });
  // #endregion
} catch (err) {
  // #region agent log
  sendDebugLog('H2', 'TurboModuleRegistry probe failed', { error: String(err) });
  // #endregion
}

// Try to require Platform safely to capture whether it explodes
try {
  const Platform = require('react-native/Libraries/Utilities/Platform');
  // #region agent log
  sendDebugLog('H3', 'Platform module loaded', {
    os: Platform?.OS ?? null,
    version: Platform?.Version ?? null,
    constantsPresent: !!Platform?.constants,
  });
  // #endregion
  try {
    const RNVersion = require('react-native/Libraries/Core/ReactNativeVersion').version;
    // #region agent log
    sendDebugLog('H8', 'ReactNativeVersion', { version: RNVersion });
    // #endregion
  } catch {}
  try {
    const PlatformConstantsModule = require('react-native/Libraries/ReactNative/PlatformConstants');
    // #region agent log
    sendDebugLog('H9', 'PlatformConstants module require', {
      moduleType: PlatformConstantsModule ? typeof PlatformConstantsModule : null,
      moduleKeys: PlatformConstantsModule ? Object.keys(PlatformConstantsModule) : null,
    });
    // #endregion
  } catch (err) {
    // #region agent log
    sendDebugLog('H9', 'PlatformConstants module require failed', { error: String(err) });
    // #endregion
  }
} catch (err) {
  // #region agent log
  sendDebugLog('H3', 'Platform require failed', { error: String(err) });
  // #endregion
}

// Dynamically import App after probes so instrumentation runs even if App import fails early
(async () => {
  try {
    const App = (await import('./App')).default;
    // #region agent log
    sendDebugLog('H5', 'App import success', {});
    // #endregion
    registerRootComponent(App);
  } catch (err) {
    // #region agent log
    sendDebugLog('H5', 'App import failed', { error: String(err) });
    // #endregion
    throw err;
  }
})();
