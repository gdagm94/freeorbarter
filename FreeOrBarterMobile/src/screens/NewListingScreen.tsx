import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';

const CONDITIONS = ['new', 'like-new', 'good', 'fair', 'poor'] as const;
const TYPES = ['free', 'barter'] as const;
const CATEGORIES = [
  'Electronics',
  'Furniture', 
  'Clothing',
  'Sports & Outdoors',
  'Books & Media',
  'Home & Garden',
  'Toys & Games',
  'Other'
] as const;

export default function NewListingScreen() {
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('');
  const [condition, setCondition] = useState<typeof CONDITIONS[number]>('good');
  const [type, setType] = useState<typeof TYPES[number]>('free');
  const [location, setLocation] = useState('');
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'We need access to your photos to upload images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      selectionLimit: 5 - imageUris.length,
    });

    if (!result.canceled) {
      const uris = result.assets.map(a => a.uri).filter(Boolean) as string[];
      setImageUris(prev => [...prev, ...uris].slice(0, 5));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'We need camera access to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUris(prev => [...prev, result.assets[0].uri].slice(0, 5));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const removeImageAt = (index: number) => {
    setImageUris(prev => prev.filter((_, i) => i !== index));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const compressImage = async (uri: string): Promise<string> => {
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1280 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      return manipulated.uri;
    } catch {
      return uri;
    }
  };

  const uploadImage = async (uri: string): Promise<string> => {
    const toUpload = await compressImage(uri);
    const response = await fetch(toUpload);
    const blob = await response.blob();
    const ext = toUpload.split('.').pop() || 'jpg';
    const filePath = `mobile/${user?.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('item-images')
      .upload(filePath, blob as any, { upsert: false, contentType: blob.type || `image/${ext}` });

    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage
      .from('item-images')
      .getPublicUrl(filePath);

    return publicData.publicUrl;
  };

  const handleSubmit = async () => {
    setError(null);
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to create a listing.');
      return;
    }
    if (!title.trim() || !description.trim() || !location.trim() || !category) {
      setError('Please fill in all required fields.');
      return;
    }
    if (imageUris.length === 0) {
      setError('Please add at least one image.');
      return;
    }

    setSubmitting(true);
    try {
      const uploadedUrls: string[] = [];
      for (const uri of imageUris) {
        const url = await uploadImage(uri);
        uploadedUrls.push(url);
      }

      const { error: insertError } = await supabase
        .from('items')
        .insert([
          {
            title: title.trim(),
            description: description.trim(),
            images: uploadedUrls,
            condition,
            category: category.toLowerCase(),
            user_id: user.id,
            location: location.trim(),
            status: 'available',
            type,
          },
        ]);

      if (insertError) throw insertError;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Success! 🎉', 
        'Your item has been listed successfully.',
        [{ text: 'OK', onPress: resetForm }]
      );
    } catch (err: any) {
      console.error('Error creating listing:', err);
      setError(err?.message || 'Failed to create listing.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('');
    setCondition('good');
    setType('free');
    setLocation('');
    setImageUris([]);
    setError(null);
  };

  const showImageOptions = () => {
    Alert.alert(
      'Add Photos',
      'Choose how you want to add photos',
      [
        { text: 'Camera', onPress: takePhoto },
        { text: 'Photo Library', onPress: pickImages },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Create Listing</Text>
          <Text style={styles.subtitle}>Share something amazing</Text>
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          )}

          {/* Type Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What type of listing?</Text>
            <View style={styles.typeSelector}>
              {TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeOption, type === t && styles.typeOptionSelected]}
                  onPress={() => {
                    setType(t);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.typeEmoji}>
                    {t === 'free' ? '🎁' : '🔄'}
                  </Text>
                  <Text style={[
                    styles.typeText, 
                    type === t && styles.typeTextSelected
                  ]}>
                    {t === 'free' ? 'Free' : 'Barter'}
                  </Text>
                  <Text style={[
                    styles.typeDescription,
                    type === t && styles.typeDescriptionSelected
                  ]}>
                    {t === 'free' ? 'Give it away' : 'Trade for something'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Photos Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos ({imageUris.length}/5)</Text>
            <View style={styles.photosContainer}>
              {imageUris.map((uri, index) => (
                <View key={uri} style={styles.photoWrapper}>
                  <Image source={{ uri }} style={styles.photo} />
                  <TouchableOpacity 
                    style={styles.removePhoto} 
                    onPress={() => removeImageAt(index)}
                  >
                    <Text style={styles.removePhotoText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {imageUris.length < 5 && (
                <TouchableOpacity 
                  style={styles.addPhoto} 
                  onPress={showImageOptions}
                  activeOpacity={0.8}
                >
                  <Text style={styles.addPhotoText}>📷</Text>
                  <Text style={styles.addPhotoLabel}>Add Photo</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Basic Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="What are you sharing?"
                placeholderTextColor="#94A3B8"
                maxLength={100}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Describe your item, its condition, and any important details..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={4}
                maxLength={500}
                textAlignVertical="top"
              />
              <Text style={styles.characterCount}>
                {description.length}/500
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Location *</Text>
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="City, State"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          {/* Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Item Details</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Category *</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScroll}
              >
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryChip,
                      category === cat && styles.categoryChipSelected
                    ]}
                    onPress={() => {
                      setCategory(cat);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[
                      styles.categoryText,
                      category === cat && styles.categoryTextSelected
                    ]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Condition</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.conditionScroll}
              >
                {CONDITIONS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.conditionChip,
                      condition === c && styles.conditionChipSelected
                    ]}
                    onPress={() => {
                      setCondition(c);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[
                      styles.conditionText,
                      condition === c && styles.conditionTextSelected
                    ]}>
                      {c.replace('-', ' ').toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.8}
          >
            <Text style={styles.submitText}>
              {submitting ? '🚀 Creating...' : '✨ Create Listing'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  typeOption: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  typeOptionSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  typeEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  typeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  typeTextSelected: {
    color: '#1E40AF',
  },
  typeDescription: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  typeDescriptionSelected: {
    color: '#3730A3',
  },
  photosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoWrapper: {
    width: 80,
    height: 80,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  removePhoto: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#EF4444',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  removePhotoText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  addPhoto: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  addPhotoText: {
    fontSize: 24,
    marginBottom: 4,
  },
  addPhotoLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'right',
    marginTop: 4,
  },
  categoryScroll: {
    paddingRight: 20,
  },
  categoryChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
  },
  categoryChipSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  categoryTextSelected: {
    color: '#FFFFFF',
  },
  conditionScroll: {
    paddingRight: 20,
  },
  conditionChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  conditionChipSelected: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  conditionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  conditionTextSelected: {
    color: '#FFFFFF',
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  submitDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0.1,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});