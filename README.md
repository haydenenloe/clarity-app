# Clarity 🧠

A mobile therapy co-pilot for iOS (and Android) built with React Native + Expo.

Record your therapy sessions in the background, get AI-generated session notes, and chat with your co-pilot between appointments.

---

## What It Does

- **🎙️ Background Audio Recording** — Record therapy sessions even when your screen is locked or you switch apps
- **📋 Session Notes** — AI processes recordings and generates structured notes: summary, key themes, action items, breakthroughs, and what to bring up next time
- **💬 Chat** — Ask your AI co-pilot questions about your sessions, spot patterns, and prepare for upcoming appointments

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Start the dev server

```bash
npx expo start
```

Then:
- **iOS (no Apple Developer account needed):** Install [Expo Go](https://apps.apple.com/us/app/expo-go/id982107779) on your iPhone, scan the QR code
- **Android:** Install [Expo Go](https://play.google.com/store/apps/details?id=host.exp.exponent) from Play Store, scan the QR code

---

## How Background Recording Works

iOS normally suspends apps when the screen locks. Clarity uses two mechanisms to keep recording:

1. **`UIBackgroundModes: ["audio"]`** in `app.json` — declares to iOS that this app uses audio in the background. This is what grants permission to keep the audio session alive.

2. **`staysActiveInBackground: true`** in `Audio.setAudioModeAsync()` — tells expo-av to maintain the audio session when the app moves to the background.

Together, these allow the microphone to stay active indefinitely while the screen is locked. When the user returns to the app, the timer updates and recording continues normally.

> ⚠️ This feature requires a **native build** (via EAS or Xcode). It does NOT work in Expo Go, because Expo Go's sandbox cannot declare custom background modes.

---

## Building for iOS

### Option A: EAS Build (recommended)

```bash
npm install -g eas-cli
eas login
eas build -p ios
```

This builds in the cloud and produces an `.ipa` you can submit to the App Store or install directly.

### Option B: Local Xcode build

```bash
npx expo prebuild
cd ios && pod install
open clarity.xcworkspace
```

Then build + run from Xcode.

---

## Environment

All config is in `constants/config.ts`:

```typescript
export const SUPABASE_URL = '...'
export const SUPABASE_ANON_KEY = '...'
export const API_BASE_URL = 'https://clarity-web-delta.vercel.app'
```

---

## App Structure

```
app/
  _layout.tsx          # Root layout — checks auth, redirects
  index.tsx            # Redirects to login or app
  (auth)/
    login.tsx          # Magic link auth screen
  (app)/
    _layout.tsx        # Tab navigator
    record.tsx         # 🎙️ Core recording screen
    sessions/
      index.tsx        # Session list
      [id].tsx         # Session detail with AI notes
    chat.tsx           # 💬 Chat with AI co-pilot
constants/
  config.ts            # Supabase + API URLs
lib/
  supabase.ts          # Supabase client (with AsyncStorage)
```

---

## App Store Submission Requirements

To submit to the App Store, you need:

1. **Apple Developer Account** ($99/year) — [developer.apple.com](https://developer.apple.com)
2. **EAS CLI** — `npm install -g eas-cli && eas login`
3. **App Store Connect** — create the app record, add description, screenshots
4. **Privacy policy** — required for any app that collects data
5. Build and submit: `eas submit -p ios`

---

## Backend

This app connects to:
- **Supabase** — auth, database (sessions + messages), storage (audio files)
- **Vercel API** (`clarity-web-delta.vercel.app`) — `/api/process-session` and `/api/chat`

The backend is in the [clarity-web](https://github.com/haydenenloe/clarity-web) repo.
