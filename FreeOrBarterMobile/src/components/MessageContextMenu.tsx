import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
} from 'react-native';

interface MessageContextMenuProps {
  visible: boolean;
  onClose: () => void;
  onReact: () => void;
  onReply: () => void;
  messageId: string;
  onReport?: () => void;
}

export function MessageContextMenu({
  visible,
  onClose,
  onReact,
  onReply,
  onReport,
  messageId,
}: MessageContextMenuProps) {
  const handleOptionPress = (callback: () => void) => {
    callback();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />
        <View style={styles.menu}>
          <View style={styles.header}>
            <Text style={styles.title}>Message Options</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.options}>
            <TouchableOpacity
              style={styles.option}
              onPress={() => handleOptionPress(onReact)}
            >
              <View style={styles.optionIcon}>
                <Text style={styles.optionIconText}>😊</Text>
              </View>
              <Text style={styles.optionLabel}>React</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.option}
              onPress={() => handleOptionPress(onReply)}
            >
              <View style={styles.optionIcon}>
                <Text style={styles.optionIconText}>↩️</Text>
              </View>
              <Text style={styles.optionLabel}>Reply</Text>
            </TouchableOpacity>

            {onReport && (
              <TouchableOpacity
                style={[styles.option, styles.dangerOption]}
                onPress={() => handleOptionPress(onReport)}
              >
                <View style={styles.optionIcon}>
                  <Text style={styles.optionIconText}>⚑</Text>
                </View>
                <View style={styles.optionTextGroup}>
                  <Text style={[styles.optionLabel, styles.dangerText]}>Report</Text>
                  <Text style={styles.optionHelper}>Flag messages that break the rules</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  menu: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34, // Safe area for home indicator
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  closeButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '600',
  },
  options: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    marginBottom: 8,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  optionIconText: {
    fontSize: 20,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1E293B',
  },
  optionTextGroup: {
    flex: 1,
  },
  optionHelper: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  dangerOption: {
    backgroundColor: '#FEF2F2',
  },
  dangerText: {
    color: '#B91C1C',
  },
});
