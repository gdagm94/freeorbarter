import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';

interface PolicyAcceptanceModalProps {
  visible: boolean;
  title: string;
  content: string;
  loading?: boolean;
  onAccept: () => void;
  onReject?: () => void;
  disabled?: boolean;
}

export function PolicyAcceptanceModal({
  visible,
  title,
  content,
  loading,
  onAccept,
  onReject,
  disabled,
}: PolicyAcceptanceModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <ScrollView style={styles.content} showsVerticalScrollIndicator>
            <Text style={styles.body}>{content}</Text>
          </ScrollView>
          <Text style={styles.notice}>
            You must agree to these community guidelines to continue using FreeorBarter. Violations may result in immediate content removal or account suspension.
          </Text>
          {loading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#2563EB" />
              <Text style={styles.loadingText}>Saving your acceptance…</Text>
            </View>
          )}
          <View style={styles.actions}>
            {onReject && (
              <TouchableOpacity style={styles.secondaryButton} onPress={onReject} disabled={loading}>
                <Text style={styles.secondaryText}>Sign out</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.primaryButton, (disabled || loading) && styles.primaryButtonDisabled]}
              onPress={onAccept}
              disabled={disabled || loading}
            >
              <Text style={styles.primaryText}>I Agree</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  content: {
    maxHeight: 300,
    marginBottom: 16,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
  },
  notice: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
  },
  secondaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  primaryButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#1F2937',
  },
});


