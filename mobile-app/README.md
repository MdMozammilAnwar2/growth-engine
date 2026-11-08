# Growth Engine — Android app

The phone app is the same React app as `../web`, packaged with
[Capacitor](https://capacitorjs.com). One codebase, one server, one database.

> **Don't need the Play Store?** Open your web app in Chrome on your phone and tap
> **⋮ › Add to Home screen**. It installs full-screen like an app, with no build step.
> Use this folder only if you want a real `.apk` / Play Store app.

## 1. Point the app at your server

The app can't use `localhost`, so it needs your server's real address. Create
`web/.env.production`:

```
VITE_API_URL=https://api.yourdomain.com
```

Then allow the app's origin in `server/.env`:

```
CORS_ORIGINS=https://yourdomain.com,https://localhost,capacitor://localhost
```

## 2. Build

You need [Android Studio](https://developer.android.com/studio) installed (it brings the Android SDK).

```bash
cd mobile-app
npm install
npm run add:android     # first time only: creates the android/ project
npm run sync            # builds ../web and copies it into android/
npm run open            # opens Android Studio → Run ▶ on your phone, or Build › Build APK
```

After changing anything in `web/`, run `npm run sync` again.

## 3. Play Store

In Android Studio: **Build › Generate Signed App Bundle**, then upload the `.aab` in
the Google Play Console. Keep the keystore file safe: you need it for every update.
