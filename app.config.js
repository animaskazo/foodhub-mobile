const base = /** @type {{ expo: import('expo/config').ExpoConfig }} */ (require('./app.json'));

module.exports = () => ({
  ...base.expo,
  ios: { ...base.expo.ios, ...(process.env.FOODHUB_IOS_BUNDLE_IDENTIFIER ? { bundleIdentifier: process.env.FOODHUB_IOS_BUNDLE_IDENTIFIER } : {}) },
  android: { ...base.expo.android, ...(process.env.FOODHUB_ANDROID_PACKAGE ? { package: process.env.FOODHUB_ANDROID_PACKAGE } : {}) },
  extra: {
    ...base.expo.extra,
    eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || base.expo.extra?.eas?.projectId },
  },
});
