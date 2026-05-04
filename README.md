<<<<<<< HEAD
# 📻 Wavebox — Android App

World Radio & TV Finder — Android Edition  
Loads **https://internetfm.netlify.app** in a native WebView with full audio support.

---

## Theme & Design

The app preserves the exact Wavebox dark theme:
- Background: `#0D0E17` (hsl 240 15% 6%)
- Primary: `#F97316` (orange)
- Accent: `#C084FC` (purple)
- No action bar — edge-to-edge immersive display

---

## Build via GitHub Actions (recommended)

Every push to `main`/`master` automatically:
1. Builds a **debug APK** (always works)
2. Builds a **release APK** (signed if secrets are set)
3. Creates a **GitHub Release** with download links

### Add signing secrets (optional but recommended)

Go to your repo → **Settings → Secrets → Actions**, add:

| Secret | Value |
|---|---|
| `KEYSTORE_BASE64` | Base64 of your `.jks` keystore |
| `KEYSTORE_PASSWORD` | Keystore password |
| `KEY_ALIAS` | Key alias |
| `KEY_PASSWORD` | Key password |

To generate a keystore:
```bash
keytool -genkey -v -keystore wavebox.jks -alias wavebox \
  -keyalg RSA -keysize 2048 -validity 10000
# Then encode it:
base64 wavebox.jks
```

---

## Push from Termux (step-by-step)

### 1. Install git in Termux
```bash
pkg update && pkg install git -y
```

### 2. Configure git
```bash
git config --global user.email "you@example.com"
git config --global user.name "Your Name"
```

### 3. Clone your GitHub repo
```bash
git clone https://github.com/YOUR_USERNAME/wavebox-android.git
cd wavebox-android
```

### 4. Copy the project files into it
Copy all files from this zip into the cloned folder.

### 5. Push to GitHub
```bash
git add .
git commit -m "Add Wavebox Android app"
git push origin main
```

### 6. Watch the build
Go to your repo on GitHub → **Actions** tab → watch the build run.  
When it finishes, download the APK from **Releases** or the **Artifacts** section.

---

## Install APK on Android

1. Enable **Unknown sources** in Settings → Security
2. Download `wavebox-release.apk` from GitHub Releases
3. Tap to install

---

## Project Structure

```
wavebox-android/
├── android/
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml
│   │   │   ├── java/com/wavebox/app/
│   │   │   │   └── MainActivity.java
│   │   │   └── res/
│   │   │       ├── drawable/
│   │   │       ├── layout/activity_main.xml
│   │   │       ├── mipmap-*/ic_launcher.xml
│   │   │       ├── values/colors.xml
│   │   │       ├── values/strings.xml
│   │   │       ├── values/themes.xml
│   │   │       └── xml/network_security_config.xml
│   │   └── build.gradle
│   ├── build.gradle
│   ├── settings.gradle
│   ├── gradle.properties
│   ├── gradlew
│   └── gradle/wrapper/gradle-wrapper.properties
└── .github/
    └── workflows/
        └── build.yml
```

---

## Features

- 🎵 Full radio & TV streaming
- 📱 Native Android WebView with hardware acceleration
- 🔄 Swipe-to-refresh
- 📴 Offline error screen with retry
- 🔊 Audio plays without requiring user gesture
- 🌙 Dark theme matching the web app exactly
- ↩️ Back button navigation support
- 🔐 Release signing via GitHub Secrets
=======
# Welcome to your Lovable project

TODO: Document your project here
>>>>>>> ac6d1272b7605283c73418b414059b348676210a
