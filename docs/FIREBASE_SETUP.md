# Firebase Setup Guide

## ✅ Completed Setup

1. **Firebase Project Created**: `dnc-time-tracker`
2. **iOS App Configured**: Bundle ID `com.discover-nocode.time`
3. **Web App Configured**: Ready for deployment
4. **Android Package Updated**: `com.discover-nocode.time`
5. **Firebase Initialization**: Added to `main.dart`
6. **Authentication Service**: Updated to use Firebase Auth with Google Sign-In

## 🔧 Remaining Configuration Steps

### 1. Enable Authentication in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/project/dnc-time-tracker/authentication)
2. Click "Get Started" if Authentication is not enabled
3. Go to the "Sign-in method" tab
4. Enable "Google" as a sign-in provider:
   - Click on "Google"
   - Toggle "Enable"
   - Set the project support email (use: rosson@discover-nocode.com)
   - Click "Save"

### 2. Configure Authorized Domains

1. In Firebase Console, go to Authentication → Settings → Authorized domains
2. Add the following authorized domains:
   - `localhost` (for localhost:8080)
   - `time.discover-nocode.com` (for production web)
   - `discover-nocode.com` (if needed)
   
   Note: `localhost` should already be there by default. The production domain needs to be added manually.

### 3. Android App Configuration

The Android app creation via CLI encountered an issue. You have two options:

**Option A: Create via Firebase Console (Recommended)**
1. Go to [Firebase Console - Project Settings](https://console.firebase.google.com/project/dnc-time-tracker/settings/general)
2. Scroll down to "Your apps" section
3. Click "Add app" → Select Android
4. Enter package name: `com.discover-nocode.time`
5. Download `google-services.json`
6. Replace the placeholder file at `android/app/google-services.json`

**Option B: Use FlutterFire CLI**
```bash
flutterfire configure --project=dnc-time-tracker --platforms=android
```

### 4. iOS Configuration

The iOS app is already configured with:
- Bundle ID: `com.discover-nocode.time`
- GoogleService-Info.plist: Located at `ios/Runner/GoogleService-Info.plist`

Make sure the GoogleService-Info.plist is added to your Xcode project:
1. Open `ios/Runner.xcworkspace` in Xcode
2. Right-click on the Runner folder
3. Select "Add Files to Runner..."
4. Select `GoogleService-Info.plist`
5. Make sure "Copy items if needed" is checked
6. Add to target: Runner

### 5. Web Configuration

The web app is configured. The Firebase config is in `lib/firebase_options.dart`.

For production deployment to `https://time.discover-nocode.com`:
- Make sure the domain is added to authorized domains (step 2)
- When deploying, Firebase Hosting will automatically handle the configuration

## 📱 Testing

### Web (localhost:8080)
```bash
flutter run -d chrome --web-port=8080
```

### iOS
```bash
flutter run -d ios
```

### Android
```bash
flutter run -d android
```

## 🔐 Authentication Flow

1. User clicks "Sign in with Google"
2. Google Sign-In flow is triggered
3. User authenticates with Google
4. Firebase Auth receives the credential
5. App looks up employee by email in Fillout database
6. If employee found, user is logged in and redirected to main app
7. If employee not found, login still succeeds but employee data is null (you may want to handle this case)

## 📝 Notes

- The app uses Firebase Authentication for user authentication
- Employee data is still stored in Fillout and matched by email
- The `loginAsRosson()` method is kept as a fallback for testing
- Make sure all employees in Fillout have valid email addresses that match their Google accounts

## 🚀 Next Steps

1. Complete the Android app setup (Option A or B above)
2. Enable Google Sign-In in Firebase Console
3. Add authorized domains
4. Test authentication on all platforms
5. Deploy to production when ready

