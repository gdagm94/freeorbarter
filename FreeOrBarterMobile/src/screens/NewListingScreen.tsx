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
  Dimensions,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
// No FileSystem import needed for this approach
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import { checkContent } from '../lib/contentFilter';

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

const stateAbbreviations: { [key: string]: string } = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
  'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
  'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
  'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
  'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
  'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
  'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
  'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
  'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
  'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
  'WI': 'Wisconsin', 'WY': 'Wyoming'
};

interface LocationData {
  label: string;
  city: string;
  state: string;
  zipcode: string;
  latitude: number;
  longitude: number;
}

export default function NewListingScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('');
  const [condition, setCondition] = useState<typeof CONDITIONS[number]>('good');
  const [type, setType] = useState<typeof TYPES[number]>('free');
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Success/Error modal states
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [createdItemId, setCreatedItemId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Location states
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualFormData, setManualFormData] = useState({
    city: '',
    state: '',
    zipcode: ''
  });

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

  const getCurrentLocation = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsLocating(true);
      setError(null);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'We need location access to use your current location.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
      );
      
      if (!response.ok) throw new Error('Failed to get location details');
      
      const data = await response.json();
      const address = data.address || {};
      
      const city = address.city || address.town || address.village || '';
      const state = address.state || '';
      const zipcode = address.postcode || '';
      
      if (!city || !state) {
        throw new Error('Could not determine your location');
      }

      const locationData: LocationData = {
        label: `${city}, ${state}`,
        city,
        state,
        zipcode,
        latitude,
        longitude
      };

      setSelectedLocation(locationData);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Error getting location:', err);
      setError('Could not determine your location. Please enter it manually.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLocating(false);
    }
  };

  const handleManualLocationSubmit = () => {
    const { city, state, zipcode } = manualFormData;
    
    if (!city || !state || !zipcode) {
      setError('All fields are required for manual entry');
      return;
    }

    if (!/^\d{5}(-\d{4})?$/.test(zipcode)) {
      setError('Please enter a valid ZIP code');
      return;
    }

    const locationData: LocationData = {
      label: `${city}, ${state}`,
      city,
      state,
      zipcode,
      latitude: 0, // Will be geocoded if needed
      longitude: 0
    };

    setSelectedLocation(locationData);
    setShowManualEntry(false);
    setManualFormData({ city: '', state: '', zipcode: '' });
    setError(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    const ext = toUpload.split('.').pop() || 'jpg';
    const filePath = `mobile/${user?.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    // Create a FormData object for the upload
    const formData = new FormData();
    formData.append('file', {
      uri: toUpload,
      type: `image/${ext}`,
      name: `image.${ext}`,
    } as any);

    // Upload using Supabase storage with FormData
    const { error: uploadError } = await supabase.storage
      .from('item-images')
      .upload(filePath, formData, { upsert: false, contentType: `image/${ext}` });

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
    if (!title.trim() || !description.trim() || !selectedLocation || !category) {
      setError('Please fill in all required fields.');
      return;
    }
    if (imageUris.length === 0) {
      setError('Please add at least one image.');
      return;
    }

    setSubmitting(true);
    try {
      // Check content filtering for title
      const titleFilterResult = await checkContent({
        content: title.trim(),
        contentType: 'item_title',
      });

      if (titleFilterResult.blocked) {
        Alert.alert(
          'Content Not Allowed',
          titleFilterResult.message || 'Your title contains inappropriate content and cannot be posted.'
        );
        setSubmitting(false);
        return;
      }

      if (titleFilterResult.warned) {
        const proceed = await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Content Warning',
            titleFilterResult.message || 'Your title may contain inappropriate content. Do you want to proceed?',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Proceed', onPress: () => resolve(true) },
            ]
          );
        });

        if (!proceed) {
          setSubmitting(false);
          return;
        }
      }

      // Check content filtering for description
      const descriptionFilterResult = await checkContent({
        content: description.trim(),
        contentType: 'item_description',
      });

      if (descriptionFilterResult.blocked) {
        Alert.alert(
          'Content Not Allowed',
          descriptionFilterResult.message || 'Your description contains inappropriate content and cannot be posted.'
        );
        setSubmitting(false);
        return;
      }

      if (descriptionFilterResult.warned) {
        const proceed = await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Content Warning',
            descriptionFilterResult.message || 'Your description may contain inappropriate content. Do you want to proceed?',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Proceed', onPress: () => resolve(true) },
            ]
          );
        });

        if (!proceed) {
          setSubmitting(false);
          return;
        }
      }

      const uploadedUrls: string[] = [];
      for (const uri of imageUris) {
        const url = await uploadImage(uri);
        uploadedUrls.push(url);
      }

      const { data: insertData, error: insertError } = await supabase
        .from('items')
        .insert([
          {
            title: title.trim(),
            description: description.trim(),
            images: uploadedUrls,
            condition,
            category: category.toLowerCase(),
            user_id: user.id,
            location: selectedLocation.label,
            latitude: selectedLocation.latitude,
            longitude: selectedLocation.longitude,
            status: 'available',
            type,
          },
        ])
        .select('id')
        .single();

      if (insertError) throw insertError;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCreatedItemId(insertData.id);
      setShowSuccessModal(true);
    } catch (err: any) {
      console.error('Error creating listing:', err);
      setErrorMessage(err?.message || 'Failed to create listing.');
      setShowErrorModal(true);
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
    setSelectedLocation(null);
    setImageUris([]);
    setError(null);
    setShowManualEntry(false);
    setManualFormData({ city: '', state: '', zipcode: '' });
    setShowSuccessModal(false);
    setShowErrorModal(false);
    setCreatedItemId(null);
    setErrorMessage(null);
  };

  const handleViewListing = () => {
    if (createdItemId) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Navigate to ItemDetails and then to Home tab to ensure proper navigation stack
      navigation.navigate('ItemDetails', { itemId: createdItemId });
      // Navigate to Home tab after a brief delay to ensure ItemDetails loads
      setTimeout(() => {
        navigation.navigate('Tabs', { screen: 'Home' });
      }, 100);
    }
  };

  const handleUploadAnother = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetForm();
    // Navigate back to Home tab so user can access all tabs
    navigation.navigate('Tabs', { screen: 'Home' });
  };

  const handleTryAgain = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowErrorModal(false);
    setErrorMessage(null);
  };

  const handleCancelUpload = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetForm();
    navigation.goBack();
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
          <View style={styles.headerContent}>
            <Text style={styles.title}>Create Listing</Text>
            <Text style={styles.subtitle}>Share something amazing with your community</Text>
          </View>
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          )}

          {/* Step 1: Photos First */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📸 Photos</Text>
              <Text style={styles.sectionSubtitle}>{imageUris.length}/5 photos</Text>
            </View>
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
                  <Text style={styles.addPhotoIcon}>📷</Text>
                  <Text style={styles.addPhotoLabel}>Add Photo</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Step 2: Listing Type */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🎯 Listing Type</Text>
              <Text style={styles.sectionSubtitle}>How do you want to share this item?</Text>
            </View>
            <View style={styles.typeSelector}>
              {TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeOption, type === t && styles.typeOptionSelected]}
                  onPress={() => {
                    setType(t);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

          {/* Step 3: Basic Information */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📝 Basic Information</Text>
              <Text style={styles.sectionSubtitle}>Tell us about your item</Text>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Title *</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputIcon}>📝</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="What are you sharing?"
                  placeholderTextColor="#9CA3AF"
                  maxLength={100}
                />
              </View>
              <Text style={styles.characterCount}>
                {title.length}/100
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description *</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputIcon}>📄</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Describe your item, its condition, and any important details..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                  textAlignVertical="top"
                />
              </View>
              <Text style={styles.characterCount}>
                {description.length}/500
              </Text>
            </View>
          </View>

          {/* Step 4: Item Details */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🏷️ Item Details</Text>
              <Text style={styles.sectionSubtitle}>Help others find your item</Text>
            </View>
            
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

          {/* Step 5: Location */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📍 Location</Text>
              <Text style={styles.sectionSubtitle}>Where is this item located?</Text>
            </View>
            
            {selectedLocation ? (
              <View style={styles.locationCard}>
                <Text style={styles.locationIcon}>📍</Text>
                <View style={styles.locationInfo}>
                  <Text style={styles.locationLabel}>Selected Location</Text>
                  <Text style={styles.locationText}>{selectedLocation.label}</Text>
                </View>
                <TouchableOpacity 
                  style={styles.locationChangeButton}
                  onPress={() => setSelectedLocation(null)}
                >
                  <Text style={styles.locationChangeText}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.locationOptions}>
                <TouchableOpacity 
                  style={styles.locationOption}
                  onPress={getCurrentLocation}
                  disabled={isLocating}
                  activeOpacity={0.8}
                >
                  <Text style={styles.locationOptionIcon}>📍</Text>
                  <Text style={styles.locationOptionText}>
                    {isLocating ? 'Getting location...' : 'Use my current location'}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.locationOption}
                  onPress={() => setShowManualEntry(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.locationOptionIcon}>✏️</Text>
                  <Text style={styles.locationOptionText}>Enter manually</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Step 6: Submit */}
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={submitting || !selectedLocation}
            activeOpacity={0.8}
          >
            <Text style={styles.submitIcon}>
              {submitting ? '🚀' : '✨'}
            </Text>
            <Text style={styles.submitText}>
              {submitting ? 'Creating Listing...' : 'Create Listing'}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Manual Location Entry Modal */}
        <Modal
          visible={showManualEntry}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowManualEntry(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Enter Location</Text>
                <TouchableOpacity 
                  onPress={() => setShowManualEntry(false)}
                  style={styles.modalCloseButton}
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.modalContent}>
                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>City *</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={manualFormData.city}
                    onChangeText={(text) => setManualFormData(prev => ({ ...prev, city: text }))}
                    placeholder="Enter city name"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                
                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>State *</Text>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.stateContainer}
                  >
                    {Object.entries(stateAbbreviations).map(([abbr, name]) => (
                      <TouchableOpacity
                        key={abbr}
                        style={[
                          styles.stateOption,
                          manualFormData.state === name && styles.stateOptionSelected
                        ]}
                        onPress={() => setManualFormData(prev => ({ ...prev, state: name }))}
                        activeOpacity={0.8}
                      >
                        <Text style={[
                          styles.stateOptionText,
                          manualFormData.state === name && styles.stateOptionTextSelected
                        ]}>
                          {name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                
                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>ZIP Code *</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={manualFormData.zipcode}
                    onChangeText={(text) => setManualFormData(prev => ({ ...prev, zipcode: text }))}
                    placeholder="12345"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>
              </ScrollView>
              
              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={styles.modalCancelButton}
                  onPress={() => setShowManualEntry(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.modalSaveButton}
                  onPress={handleManualLocationSubmit}
                >
                  <Text style={styles.modalSaveText}>Save Location</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Success Modal */}
        <Modal
          visible={showSuccessModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowSuccessModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowSuccessModal(false)}
          >
            <TouchableOpacity
              style={styles.successModal}
              activeOpacity={1}
              onPress={() => {}} // Prevent modal from closing when tapping inside
            >
              <View style={styles.successIconContainer}>
                <Text style={styles.successIcon}>🎉</Text>
              </View>
              <Text style={styles.successTitle}>Listing Created Successfully!</Text>
              <Text style={styles.successMessage}>
                Your item has been listed and is now visible to the community.
              </Text>
              <View style={styles.successButtons}>
                <TouchableOpacity
                  style={styles.successPrimaryButton}
                  onPress={handleViewListing}
                  activeOpacity={0.8}
                >
                  <Text style={styles.successPrimaryButtonText}>View My Listing</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.successSecondaryButton}
                  onPress={handleUploadAnother}
                  activeOpacity={0.8}
                >
                  <Text style={styles.successSecondaryButtonText}>Upload Another Item</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* Error Modal */}
        <Modal
          visible={showErrorModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowErrorModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowErrorModal(false)}
          >
            <TouchableOpacity
              style={styles.errorModal}
              activeOpacity={1}
              onPress={() => {}} // Prevent modal from closing when tapping inside
            >
              <View style={styles.errorIconContainer}>
                <Text style={styles.errorIcon}>⚠️</Text>
              </View>
              <Text style={styles.errorTitle}>Upload Failed</Text>
              <Text style={styles.errorMessage}>
                {errorMessage || 'Something went wrong while creating your listing.'}
              </Text>
              <View style={styles.errorButtons}>
                <TouchableOpacity
                  style={styles.errorPrimaryButton}
                  onPress={handleTryAgain}
                  activeOpacity={0.8}
                >
                  <Text style={styles.errorPrimaryButtonText}>Try Again</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.errorSecondaryButton}
                  onPress={handleCancelUpload}
                  activeOpacity={0.8}
                >
                  <Text style={styles.errorSecondaryButtonText}>Cancel Upload</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');

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
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerContent: {
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    paddingBottom: 40,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 16,
  },
  typeOption: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  typeOptionSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  typeEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  typeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 4,
  },
  typeTextSelected: {
    color: '#1E40AF',
  },
  typeDescription: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 16,
  },
  typeDescriptionSelected: {
    color: '#3730A3',
  },
  photosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  photoWrapper: {
    width: 100,
    height: 100,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  removePhoto: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#EF4444',
    width: 28,
    height: 28,
    borderRadius: 14,
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
    fontSize: 16,
    fontWeight: 'bold',
  },
  addPhoto: {
    width: 100,
    height: 100,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  addPhotoIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  addPhotoLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  inputIcon: {
    fontSize: 18,
    marginRight: 12,
    color: '#6B7280',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 8,
    fontWeight: '500',
  },
  categoryScroll: {
    paddingRight: 24,
  },
  categoryChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  categoryChipSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  categoryTextSelected: {
    color: '#FFFFFF',
  },
  conditionScroll: {
    paddingRight: 24,
  },
  conditionChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  conditionChipSelected: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  conditionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  conditionTextSelected: {
    color: '#FFFFFF',
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 2,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  locationIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 14,
    color: '#166534',
    fontWeight: '500',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 16,
    color: '#166534',
    fontWeight: '600',
  },
  locationChangeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  locationChangeText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '600',
  },
  locationOptions: {
    gap: 16,
  },
  locationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  locationOptionIcon: {
    fontSize: 20,
    marginRight: 16,
    color: '#6B7280',
  },
  locationOptionText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  submitDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0.1,
  },
  submitIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  modalField: {
    marginBottom: 24,
  },
  modalFieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  modalInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  stateContainer: {
    paddingRight: 24,
  },
  stateOption: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  stateOptionSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  stateOptionText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  stateOptionTextSelected: {
    color: '#FFFFFF',
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // Success Modal styles
  successModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    margin: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successIcon: {
    fontSize: 40,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  successButtons: {
    width: '100%',
    gap: 12,
  },
  successPrimaryButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  successPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  successSecondaryButton: {
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  successSecondaryButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  // Error Modal styles
  errorModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    margin: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  errorIcon: {
    fontSize: 40,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  errorButtons: {
    width: '100%',
    gap: 12,
  },
  errorPrimaryButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  errorPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorSecondaryButton: {
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  errorSecondaryButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
});