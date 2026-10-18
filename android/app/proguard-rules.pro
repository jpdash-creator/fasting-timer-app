# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# react-native-config reads BuildConfig by reflection
-keep class com.fastline.app.BuildConfig { *; }

# ---- Only relevant when minification is enabled (-PFASTLINE_MINIFY=true) ----
# Hermes / React Native core and JNI (already shipped by react-android consumer rules; kept explicit for safety)
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }
# react-native-reanimated / worklets
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.worklets.** { *; }
# Nitro modules (react-native-iap) use fbjni + HybridObject reflection
-keep class com.margelo.nitro.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
# react-native-iap / OpenIAP + Play Billing
-keep class com.margelo.nitro.iap.** { *; }
-keep class dev.hyo.** { *; }
-keep class io.github.hyochan.** { *; }
-keep class com.android.vending.billing.** { *; }
# notifee (ships its own consumer rules; keep models used by JS-bridge serialization)
-keep class app.notifee.** { *; }
-keep class io.invertase.notifee.** { *; }
# react-native-change-icon looks activity-aliases up by name
-keep class com.reactnativechangeicon.** { *; }
-dontwarn com.google.android.play.core.**
