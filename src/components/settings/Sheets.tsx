import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { hit, space, type, useTheme } from '../../theme';
import { Sheet } from '../timer/Sheet';
import { haptic, PrimaryButton } from '../ui';
import { t } from '../../lib/i18n';

/** Thin wrapper: every settings sheet is the shared timer Sheet (one sheet look). */
function SheetFrame({ visible, onClose, title, children }: {
  visible: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title} showTitle bare backdropLabel={t('settings.sheet.close')}>
      {children}
    </Sheet>
  );
}

export interface SheetOption<V extends string> { value: V; label: string }

/** Single-choice bottom sheet (radio list). */
export function OptionSheet<V extends string>({ visible, title, options, value, onSelect, onClose, footer }: {
  visible: boolean; title: string; options: SheetOption<V>[]; value: V;
  onSelect: (v: V) => void; onClose: () => void; footer?: string;
}) {
  const { colors } = useTheme();
  return (
    <SheetFrame visible={visible} onClose={onClose} title={title}>
      <ScrollView>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value || 'default'}
              onPress={() => { haptic('light'); onSelect(o.value); onClose(); }}
              accessibilityRole="radio"
              accessibilityLabel={o.label}
              aria-checked={selected}
              style={({ pressed }) => ({
                minHeight: hit.comfortable, flexDirection: 'row', alignItems: 'center', gap: space.md,
                paddingHorizontal: space.xl, opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={[type.body, { flex: 1, color: colors.text, fontWeight: selected ? '600' : '400' }]}>{o.label}</Text>
              {selected ? <Ionicons name="checkmark" size={22} color={colors.accent} /> : null}
            </Pressable>
          );
        })}
        {footer ? (
          <Text style={[type.caption, { color: colors.textSecondary, paddingHorizontal: space.xl, paddingTop: space.sm }]}>{footer}</Text>
        ) : null}
      </ScrollView>
    </SheetFrame>
  );
}

/** Destructive-action confirmation sheet. */
export function ConfirmSheet({ visible, title, message, confirmLabel, onConfirm, onClose, busy }: {
  visible: boolean; title: string; message: string; confirmLabel: string;
  onConfirm: () => void; onClose: () => void; busy?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <SheetFrame visible={visible} onClose={onClose} title={title}>
      <View style={{ paddingHorizontal: space.xl, gap: space.lg }}>
        <Text style={[type.body, { color: colors.textSecondary }]}>{message}</Text>
        <PrimaryButton label={confirmLabel} variant="danger" onPress={onConfirm} disabled={busy} />
        <PrimaryButton label={t('common.cancel')} variant="ghost" onPress={onClose} disabled={busy} />
      </View>
    </SheetFrame>
  );
}

/** Export chooser: three data sets. */
export function ExportSheet({ visible, onPick, onClose }: {
  visible: boolean; onPick: (k: 'fasts' | 'weight' | 'water') => void; onClose: () => void;
}) {
  const { colors } = useTheme();
  const items: { k: 'fasts' | 'weight' | 'water'; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
    { k: 'fasts', label: t('settings.export.fasts'), icon: 'timer-outline' },
    { k: 'weight', label: t('settings.export.weight'), icon: 'scale-outline' },
    { k: 'water', label: t('settings.export.water'), icon: 'water-outline' },
  ];
  return (
    <SheetFrame visible={visible} onClose={onClose} title={t('settings.export.title')}>
      <Text style={[type.caption, { color: colors.textSecondary, paddingHorizontal: space.xl, paddingBottom: space.sm }]}>
        {t('settings.export.message')}
      </Text>
      {items.map((it) => (
        <Pressable
          key={it.k}
          onPress={() => { haptic('light'); onClose(); onPick(it.k); }}
          accessibilityRole="button" accessibilityLabel={it.label}
          style={({ pressed }) => ({
            minHeight: hit.comfortable, flexDirection: 'row', alignItems: 'center', gap: space.md,
            paddingHorizontal: space.xl, opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name={it.icon} size={22} color={colors.accent} />
          <Text style={[type.body, { flex: 1, color: colors.text }]}>{it.label}</Text>
        </Pressable>
      ))}
    </SheetFrame>
  );
}
