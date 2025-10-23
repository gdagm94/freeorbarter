import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import * as Haptics from 'expo-haptics';

interface OfferTemplate {
  id: string;
  title: string;
  content: string;
  created_at: string;
  usage_count: number;
}

interface OfferTemplatesProps {
  visible: boolean;
  onTemplateSelect: (template: OfferTemplate) => void;
  onClose: () => void;
}

export function OfferTemplates({ visible, onTemplateSelect, onClose }: OfferTemplatesProps) {
  const [templates, setTemplates] = useState<OfferTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [newTemplateContent, setNewTemplateContent] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    if (visible && user) {
      fetchTemplates();
    }
  }, [visible, user]);

  const fetchTemplates = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('offer_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('usage_count', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTemplate = async () => {
    if (!user) return;
    if (!newTemplateTitle.trim() || !newTemplateContent.trim()) {
      Alert.alert('Error', 'Please fill in both title and content');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('offer_templates')
        .insert([{
          title: newTemplateTitle.trim(),
          content: newTemplateContent.trim(),
          user_id: user.id,
          usage_count: 0,
        }])
        .select()
        .single();

      if (error) throw error;

      setTemplates(prev => [data, ...prev]);
      setNewTemplateTitle('');
      setNewTemplateContent('');
      setShowCreateTemplate(false);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error creating template:', error);
      Alert.alert('Error', 'Failed to create template');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const selectTemplate = (template: OfferTemplate) => {
    onTemplateSelect(template);
    onClose();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const renderTemplate = ({ item }: { item: OfferTemplate }) => (
    <TouchableOpacity
      style={styles.templateItem}
      onPress={() => selectTemplate(item)}
    >
      <View style={styles.templateHeader}>
        <Text style={styles.templateTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.usageCount}>
          Used {item.usage_count} times
        </Text>
      </View>
      <Text style={styles.templateContent} numberOfLines={3}>
        {item.content}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Offer Templates</Text>
            <View style={styles.headerButtons}>
              <TouchableOpacity
                style={styles.createButton}
                onPress={() => setShowCreateTemplate(true)}
              >
                <Text style={styles.createButtonText}>+</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          <FlatList
            data={templates}
            renderItem={renderTemplate}
            keyExtractor={(item) => item.id}
            style={styles.templateList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No templates yet</Text>
                <Text style={styles.emptySubtext}>
                  Create your first offer template
                </Text>
              </View>
            }
          />

          {/* Create Template Modal */}
          <Modal
            visible={showCreateTemplate}
            transparent
            animationType="slide"
            onRequestClose={() => setShowCreateTemplate(false)}
          >
            <View style={styles.overlay}>
              <View style={styles.createContainer}>
                <View style={styles.createHeader}>
                  <Text style={styles.createTitle}>Create Template</Text>
                  <TouchableOpacity
                    onPress={() => setShowCreateTemplate(false)}
                    style={styles.closeButton}
                  >
                    <Text style={styles.closeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.createContent}>
                  <Text style={styles.label}>Title</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Template title"
                    value={newTemplateTitle}
                    onChangeText={setNewTemplateTitle}
                    maxLength={50}
                  />

                  <Text style={styles.label}>Content</Text>
                  <TextInput
                    style={[styles.input, styles.contentInput]}
                    placeholder="Template content"
                    value={newTemplateContent}
                    onChangeText={setNewTemplateContent}
                    multiline
                    numberOfLines={4}
                    maxLength={500}
                  />

                  <View style={styles.createButtons}>
                    <TouchableOpacity
                      style={[styles.button, styles.cancelButton]}
                      onPress={() => setShowCreateTemplate(false)}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.button, styles.saveButton]}
                      onPress={createTemplate}
                    >
                      <Text style={styles.saveButtonText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '90%',
    height: '80%',
    maxWidth: 500,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212529',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  createButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#28a745',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  createButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#6c757d',
  },
  templateList: {
    flex: 1,
    padding: 16,
  },
  templateItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  templateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    flex: 1,
  },
  usageCount: {
    fontSize: 12,
    color: '#6c757d',
  },
  templateContent: {
    fontSize: 14,
    color: '#495057',
    lineHeight: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6c757d',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#adb5bd',
    textAlign: 'center',
  },
  createContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  createHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  createTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212529',
  },
  createContent: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212529',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  contentInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  createButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
    marginRight: 8,
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#28a745',
    marginLeft: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});
