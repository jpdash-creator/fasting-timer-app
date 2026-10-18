import React from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { hit, icon, radius, space, type, useTheme } from '../../theme';
import { t } from '../../lib/i18n';

export function FilterBar({ query, onQuery, protocols, selected, onSelect }: {
  query: string; onQuery: (s: string) => void;
  protocols: { id: string; name: string }[]; selected: string | null; onSelect: (id: string | null) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      <View style={{
        minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md,
        borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.controlBorder,
      }}>
        <Ionicons name="search" size={icon.sm} color={colors.textSecondary} />
        <TextInput
          value={query} onChangeText={onQuery}
          placeholder={t('history.search')} placeholderTextColor={colors.textSecondary}
          accessibilityLabel={t('history.search')} returnKeyType="search" autoCorrect={false}
          style={[type.body, { flex: 1, color: colors.text, minHeight: hit.min }]}
        />
        {query ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('history.clearSearch')} hitSlop={10}
            onPress={() => onQuery('')} style={{ minWidth: hit.min, minHeight: hit.min, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close-circle" size={icon.md} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {protocols.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}
          accessibilityRole="radiogroup">
          {[{ id: '', name: t('history.allProtocols') }, ...protocols].map((p) => {
            const active = (selected ?? '') === p.id;
            return (
              <Pressable
                key={p.id || 'all'} accessibilityRole="radio" aria-checked={active}
                accessibilityLabel={p.name} onPress={() => onSelect(p.id || null)}
                style={{
                  minHeight: hit.min, paddingHorizontal: space.lg, justifyContent: 'center', borderRadius: radius.chip,
                  backgroundColor: active ? colors.accent : colors.surface,
                  borderWidth: 1, borderColor: active ? colors.accent : colors.controlBorder,
                }}
              >
                <Text style={[type.label, { color: active ? colors.onAccent : colors.text }]}>{p.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}
