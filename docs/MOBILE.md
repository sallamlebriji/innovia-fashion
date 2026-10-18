# Native customer application

The separately locked Expo 57 / React Native 0.86 app includes persisted onboarding, boutique discovery, real facets/price sorting, galleries, native bag and pickup/COD checkout, SecureStore sessions, addresses/wishlist/orders, loyalty/QR, explicit push registration, private fitting capture/upload, before/after comparison and privacy/export/delete screens. Recovery links open the web reset flow.

The header offers persisted English, French and Arabic selection. Native onboarding, discovery/filter controls, account/consent screens, checkout and fitting labels share a translation dictionary; Arabic content uses RTL direction and currency follows the selected locale. Merchant-authored product names, descriptions and campaigns retain their authored language. Server error messages fall back to English when no translation is available. Physical-device RTL, keyboard, screen-reader and permission-flow acceptance remains required.

    cd apps/mobile
    npm ci
    npx tsc --noEmit
    npx expo export --platform android --platform ios --output-dir dist-validation
    npx expo start

Copy .env.example to .env.local and use reachable LAN URLs for device development. Bind the API to the trusted LAN; keep MySQL private. Production URLs require HTTPS. EXPO_PUBLIC_EAS_PROJECT_ID is a public project ID. Server Expo credentials stay in the API. Camera/photo/notification permissions are requested through customer actions.

Android and iOS JavaScript/Hermes exports and TypeScript checks passed locally. These are not signed APK/AAB/IPA releases. Physical-device acceptance has not been performed. eas.json supplies development/preview/production profiles; EAS identity, signing, APNs/FCM and store accounts need configuration. AR currently opens the approved web experience; embedded native Snap AR needs licensed SDK/native-module work and a custom build.

## Dependency release gate

The mobile audit reports 18 high findings propagated through Expo/Metro build dependencies. Causes include braces and node-forge with no applicable patched release reported. Compatible audit fixes did not resolve them. The suggested force fix downgrades Expo/React Native to incompatible old versions and was not applied.

Track [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) and [node-forge advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv). Resolve or independently review these findings before production distribution. The separate root web/API audit reports zero findings.
