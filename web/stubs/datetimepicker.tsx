// Safety net: @react-native-community/datetimepicker is native-only (Flow source, no web build).
// Web screens use native <input type="date|time"> fields (src/components/**, Platform.OS === 'web').
export default function DateTimePicker(): null {
  return null;
}
export const DateTimePickerAndroid = {
  open: (_params?: unknown): void => undefined,
  dismiss: async (): Promise<boolean> => false,
};
export const DateTimePickerEvent = undefined;
