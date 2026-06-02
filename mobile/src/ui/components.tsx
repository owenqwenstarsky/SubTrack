import { ReactNode, forwardRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radii, shadows, spacing, typography } from './theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerGhost';
type Size = 'sm' | 'md' | 'lg';

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading,
  leading,
  trailing,
  fullWidth,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const containerBase = buttonContainerStyles[variant];
  const textStyles = buttonTextStyles[variant];
  const sizeStyles = buttonSizeStyles[size];

  return (
    <Pressable
      {...rest}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={({ pressed }) => [
        styles.buttonBase,
        containerBase,
        sizeStyles.container,
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && buttonPressedStyles[variant],
        isDisabled && styles.buttonDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textStyles.color as string} />
      ) : (
        <View style={styles.buttonContent}>
          {leading ? <View style={styles.buttonIcon}>{leading}</View> : null}
          <Text style={[styles.buttonText, sizeStyles.text, textStyles]} numberOfLines={1}>
            {label}
          </Text>
          {trailing ? <View style={styles.buttonIcon}>{trailing}</View> : null}
        </View>
      )}
    </Pressable>
  );
}

const buttonContainerStyles: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.primary },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: colors.danger },
  dangerGhost: {
    backgroundColor: colors.dangerSoft,
  },
};

const buttonPressedStyles: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.primaryPressed },
  secondary: { backgroundColor: colors.surfaceMuted },
  ghost: { backgroundColor: colors.surfaceMuted },
  danger: { backgroundColor: colors.dangerPressed },
  dangerGhost: { backgroundColor: '#FECACA' },
};

const buttonTextStyles: Record<Variant, TextStyle> = {
  primary: { color: '#FFFFFF' },
  secondary: { color: colors.text },
  ghost: { color: colors.primary },
  danger: { color: '#FFFFFF' },
  dangerGhost: { color: colors.danger },
};

const buttonSizeStyles: Record<Size, { container: ViewStyle; text: TextStyle }> = {
  sm: {
    container: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.md },
    text: { fontSize: 14, fontWeight: '600' },
  },
  md: {
    container: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radii.md },
    text: { fontSize: 15, fontWeight: '600' },
  },
  lg: {
    container: { paddingVertical: spacing.lg - 2, paddingHorizontal: spacing.lg, borderRadius: radii.lg },
    text: { fontSize: 16, fontWeight: '600' },
  },
};

export type FieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  helperText?: string;
  errorText?: string;
  required?: boolean;
  rightAdornment?: ReactNode;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
};

export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, helperText, errorText, required, rightAdornment, containerStyle, inputStyle, multiline, ...rest },
  ref,
) {
  const hasError = !!errorText;
  return (
    <View style={[styles.fieldRoot, containerStyle]}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>
          {label}
          {required ? <Text style={styles.fieldRequired}> *</Text> : null}
        </Text>
      </View>
      <View
        style={[
          styles.fieldInputWrapper,
          multiline && styles.fieldInputWrapperMultiline,
          hasError && styles.fieldInputWrapperError,
        ]}
      >
        <TextInput
          ref={ref}
          {...rest}
          multiline={multiline}
          placeholderTextColor={colors.textSubtle}
          style={[styles.fieldInput, multiline && styles.fieldInputMultiline, inputStyle]}
        />
        {rightAdornment ? <View style={styles.fieldAdornment}>{rightAdornment}</View> : null}
      </View>
      {hasError ? (
        <Text style={styles.fieldError}>{errorText}</Text>
      ) : helperText ? (
        <Text style={styles.fieldHelper}>{helperText}</Text>
      ) : null}
    </View>
  );
});

export type SegmentedOption<T extends string> = { value: T; label: string };

export type SegmentedProps<T extends string> = {
  label?: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  containerStyle?: ViewStyle;
};

export function Segmented<T extends string>({ label, value, options, onChange, containerStyle }: SegmentedProps<T>) {
  return (
    <View style={[styles.fieldRoot, containerStyle]}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={styles.segmentedRow}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.segmentedItem,
                active && styles.segmentedItemActive,
                pressed && !active && styles.segmentedItemPressed,
              ]}
            >
              <Text style={[styles.segmentedText, active && styles.segmentedTextActive]} numberOfLines={1}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export type CardProps = {
  children: ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function Card({ children, style, onPress, accessibilityLabel }: CardProps) {
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Pill({
  label,
  tone = 'neutral',
  style,
}: {
  label: string;
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
  style?: ViewStyle;
}) {
  const palette = pillPalette[tone];
  return (
    <View style={[styles.pill, { backgroundColor: palette.background }, style]}>
      <Text style={[styles.pillText, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

const pillPalette: Record<'neutral' | 'primary' | 'success' | 'warning' | 'danger', { background: string; text: string }> = {
  neutral: { background: colors.surfaceMuted, text: colors.textMuted },
  primary: { background: colors.primarySoft, text: colors.primary },
  success: { background: colors.successSoft, text: colors.success },
  warning: { background: colors.warningSoft, text: colors.warning },
  danger: { background: colors.dangerSoft, text: colors.danger },
};

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.emptyRoot}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.errorRoot}>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorMessage}>{message}</Text>
      {onRetry ? (
        <View style={{ marginTop: spacing.lg }}>
          <Button label="Try again" onPress={onRetry} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}

export function LoadingState({ label }: { label?: string }) {
  return (
    <View style={styles.loadingRoot}>
      <ActivityIndicator color={colors.primary} />
      {label ? <Text style={styles.loadingLabel}>{label}</Text> : null}
    </View>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  backLabel,
  action,
}: {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.screenHeader}>
      <View style={styles.screenHeaderTopRow}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={backLabel ?? 'Back'}
            onPress={onBack}
            hitSlop={10}
            style={({ pressed }) => [styles.screenHeaderBack, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.screenHeaderBackIcon}>‹</Text>
            {backLabel ? <Text style={styles.screenHeaderBackLabel}>{backLabel}</Text> : null}
          </Pressable>
        ) : (
          <View style={styles.screenHeaderBackSpacer} />
        )}
        {action ? <View style={styles.screenHeaderAction}>{action}</View> : null}
      </View>
      {title ? <Text style={styles.screenHeaderTitle}>{title}</Text> : null}
      {subtitle ? (
        <Text style={styles.screenHeaderSubtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionHeader}>{title}</Text>
      {action}
    </View>
  );
}

export function KeyValueRow({ label, value }: { label: string; value: string | ReactNode }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}</Text>
      {typeof value === 'string' ? <Text style={styles.kvValue}>{value}</Text> : value}
    </View>
  );
}

const styles = StyleSheet.create({
  fullWidth: { alignSelf: 'stretch' },
  buttonBase: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  buttonIcon: { marginHorizontal: 2 },
  buttonText: { textAlign: 'center' },
  buttonDisabled: { opacity: 0.55 },

  fieldRoot: { marginBottom: spacing.lg },
  fieldLabelRow: { marginBottom: spacing.xs },
  fieldLabel: { ...typography.label },
  fieldRequired: { color: colors.danger },
  fieldInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  fieldInputWrapperMultiline: { alignItems: 'flex-start', paddingVertical: spacing.sm },
  fieldInputWrapperError: { borderColor: colors.danger, backgroundColor: '#FFF7F7' },
  fieldInput: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    paddingVertical: 0,
  },
  fieldInputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
    paddingTop: spacing.xs,
  },
  fieldAdornment: { marginLeft: spacing.sm },
  fieldHelper: { ...typography.caption, marginTop: spacing.xs },
  fieldError: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },

  segmentedRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: 4,
    gap: 4,
  },
  segmentedItem: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedItemActive: {
    backgroundColor: colors.surface,
    ...shadows.card,
    shadowOpacity: 0.08,
  },
  segmentedItemPressed: { backgroundColor: '#E2E8F0' },
  segmentedText: { fontSize: 14, fontWeight: '500', color: colors.textMuted },
  segmentedTextActive: { color: colors.text, fontWeight: '600' },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardPressed: { backgroundColor: colors.surfaceMuted, transform: [{ scale: 0.997 }] },

  pill: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
  pillText: { fontSize: 12, fontWeight: '600' },

  emptyRoot: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl + spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: { ...typography.heading, marginBottom: spacing.sm, textAlign: 'center' },
  emptyMessage: { ...typography.caption, textAlign: 'center', lineHeight: 20 },
  emptyAction: { marginTop: spacing.xl },

  errorRoot: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.lg,
    padding: spacing.lg,
    margin: spacing.lg,
  },
  errorTitle: { ...typography.heading, color: colors.danger, marginBottom: spacing.xs },
  errorMessage: { ...typography.caption, color: colors.danger },

  loadingRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingLabel: { ...typography.caption, marginTop: spacing.md },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  sectionHeader: { ...typography.heading },

  screenHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  screenHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
    marginBottom: spacing.sm,
  },
  screenHeaderBack: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingRight: spacing.sm,
    marginLeft: -spacing.xs,
  },
  screenHeaderBackSpacer: { width: 1, height: 1 },
  screenHeaderBackIcon: {
    color: colors.primary,
    fontSize: 28,
    lineHeight: 28,
    fontWeight: '500',
    marginRight: 2,
  },
  screenHeaderBackLabel: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  screenHeaderAction: { marginLeft: 'auto' },
  screenHeaderTitle: { ...typography.display, fontSize: 26 },
  screenHeaderSubtitle: { ...typography.caption, marginTop: 4, lineHeight: 20 },

  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.lg,
  },
  kvLabel: { ...typography.caption, flexShrink: 0 },
  kvValue: { ...typography.bodyMedium, textAlign: 'right', flexShrink: 1 },
});
