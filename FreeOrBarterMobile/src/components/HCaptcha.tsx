import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Modal, View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

const HCAPTCHA_SITEKEY =
    process.env.EXPO_PUBLIC_HCAPTCHA_SITEKEY ?? '';

export interface HCaptchaHandle {
    /**
     * Display the hCaptcha challenge. Resolves with the verification token,
     * or rejects if the user cancels / an error occurs.
     */
    show: () => Promise<string>;
}

interface Props {
    /** Override sitekey if needed (defaults to env var) */
    sitekey?: string;
}

/**
 * A WebView-based hCaptcha component for React Native / Expo.
 *
 * Usage:
 *   const captchaRef = useRef<HCaptchaHandle>(null);
 *   const token = await captchaRef.current?.show();
 */
const HCaptcha = forwardRef<HCaptchaHandle, Props>(({ sitekey }, ref) => {
    const key = sitekey ?? HCAPTCHA_SITEKEY;
    const [visible, setVisible] = useState(false);
    const resolveRef = useRef<((token: string) => void) | null>(null);
    const rejectRef = useRef<((err: Error) => void) | null>(null);

    useImperativeHandle(ref, () => ({
        show: () =>
            new Promise<string>((resolve, reject) => {
                resolveRef.current = resolve;
                rejectRef.current = reject;
                setVisible(true);
            }),
    }));

    const handleMessage = (event: WebViewMessageEvent) => {
        const data = event.nativeEvent.data;
        if (data.startsWith('token:')) {
            const token = data.slice('token:'.length);
            setVisible(false);
            resolveRef.current?.(token);
        } else if (data === 'cancel' || data === 'error') {
            setVisible(false);
            rejectRef.current?.(new Error(data === 'cancel' ? 'User cancelled CAPTCHA' : 'CAPTCHA error'));
        }
    };

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://js.hcaptcha.com/1/api.js" async defer></script>
  <style>
    body {
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; margin: 0; background: #f9fafb;
    }
  </style>
</head>
<body>
  <div id="captcha"></div>
  <script>
    function onLoad() {
      hcaptcha.render('captcha', {
        sitekey: '${key}',
        callback: function(token) {
          window.ReactNativeWebView.postMessage('token:' + token);
        },
        'error-callback': function() {
          window.ReactNativeWebView.postMessage('error');
        },
        'close-callback': function() {
          window.ReactNativeWebView.postMessage('cancel');
        },
      });
    }
    if (typeof hcaptcha !== 'undefined') { onLoad(); }
    else { document.addEventListener('DOMContentLoaded', function() { setTimeout(onLoad, 500); }); }
  </script>
</body>
</html>`;

    if (!key) return null;

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={() => {
            setVisible(false);
            rejectRef.current?.(new Error('User cancelled CAPTCHA'));
        }}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <ActivityIndicator style={styles.loader} size="large" color="#3B82F6" />
                    <WebView
                        source={{ html }}
                        style={styles.webview}
                        onMessage={handleMessage}
                        javaScriptEnabled
                        domStorageEnabled
                        originWhitelist={['*']}
                    />
                </View>
            </View>
        </Modal>
    );
});

HCaptcha.displayName = 'HCaptcha';

export default HCaptcha;

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        width: '90%',
        height: 400,
        backgroundColor: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
    },
    loader: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginTop: -12,
        marginLeft: -12,
        zIndex: 1,
    },
    webview: {
        flex: 1,
        backgroundColor: 'transparent',
    },
});
