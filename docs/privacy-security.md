# Privacy & Security

**All computation runs client-side.** The simulator is a single-page app with embedded JavaScript. It does not make network requests, does not send your profile data anywhere, and does not use cookies.

Your profile is saved in your browser's `localStorage` under the key `retirement-simulator-profile-v1`. It never leaves your device unless you explicitly click **Download** and share the file.

The simulator loads `chart.js` and `js-yaml` from npm at build time — the deployed HTML is fully self-contained with no runtime CDN dependencies.
