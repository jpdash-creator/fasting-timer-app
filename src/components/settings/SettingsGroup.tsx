import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { space, type, useTheme } from '../../theme';
import { Caption, Card, Separator } from '../ui';

/** Titled, rounded group of rows with hairline separators. */
export function SettingsGroup({ title, footer, children }: {
  title?: string; footer?: React.ReactNode; children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={{ marginTop: space.xl }}>
      {title ? (
        <Text
          accessibilityRole="header"
          style={[type.caption, styles.header, { color: colors.textSecondary }]}
        >
          {title.toUpperCase()}
        </Text>
      ) : null}
      <Card style={{ paddingHorizontal: 0, paddingVertical: 0, overflow: 'hidden' }}>
        {items.map((child, i) => (
          <React.Fragment key={i}>
            {i > 0 ? <Separator /> : null}
            {child}
          </React.Fragment>
        ))}
      </Card>
      {footer ? (
        <View style={{ marginTop: space.sm, paddingHorizontal: space.lg, gap: space.md }}>
          {typeof footer === 'string' ? <Caption>{footer}</Caption> : footer}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { fontWeight: '600', letterSpacing: 0.6, marginBottom: space.sm, paddingHorizontal: space.lg },
});
