# Mobile & Desktop App Setup Guide

## Overview

Stick My Note supports three distribution modes:
1. **PWA** (Progressive Web App) - Install from browser, works everywhere
2. **Native Mobile** (Capacitor) - iOS App Store & Google Play Store
3. **Desktop** (Tauri) - Windows, macOS, Linux native apps

---

## 1. PWA (Already Active)

The PWA is production-ready with:
- Web manifest with app shortcuts
- Service worker with offline caching, background sync, push notifications
- Install prompt (auto-shows on supported browsers)
- Offline page fallback
- Update notifications

### Testing PWA
1. Build production: `pnpm build`
2. Start server: `pnpm start`
3. Open Chrome DevTools > Application > Manifest to verify
4. Use Lighthouse audit for PWA score

---

## 2. Native Mobile (Capacitor)

### Prerequisites
- Node.js 18+
- For iOS: macOS with Xcode 15+
- For Android: Android Studio with SDK 33+

### Initial Setup
```bash
# Install Capacitor CLI and core
pnpm add @capacitor/cli @capacitor/core

# Add platforms
pnpm add @capacitor/ios @capacitor/android

# Add optional plugins
pnpm add @capacitor/push-notifications @capacitor/haptics @capacitor/share @capacitor/status-bar

# Build the web app first
pnpm build

# Initialize platforms
npx cap add ios
npx cap add android
```

### Development Workflow
```bash
# After code changes:
pnpm build          # Build Next.js
npx cap sync        # Sync web assets to native projects

# Open in IDE:
npx cap open ios     # Opens Xcode
npx cap open android # Opens Android Studio

# Live reload during development:
# In capacitor.config.ts, uncomment the server.url line
# Then run: pnpm dev & npx cap run ios --livereload
```

### Building for Store
```bash
# iOS
npx cap build ios

# Android
npx cap build android
```

### Key Files
- `capacitor.config.ts` - Capacitor configuration
- `lib/native/capacitor-bridge.ts` - Native API bridge (haptics, push, share, biometrics)
- `hooks/use-native-app.ts` - React hook for native detection

---

## 3. Desktop App (Tauri)

### Prerequisites
- Rust (install from https://rustup.rs/)
- Node.js 18+
- Platform build tools:
  - **Windows**: Visual Studio Build Tools with C++ workload
  - **macOS**: Xcode Command Line Tools
  - **Linux**: `sudo apt install libwebkit2gtk-4.1-dev build-essential`

### Initial Setup
```bash
# Install Tauri CLI
pnpm add -D @tauri-apps/cli

# Check prerequisites
npx tauri info
```

### Development
```bash
# Start dev mode (builds Rust + opens window with hot reload)
npx tauri dev
```

### Building
```bash
# Create distributable (installer/dmg/deb)
npx tauri build
```

### Features Included
- **System tray**: Minimize to tray on close
- **Global shortcut**: `Ctrl+Shift+S` to show/focus window
- **Auto-start**: Optional launch on system boot
- **Deep links**: `stickmynote://` protocol handler
- **Native notifications**: OS-level push notifications

### Key Files
- `src-tauri/tauri.conf.json` - Tauri configuration
- `src-tauri/src/lib.rs` - Rust backend with commands and setup
- `src-tauri/Cargo.toml` - Rust dependencies

---

## 4. Responsive Design

### Breakpoints
| Breakpoint | Width | Target |
|-----------|-------|--------|
| Mobile | < 768px | Phones |
| Tablet | 768px - 1024px | Tablets, small laptops |
| Desktop | 1024px - 1440px | Laptops, monitors |
| Large | > 1440px | Large monitors |

### Available Hooks
- `useIsMobile()` - Boolean mobile detection (< 768px)
- `useMobileDetect()` - Granular: `{ isMobile, isTablet, isDesktop }`
- `useNativeApp()` - Platform detection: `{ isNative, isPWA, platform }`
- `useSwipeGesture()` - Swipe left/right/up/down handler
- `usePullToRefresh()` - Pull-to-refresh for lists

### Available Components
- `<MobileBottomNav>` - Bottom tab navigation (mobile only)
- `<AdaptiveContainer>` - Responsive max-width container
- `<PullToRefresh>` - Pull-to-refresh wrapper

### CSS Utilities
- `.touch-target` - Ensures 44x44px minimum tap target
- `.desktop-only` / `.touch-only` - Show/hide by device type
- `.swipeable` / `.swipeable-vertical` - Enable swipe touch action
- `.pinch-zoom` - Enable pinch-to-zoom
- `.fab` - Floating action button with safe area
- `.text-adaptive` / `.heading-adaptive` - Responsive text sizing
- `.container-adaptive` - Responsive container with clamped padding
- `.tablet-grid` - Two-column grid for tablets
- `.mobile-bottom-sheet` - Bottom sheet animation for mobile dialogs

### Safe Areas
Safe area CSS variables are available for notched devices:
```css
var(--safe-area-top)
var(--safe-area-bottom)
var(--safe-area-left)
var(--safe-area-right)
```
