import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  BackHandler,
  Platform,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { StatusBar } from 'expo-status-bar';

// Configure foreground notifications presentation
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerForPushNotificationsAsync() {
  let token = null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#014025',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for notification!');
      return null;
    }
    try {
      const res = await Notifications.getExpoPushTokenAsync();
      token = res.data;
      console.log('[Expo Mobile] Push token generated:', token);
    } catch (e) {
      console.warn('Error fetching Expo push token:', e);
    }
  } else {
    console.log('Physical device required for Push Notifications');
  }

  return token;
}

// Production Render Labour portal
const PRODUCTION_URL = 'https://solar-erp-app.onrender.com/labour';

export default function App() {
  const webViewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [expoPushToken, setExpoPushToken] = useState('');
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch native device GPS fix and stream to WebView
  const syncNativeLocation = async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (loc?.coords) {
        injectNativeLocation(loc.coords, loc.timestamp);
      }
    } catch (e) {
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (last?.coords) {
          injectNativeLocation(last.coords, last.timestamp);
        }
      } catch (err) {
        console.warn('Native GPS fix failed:', err);
      }
    }
  };

  const injectNativeLocation = (coords, timestamp) => {
    if (!webViewRef.current || !coords) return;
    const script = `
      if (window.updateNativeGPS) {
        window.updateNativeGPS({
          latitude: ${coords.latitude},
          longitude: ${coords.longitude},
          accuracy: ${coords.accuracy || 10},
          timestamp: ${timestamp || Date.now()}
        });
      }
      true;
    `;
    webViewRef.current.injectJavaScript(script);
  };

  // Initialize Push Notifications
  useEffect(() => {
    registerForPushNotificationsAsync().then((t) => {
      if (t) setExpoPushToken(t);
    });
  }, []);

  // Safety timer: Dismiss loading spinner automatically after 2.5 seconds max
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // Request native GPS permission upfront and stream fixes to WebView
  useEffect(() => {
    let watcherSubscription = null;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          setHasLocationPermission(true);
          await syncNativeLocation();

          try {
            watcherSubscription = await Location.watchPositionAsync(
              {
                accuracy: Location.Accuracy.Balanced,
                timeInterval: 8000,
                distanceInterval: 5,
              },
              (loc) => {
                if (loc?.coords) {
                  injectNativeLocation(loc.coords, loc.timestamp);
                }
              }
            );
          } catch (e) {
            console.warn('Could not start location watcher:', e);
          }
        } else {
          Alert.alert(
            'GPS Permission Required',
            'Solar ERP needs access to your location to mark labour attendance inside worksite geofences.',
            [{ text: 'OK' }]
          );
        }
      } catch (err) {
        console.warn('Location permission request failed:', err);
      }
    })();

    return () => {
      if (watcherSubscription && typeof watcherSubscription.remove === 'function') {
        watcherSubscription.remove();
      }
    };
  }, []);

  // Handle Android physical back button
  useEffect(() => {
    if (Platform.OS === 'android') {
      const onBackPress = () => {
        if (canGoBack && webViewRef.current) {
          webViewRef.current.goBack();
          return true;
        }
        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }
  }, [canGoBack]);

  const handleRetry = () => {
    setHasError(false);
    setIsLoading(true);
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  };

  const bridgeScript = `
    window.EXPO_PUSH_TOKEN = ${JSON.stringify(expoPushToken || '')};
    (function() {
      window.__NATIVE_GPS__ = null;
      window.__GPS_LISTENERS__ = [];

      window.updateNativeGPS = function(coords) {
        window.__NATIVE_GPS__ = coords;
        var list = window.__GPS_LISTENERS__.slice(0);
        window.__GPS_LISTENERS__ = [];
        list.forEach(function(fn) {
          try { fn(coords); } catch(e) {}
        });
        try {
          window.dispatchEvent(new CustomEvent('nativeLocationUpdate', { detail: coords }));
        } catch(e) {}
      };

      if (navigator && navigator.geolocation) {
        var origGetCurrentPosition = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
        navigator.geolocation.getCurrentPosition = function(success, error, options) {
          if (window.__NATIVE_GPS__) {
            success({
              coords: {
                latitude: window.__NATIVE_GPS__.latitude,
                longitude: window.__NATIVE_GPS__.longitude,
                accuracy: window.__NATIVE_GPS__.accuracy || 10,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null,
              },
              timestamp: window.__NATIVE_GPS__.timestamp || Date.now()
            });
            return;
          }

          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.__GPS_LISTENERS__.push(function(coords) {
              success({
                coords: {
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                  accuracy: coords.accuracy || 10,
                  altitude: null,
                  altitudeAccuracy: null,
                  heading: null,
                  speed: null,
                },
                timestamp: coords.timestamp || Date.now()
              });
            });
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'REQUEST_LOCATION' }));
            setTimeout(function() {
              origGetCurrentPosition(success, error, options);
            }, 2500);
          } else {
            origGetCurrentPosition(success, error, options);
          }
        };
      }
    })();
    true;
  `;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor="#014025" />

      {/* WebView or Error Screen */}
      {hasError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorTitle}>Cannot Connect to Solar ERP</Text>
          <Text style={styles.errorSubtext}>
            Please check your internet connection and tap retry.
            {errorMessage ? `\n\n(${errorMessage})` : ''}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
            <Text style={styles.retryBtnText}>Retry Connection</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          source={{ uri: PRODUCTION_URL }}
          style={styles.webview}
          geolocationEnabled={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowFileAccess={true}
          allowFileAccessFromFileURLs={true}
          allowUniversalAccessFromFileURLs={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          injectedJavaScriptBeforeContentLoaded={bridgeScript}
          onMessage={async (event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === 'REQUEST_LOCATION') {
                await syncNativeLocation();
              }
            } catch (e) {
              // Ignore non-json messages
            }
          }}
          onNavigationStateChange={(navState) => {
            setCanGoBack(navState.canGoBack);
          }}
          onLoadStart={() => setIsLoading(true)}
          onLoad={() => {
            setIsLoading(false);
            syncNativeLocation();
          }}
          onLoadProgress={({ nativeEvent }) => {
            if (nativeEvent.progress >= 0.5) {
              setIsLoading(false);
            }
          }}
          onLoadEnd={() => {
            setIsLoading(false);
            syncNativeLocation();
            if (expoPushToken && webViewRef.current) {
              const script = `
                window.EXPO_PUSH_TOKEN = ${JSON.stringify(expoPushToken)};
                window.postMessage(JSON.stringify({ type: 'EXPO_PUSH_TOKEN', token: ${JSON.stringify(expoPushToken)} }), '*');
                true;
              `;
              webViewRef.current.injectJavaScript(script);
            }
          }}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            setIsLoading(false);
            setHasError(true);
            setErrorMessage(nativeEvent.description || 'Connection failed');
          }}
          onHttpError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            if (nativeEvent.statusCode >= 400) {
              console.warn('HTTP error: ', nativeEvent.statusCode);
            }
          }}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#014025" />
              <Text style={styles.loadingText}>Connecting to Solar ERP...</Text>
            </View>
          )}
        />
      )}

      {/* Floating loading overlay for initial connection */}
      {isLoading && !hasError && (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setIsLoading(false)}
          style={styles.initialOverlay}
        >
          <View style={styles.card}>
            <ActivityIndicator size="large" color="#014025" />
            <Text style={styles.brandTitle}>Solar ERP</Text>
            <Text style={styles.loadingSubtext}>Connecting to Solar ERP...</Text>
            <Text style={styles.dismissHint}>Tap anywhere to dismiss</Text>
          </View>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#014025',
    paddingTop: Platform.OS === 'android' ? 24 : 0,
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
    color: '#014025',
  },
  initialOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(1, 64, 37, 0.4)',
  },
  card: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 28,
    paddingVertical: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  brandTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#014025',
    marginTop: 14,
  },
  loadingSubtext: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  dismissHint: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 8,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});
