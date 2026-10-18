// The native splash (Android core-splashscreen / iOS LaunchScreen.storyboard) dismisses itself when the first
// frame is drawn, so there is nothing to hide explicitly. Kept so call sites stay stable.
export async function hideSplash(): Promise<void> {}
