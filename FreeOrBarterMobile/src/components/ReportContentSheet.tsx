import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  REPORT_CATEGORIES,
  ReportTargetType,
  submitReport,
} from '../lib/reports';

export interface ReportTargetPayload {
  type: ReportTargetType;
  id: string;
  displayName?: string;
  metadata?: Record<string, unknown>;
}

interface ReportContentSheetProps {
  visible: boolean;
  target: ReportTargetPayload | null;
  onClose: () => void;
}

const TARGET_LABELS: Record<ReportTargetType, string> = {
  item: 'item',
  user: 'user',
  message: 'message',
  comment: 'comment',
  other: 'content',
};

export function ReportContentSheet({
  visible,
  target,
  onClose,
}: ReportContentSheetProps) {
  const [selectedCategory, setSelectedCategory] = useState(
    REPORT_CATEGORIES[0].value,
  );
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedCategory(REPORT_CATEGORIES[0].value);
      setDetails('');
      setSubmitting(false);
    }
  }, [visible, target?.id]);

  const friendlyName = useMemo(() => {
    if (!target) {
      return 'content';
    }
    return target.displayName || TARGET_LABELS[target.type] || 'content';
  }, [target]);

  const handleSubmit = async () => {
    if (!target || submitting) return;

    try {
      setSubmitting(true);
      await submitReport({
        targetType: target.type,
        targetId: target.id,
        category: selectedCategory,
        description: details.trim() || undefined,
        metadata: target.metadata,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Report submitted',
        'Thanks for letting us know. Our team reviews every report within 24 hours.',
      );
      onClose();
    } catch (err) {
      console.error('Error submitting report', err);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Could not submit report',
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible && !!target}
      animationType="slide"
      transparent
      onRequestClose={() => {
        if (!submitting) onClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => {
            if (!submitting) onClose();
          }}
        />
        <View style={styles.sheet}>
          <ScrollView
            contentContainerStyle={styles.sheetContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.dragHandle} />
            <Text style={styles.title}>Report {friendlyName}</Text>
            <Text style={styles.subtitle}>
              Choose the best reason below. Reports are reviewed within 24 hours
              and violating content is removed immediately.
            </Text>

            <View style={styles.categoryList}>
              {REPORT_CATEGORIES.map((option) => {
                const isActive = selectedCategory === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.categoryItem,
                      isActive && styles.categoryItemActive,
                    ]}
                    disabled={submitting}
                    onPress={() => setSelectedCategory(option.value)}
                  >
                    <View
                      style={[
                        styles.radio,
                        isActive && styles.radioActive,
                      ]}
                    />
                    <Text
                      style={[
                        styles.categoryLabel,
                        isActive && styles.categoryLabelActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.inputLabel}>Additional details</Text>
            <Text style={styles.inputHelper}>
              Sharing context (links, usernames, dates) helps moderators act
              faster.
            </Text>
            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={4}
              value={details}
              onChangeText={setDetails}
              editable={!submitting}
              placeholder="Describe what happened (optional)"
              maxLength={500}
            />
            <Text style={styles.counter}>{details.length}/500</Text>

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.cancelButton}
                disabled={submitting}
                onPress={() => {
                  if (!submitting) onClose();
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  submitting && styles.submitButtonDisabled,
                ]}
                disabled={submitting}
                onPress={handleSubmit}
              >
                <Text style={styles.submitText}>
                  {submitting ? 'Submitting…' : 'Submit report'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.disclaimer}>
              False reports or misuse of this tool can lead to account removal.
            </Text>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 24,
    maxHeight: '90%',
  },
  sheetContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  dragHandle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    backgroundColor: '#CBD5F5',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 20,
  },
  categoryList: {
    gap: 12,
    marginBottom: 20,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  categoryItemActive: {
    borderColor: '#3B82F6',
    backgroundColor: '#DBEAFE',
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#CBD5F5',
    marginRight: 12,
  },
  radioActive: {
    borderColor: '#2563EB',
    backgroundColor: '#2563EB',
  },
  categoryLabel: {
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '500',
  },
  categoryLabelActive: {
    color: '#1D4ED8',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  inputHelper: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
  },
  textArea: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 14,
    fontSize: 15,
    minHeight: 120,
    textAlignVertical: 'top',
    backgroundColor: '#FFFFFF',
  },
  counter: {
    alignSelf: 'flex-end',
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  submitButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  submitText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  disclaimer: {
    marginTop: 12,
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
});


