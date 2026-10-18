import React from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { layout, radius, space, type, useTheme } from '../../theme';
import { PrimaryButton } from '../ui';
import { t } from '../../lib/i18n';

/** Full-height in-app reader for the bundled draft legal text (fallback when no hosted URL is set). */
export function LegalTextSheet({ visible, title, text, onClose }: {
  visible: boolean; title: string; text: string; onClose: () => void;
}) {
  const { colors } = useTheme();
  const body = text.replace(/^#+\s*/gm, '').replace(/\*\*/g, '');
  return (
    <Modal aria-label={title} visible={visible} animationType={Platform.OS === 'web' ? 'none' : 'slide'} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: space.xxl }}>
        <Text accessibilityRole="header" style={[type.title, { color: colors.text, paddingHorizontal: layout.screenX }]}>{title}</Text>
        <ScrollView {...({ tabIndex: 0 } as object)} contentContainerStyle={{ padding: layout.screenX, paddingBottom: space.xxl }}>
          <View style={{ padding: space.lg, borderRadius: radius.card, backgroundColor: colors.surface }}>
            <Text selectable style={[type.body, { color: colors.text, lineHeight: 22 }]}>{body}</Text>
          </View>
        </ScrollView>
        <View style={{ padding: layout.screenX }}>
          <PrimaryButton label={t('settings.sheet.close')} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
