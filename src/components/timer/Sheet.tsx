import React, { useEffect, useRef } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space, type, useTheme } from '../../theme';
import { t } from '../../lib/i18n';
import { useReduceMotion } from '../../lib/timerHooks';

/**
 * The one bottom sheet (slide, drag handle, radius.sheet, overlay token).
 * `dismissible=false` blocks backdrop and back-button dismissal.
 * `showTitle` renders the title as a header row; `bare` skips the padded ScrollView so the
 * children can manage their own scrolling (used by the settings option/confirm/export sheets).
 */
export function Sheet({ visible, onClose, dismissible = true, title, children, showTitle = false, bare = false, backdropLabel }: {
  visible: boolean; onClose?: () => void; dismissible?: boolean; title: string; children: React.ReactNode;
  showTitle?: boolean; bare?: boolean; backdropLabel?: string;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  // Web: react-native-web only marks a Modal active (role=dialog, Escape handling) after its CSS animation ends;
  // animationType none makes that immediate and deterministic.
  const panel = useRef<unknown>(null);
  // Web keyboard users: move focus into the sheet on open so Tab stays inside and Escape reaches the modal.
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const id = setTimeout(() => (panel.current as { focus?: () => void } | null)?.focus?.(), 80);
    return () => clearTimeout(id);
  }, [visible]);
  return (
    <Modal
      visible={visible} transparent animationType={Platform.OS === 'web' ? 'none' : reduceMotion ? 'fade' : 'slide'} aria-label={title}
      statusBarTranslucent onRequestClose={dismissible ? onClose : undefined}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessible={dismissible}
          accessibilityRole={dismissible ? 'button' : undefined}
          accessibilityLabel={dismissible ? (backdropLabel ?? t('timer.a11y.sheetBackdrop')) : undefined}
          onPress={dismissible ? onClose : undefined}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay }}
        />
        <View
          ref={panel as React.Ref<never>} {...({ tabIndex: -1 } as object)}
          accessibilityViewIsModal
          style={{
            backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
            maxHeight: '90%', paddingBottom: Math.max(insets.bottom, space.lg),
          }}
        >
          <View style={{
            alignSelf: 'center', width: 40, height: 4, borderRadius: radius.chip,
            backgroundColor: colors.controlBorder, marginTop: space.md,
          }} />
          {showTitle ? (
            <Text
              accessibilityRole="header" maxFontSizeMultiplier={1.3}
              style={[type.subtitle, { color: colors.text, paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.sm }]}
            >
              {title}
            </Text>
          ) : null}
          {bare ? (
            <View style={{ flexShrink: 1, paddingTop: showTitle ? 0 : space.lg }}>{children}</View>
          ) : (
            <ScrollView
              bounces={false} keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: space.xl, gap: space.lg }}
            >
              {children}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
