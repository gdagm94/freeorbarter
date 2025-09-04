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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';

const CONDITIONS = ['new', 'like-new', 'good', 'fair', 'poor'] as const;
const TYPES = ['free', 'barter'] as const;

export default function NewListingScreen() {
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [condition, setCondition] = useState<typeof CONDITIONS[number]>('good');
  const [type, setType] = useState<typeof TYPES[number]>('free');
  const [location, setLocation] = useState('');
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'We need access to your photos to upload images.');
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
    }
  };

  const removeImageAt = (index: number) => {
    setImageUris(prev => prev.filter((_, i) => i !== index));
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
      Alert.alert('Sign in required', 'Please sign in to create a listing.');
      return;
    }
    if (!title.trim() || !description.trim() || !location.trim()) {
      setError('Please fill title, description, and location.');
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
            category: category || 'General',
            user_id: user.id,
            location: location.trim(),
            status: 'available',
            type,
          },
        ]);

      if (insertError) throw insertError;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Your item has been listed.');
      // Reset form
      setTitle('');
      setDescription('');
      setCategory('General');
      setCondition('good');
      setType('free');
      setLocation('');
      setImageUris([]);
    } catch (err: any) {
      console.error('Error creating listing:', err);
      setError(err?.message || 'Failed to create listing.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <Text style={styles.title}>Add New Item</Text>
      </View>

      <View style={styles.form}>
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="What are you giving away or trading?"
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe the item, condition, and details"
          multiline
          numberOfLines={4}
        />

        <Text style={styles.label}>Condition</Text>
        <View style={styles.choicesRow}>
          {CONDITIONS.map(c => (
            <TouchableOpacity
              key={c}
              style={[styles.choiceButton, condition === c && styles.choiceSelected]}
              onPress={() => setCondition(c)}
            >
              <Text style={[styles.choiceText, condition === c && styles.choiceTextSelected]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Type</Text>
        <View style={styles.choicesRow}>
          {TYPES.map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.choiceButton, type === t && styles.choiceSelected]}
              onPress={() => setType(t)}
            >
              <Text style={[styles.choiceText, type === t && styles.choiceTextSelected]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Category</Text>
        <TextInput
          style={styles.input}
          value={category}
          onChangeText={setCategory}
          placeholder="Category (e.g., Electronics)"
        />

        <Text style={styles.label}>Location</Text>
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="City, State"
        />

        <Text style={styles.label}>Photos</Text>
        <View style={styles.imagesRow}>
          {imageUris.map((uri, index) => (
            <View key={uri} style={styles.imageWrapper}>
              <Image source={{ uri }} style={styles.image} />
              <TouchableOpacity style={styles.removeImage} onPress={() => removeImageAt(index)}>
                <Text style={styles.removeImageText}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
          {imageUris.length < 5 && (
            <TouchableOpacity style={styles.addImage} onPress={pickImages}>
              <Text style={styles.addImageText}>+</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitText}>{submitting ? 'Submitting...' : 'Create Listing'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  form: {
    padding: 16,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    color: '#B91C1C',
  },
  label: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textarea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  choicesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  choiceSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  choiceText: {
    color: '#374151',
    fontSize: 14,
  },
  choiceTextSelected: {
    color: '#FFFFFF',
  },
  imagesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  imageWrapper: {
    width: 80,
    height: 80,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  removeImage: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#EF4444',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  addImageText: {
    fontSize: 28,
    color: '#6B7280',
    lineHeight: 28,
  },
  submitButton: {
    marginTop: 20,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  submitDisabled: {
    backgroundColor: '#93C5FD',
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
