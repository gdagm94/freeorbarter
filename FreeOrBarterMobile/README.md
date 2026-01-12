# FreeorBarter Mobile App

A React Native mobile application for the FreeorBarter marketplace, converted from the original web application.

## Features

- User authentication with Supabase
- Browse items (free and barter)
- Item details and messaging
- User profiles
- Real-time notifications (coming soon)
- Image uploads (coming soon)
- Location-based search (coming soon)
- In-app safety tooling (report, block, moderator dashboard)

## Safety & Moderation

- Users can flag any listing, profile, or chat message. Reports are automatically assigned a 24 hour SLA.
- Blocking is enforced in both the UI and the database—blocked users cannot message or send offers.
- An Edge Function (`report-escalation`) can be scheduled through Supabase Cron to auto-escalate overdue reports. Set a `CRON_SECRET` env value and call the function with the header `x-cron-secret: <your-secret>`.
- Moderators can see countdown badges, overdue indicators, and auto-escalation history inside the in-app dashboard.

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)
- iOS Simulator (for iOS development) or Android Studio (for Android development)

### Installation

1. Clone the repository and navigate to the mobile app directory:
   ```bash
   cd FreeOrBarterMobile
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with your Supabase credentials:
   ```
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Start the development server:
   ```bash
   npm start
   ```

### Running the App

- **iOS Simulator**: Press `i` in the terminal or scan the QR code with the Expo Go app
- **Android Emulator**: Press `a` in the terminal or scan the QR code with the Expo Go app
- **Physical Device**: Install the Expo Go app and scan the QR code

### Building for Production

#### iOS
```bash
npm run ios
```

#### Android
```bash
npm run android
```

## Project Structure

```
src/
├── components/          # Reusable UI components
├── hooks/              # Custom React hooks
├── lib/                # External service configurations
├── screens/            # Screen components
└── types/              # TypeScript type definitions
```

## Key Differences from Web Version

1. **Navigation**: Uses React Navigation instead of React Router
2. **Styling**: Uses React Native StyleSheet instead of Tailwind CSS
3. **Components**: Adapted for mobile UI patterns
4. **Images**: Uses React Native Image component
5. **Forms**: Uses React Native TextInput and TouchableOpacity

## Next Steps

- [ ] Implement messaging functionality
- [ ] Add image upload capability
- [ ] Implement location-based search
- [ ] Add push notifications
- [ ] Implement barter offer functionality
- [ ] Add user profile editing
- [ ] Implement item watching functionality

## Push notifications (iOS/Android)

- Build with EAS (expo-notifications plugin enabled) and set APNs key/cert in Expo credentials for bundle `com.freeorbarter.mobile`.
- Device registration happens on login; tokens are stored in `public.user_push_tokens` and deduped.
- Badge counts come from unread messages + notifications; iOS badges are synced on tab badge refresh.
- Test a push from your terminal (replace values):
  ```bash
  FUNCTION_URL="https://<project-ref>.functions.supabase.co/send-push"
  SERVICE_ROLE="<SUPABASE_SERVICE_ROLE_KEY>"
  USER_ID="<recipient user uuid>"
  curl -X POST "$FUNCTION_URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SERVICE_ROLE" \
    -d "{\"user_id\":\"$USER_ID\",\"title\":\"Test push\",\"body\":\"Hello from QA\",\"data\":{\"type\":\"diagnostic\"}}"
  ```
- QA checklist: foreground alert banners, background/locked delivery, badge increments, badge cleared after reading, quick reply from notification, and message deep-link navigation.
- Dev client debugging: check console for `Push token stored` log, confirm `projectId` appears, and verify `user_push_tokens` row is created for your user after login.

## Troubleshooting

If you encounter issues:

1. Clear Metro cache: `npx expo start --clear`
2. Reset Expo cache: `npx expo r -c`
3. Check that your Supabase credentials are correct
4. Ensure all dependencies are properly installed

## Contributing

This is a converted version of the original web application. The core business logic and data models remain the same, but the UI has been adapted for mobile devices.
