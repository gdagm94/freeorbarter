import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Image,
  TextInput,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Application from 'expo-application';

interface UserProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  rating: number | null;
  created_at: string;
  zipcode: string | null;
  gender: string | null;
}

interface LocationData {
  label: string;
  city: string;
  state: string;
  zipcode: string;
  latitude: number;
  longitude: number;
}

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

const ACCOUNT_DELETION_REASONS = [
  { value: 'privacy_concerns', label: 'Privacy or data concerns' },
  { value: 'not_finding_value', label: 'Not finding relevant items or matches' },
  { value: 'too_many_notifications', label: 'Too many notifications' },
  { value: 'duplicate_account', label: 'I created another account accidentally' },
  { value: 'switching_platforms', label: 'I moved to a different marketplace' },
  { value: 'other', label: 'Other' },
] as const;

type AccountDeletionReason = typeof ACCOUNT_DELETION_REASONS[number]['value'];

const DEFAULT_ACCOUNT_DELETION_REASON: AccountDeletionReason =
  ACCOUNT_DELETION_REASONS[0].value;

export default function SettingsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form data
  const [formData, setFormData] = useState({
    username: '',
    gender: '',
  });
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<any>(null);
  
  // Location states
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualFormData, setManualFormData] = useState({
    city: '',
    state: '',
    zipcode: ''
  });
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState<AccountDeletionReason>(DEFAULT_ACCOUNT_DELETION_REASON);
  const [deleteReasonOther, setDeleteReasonOther] = useState('');
  const [deleteFeedback, setDeleteFeedback] = useState('');
  const [deleteAccountAcknowledged, setDeleteAccountAcknowledged] = useState(false);
  const isDeleteActionDisabled =
    deleteAccountLoading ||
    !deleteAccountAcknowledged ||
    (deleteReason === 'other' && deleteReasonOther.trim().length === 0);

  useEffect(() => {
    if (user) {
      fetchProfileData();
    }
  }, [user]);

  // Refresh data when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (user) fetchProfileData();
    });
    return unsubscribe;
  }, [navigation, user]);

  const fetchProfileData = async () => {
    if (!user) return;

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      
      setProfile(profileData);
      setFormData({
        username: profileData?.username || '',
        gender: profileData?.gender || '',
      });
      setAvatarUri(profileData?.avatar_url);

      // Pre-populate location if zipcode exists
      if (profileData?.zipcode) {
        await prePopulateLocation(profileData.zipcode);
      }

    } catch (error) {
      console.error('Error fetching profile data:', error);
      setError('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const prePopulateLocation = async (zipcode: string) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?postalcode=${zipcode}&country=usa&format=json&limit=1`
      );
      
      if (!response.ok) return;
      
      const data = await response.json();
      
      if (data && data[0]) {
        const address = data[0].address || {};
        const city = address.city || address.town || address.village || '';
        const state = address.state || '';
        
        if (city && state) {
          const location: LocationData = {
            label: `${city}, ${state}`,
            city,
            state,
            zipcode,
            latitude: parseFloat(data[0].lat),
            longitude: parseFloat(data[0].lon)
          };
          
          setSelectedLocation(location);
        }
      }
    } catch (err) {
      console.error('Error pre-populating location:', err);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleImagePicker = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant permission to access your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setAvatarUri(result.assets[0].uri);
        setAvatarFile(result.assets[0]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleDeleteAccountPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDeleteAccountError(null);
    setDeleteReason(DEFAULT_ACCOUNT_DELETION_REASON);
    setDeleteReasonOther('');
    setDeleteFeedback('');
    setDeleteAccountAcknowledged(false);
    setShowDeleteAccountModal(true);
  };

  const confirmDeleteAccount = async () => {
    if (!user || deleteAccountLoading) return;

    const formattedOtherReason = deleteReasonOther.trim();
    if (deleteReason === 'other' && formattedOtherReason.length === 0) {
      setDeleteAccountError('Please tell us a short reason for leaving.');
      return;
    }

    if (!deleteAccountAcknowledged) {
      setDeleteAccountError('Please confirm that you understand this action is permanent.');
      return;
    }

    setDeleteAccountLoading(true);
    setDeleteAccountError(null);

    const reasonPayload = deleteReason === 'other' ? formattedOtherReason : deleteReason;
    const feedbackPayload = deleteFeedback.trim();
    const appVersion = Application.nativeApplicationVersion ?? undefined;
    const buildNumber = Application.nativeBuildVersion ?? undefined;

    try {
      const { data, error: functionError } = await supabase.functions.invoke<{ success?: boolean; error?: string }>('delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          reason: reasonPayload,
          feedback: feedbackPayload.length > 0 ? feedbackPayload : undefined,
          platform: Platform.OS,
          appVersion,
          buildNumber,
          requestFollowUp: false,
        },
      });

      if (functionError) {
        throw new Error(functionError.message ?? 'Failed to delete account');
      }

      if (data && typeof data === 'object' && 'error' in data && data.error) {
        throw new Error(data.error);
      }

      await supabase.auth.signOut();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDeleteAccountAcknowledged(false);
      setShowDeleteAccountModal(false);
      navigation.reset({
        index: 0,
        routes: [{ name: 'Auth' }],
      });
      Alert.alert('Account deleted', 'Your account has been permanently removed.');
    } catch (err) {
      console.error('Error deleting account:', err);
      const message =
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred while deleting your account.';
      setDeleteAccountError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setDeleteAccountLoading(false);
    }
  };

  const closeDeleteAccountModal = () => {
    if (deleteAccountLoading) return;
    setShowDeleteAccountModal(false);
    setDeleteAccountError(null);
    setDeleteReason(DEFAULT_ACCOUNT_DELETION_REASON);
    setDeleteReasonOther('');
    setDeleteFeedback('');
    setDeleteAccountAcknowledged(false);
  };

  const handleCurrentLocation = async () => {
    setUseCurrentLocation(true);
    setIsLocating(true);
    setError(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission not granted');
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
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
    } catch (err) {
      console.error('Error getting location:', err);
      setError('Could not determine your location. Please enter it manually.');
    } finally {
      setIsLocating(false);
      setUseCurrentLocation(false);
    }
  };

  const handleManualLocationSubmit = async () => {
    const { city, state, zipcode } = manualFormData;
    
    if (!city || !state || !zipcode) {
      setError('All fields are required for manual entry');
      return;
    }

    if (!/^\d{5}(-\d{4})?$/.test(zipcode)) {
      setError('Please enter a valid ZIP code');
      return;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&postalcode=${zipcode}&country=usa&format=json`
      );
      
      const data = await response.json();
      
      const location: LocationData = {
        label: `${city}, ${state}`,
        city,
        state,
        zipcode,
        latitude: data && data[0] ? parseFloat(data[0].lat) : 0,
        longitude: data && data[0] ? parseFloat(data[0].lon) : 0
      };

      setSelectedLocation(location);
      setShowManualEntry(false);
      setManualFormData({ city: '', state: '', zipcode: '' });
      setError(null);
    } catch (err) {
      console.error('Error geocoding location:', err);
      setError('Error geocoding location. Please try again');
    }
  };

  const handleSave = async () => {
    if (!selectedLocation) {
      setError('Please select a valid location');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updateData: Record<string, any> = {};

      if (formData.username.trim()) {
        updateData.username = formData.username.trim();
      }

      if (selectedLocation) {
        updateData.zipcode = selectedLocation.zipcode;
      }

      if (formData.gender) {
        updateData.gender = formData.gender;
      }

      if (avatarFile) {
        const fileExt = avatarFile.uri.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        // Create form data for React Native
        const formData = new FormData();
        formData.append('file', {
          uri: avatarFile.uri,
          type: avatarFile.type || 'image/jpeg',
          name: fileName,
        } as any);

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, formData, {
            contentType: avatarFile.type || 'image/jpeg',
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        updateData.avatar_url = publicUrl;
      }

      if (Object.keys(updateData).length > 0) {
        updateData.profile_completed = true;

        const { error: updateError } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', user?.id);

        if (updateError) throw updateError;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Profile updated successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);

    } catch (err) {
      console.error('Error saving profile:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.goBack();
          }}
        >
          <Text style={styles.headerButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Edit Profile</Text>
        <TouchableOpacity 
          style={[styles.headerButton, styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={[styles.headerButtonText, styles.saveButtonText, saving && styles.saveButtonTextDisabled]}>
            {saving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Profile Picture Section */}
          <View style={styles.profileSection}>
            <TouchableOpacity style={styles.avatarContainer} onPress={handleImagePicker}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarIcon}>👤</Text>
                </View>
              )}
              <View style={styles.avatarEditButton}>
                <Text style={styles.avatarEditIcon}>📷</Text>
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarLabel}>Tap to change photo</Text>
          </View>

          {/* Form Fields */}
          <View style={styles.formSection}>
            {/* Username Field */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Username</Text>
              <TextInput
                style={[styles.input, !formData.username && styles.inputEmpty]}
                value={formData.username}
                onChangeText={(value) => handleInputChange('username', value)}
                placeholder="Enter your username"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Location Field */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Location</Text>
              {selectedLocation ? (
                <View style={styles.locationDisplay}>
                  <Text style={styles.locationIcon}>📍</Text>
                  <Text style={styles.locationText}>{selectedLocation.label}</Text>
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
                    style={[styles.locationOption, isLocating && styles.locationOptionDisabled]}
                    onPress={handleCurrentLocation}
                    disabled={isLocating}
                  >
                    <Text style={styles.locationOptionIcon}>📍</Text>
                    <Text style={styles.locationOptionText}>
                      {isLocating ? 'Getting location...' : 'Use current location'}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.locationOption}
                    onPress={() => setShowManualEntry(true)}
                  >
                    <Text style={styles.locationOptionIcon}>✏️</Text>
                    <Text style={styles.locationOptionText}>Enter manually</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Gender Field */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Gender</Text>
              <View style={styles.genderOptions}>
                {[
                  { value: 'male', label: 'Male', icon: '👨' },
                  { value: 'female', label: 'Female', icon: '👩' },
                  { value: '', label: 'Prefer not to say', icon: '🤐' }
                ].map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.genderOption,
                      formData.gender === option.value && styles.genderOptionSelected
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      handleInputChange('gender', option.value);
                    }}
                  >
                    <Text style={styles.genderOptionIcon}>{option.icon}</Text>
                    <Text style={[
                      styles.genderOptionText,
                      formData.gender === option.value && styles.genderOptionTextSelected
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

          </View>

          {/* Account Deletion Section */}
          <View style={styles.dangerSection}>
            <Text style={styles.dangerTitle}>Delete account</Text>
            <Text style={styles.dangerDescription}>
              Permanently delete your account and remove your listings, messages, friends, and notifications. This action cannot be undone.
            </Text>
            <TouchableOpacity
              style={[styles.dangerButton, deleteAccountLoading && styles.dangerButtonDisabled]}
              onPress={handleDeleteAccountPress}
              disabled={deleteAccountLoading}
            >
              <Text style={styles.dangerButtonText}>
                {deleteAccountLoading ? 'Processing...' : 'Delete account'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dangerLinkButton}
              onPress={() => navigation.navigate('Privacy')}
            >
              <Text style={styles.dangerLinkText}>Review our Privacy Policy</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Manual Location Entry Modal */}
      <Modal
        visible={showManualEntry}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              onPress={() => setShowManualEntry(false)}
              style={styles.modalButton}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Enter Location</Text>
            <TouchableOpacity 
              onPress={handleManualLocationSubmit}
              style={[styles.modalButton, styles.modalSaveButton]}
            >
              <Text style={[styles.modalButtonText, styles.modalSaveButtonText]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.modalField}>
              <Text style={styles.modalFieldLabel}>City</Text>
              <TextInput
                style={styles.modalInput}
                value={manualFormData.city}
                onChangeText={(value) => setManualFormData(prev => ({ ...prev, city: value }))}
                placeholder="Enter city"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalFieldLabel}>State</Text>
              <View style={styles.stateContainer}>
                {Object.entries(stateAbbreviations).map(([abbr, name]) => (
                  <TouchableOpacity
                    key={abbr}
                    style={[
                      styles.stateOption,
                      manualFormData.state === name && styles.stateOptionSelected
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setManualFormData(prev => ({ ...prev, state: name }));
                    }}
                  >
                    <Text style={[
                      styles.stateOptionText,
                      manualFormData.state === name && styles.stateOptionTextSelected
                    ]}>
                      {name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalFieldLabel}>ZIP Code</Text>
              <TextInput
                style={styles.modalInput}
                value={manualFormData.zipcode}
                onChangeText={(value) => setManualFormData(prev => ({ ...prev, zipcode: value }))}
                placeholder="12345"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Account Deletion Confirmation Modal */}
      <Modal
        visible={showDeleteAccountModal}
        animationType="fade"
        transparent
        onRequestClose={closeDeleteAccountModal}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmContainer}>
            <Text style={styles.confirmTitle}>Delete your account?</Text>
            <Text style={styles.confirmText}>
              Deleting your account permanently removes your listings, messages, friends, and notification history from Free or Barter. This action cannot be undone.
            </Text>
            <Text style={styles.confirmText}>
              You will be signed out immediately after confirming deletion.
            </Text>
          <View style={styles.confirmReasonSection}>
            <Text style={styles.confirmSectionTitle}>Why are you leaving?</Text>
            {ACCOUNT_DELETION_REASONS.map((option) => {
              const selected = deleteReason === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.confirmReasonOption,
                    selected && styles.confirmReasonOptionSelected
                  ]}
                  activeOpacity={0.8}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setDeleteReason(option.value);
                    if (option.value !== 'other') {
                      setDeleteReasonOther('');
                    }
                  }}
                >
                  <View
                    style={[
                      styles.confirmRadioOuter,
                      selected && styles.confirmRadioOuterSelected
                    ]}
                  >
                    {selected && <View style={styles.confirmRadioInner} />}
                  </View>
                  <Text
                    style={[
                      styles.confirmReasonOptionText,
                      selected && styles.confirmReasonOptionTextSelected
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {deleteReason === 'other' && (
            <View style={styles.confirmInputGroup}>
              <Text style={styles.confirmInputLabel}>Tell us a bit more</Text>
              <TextInput
                value={deleteReasonOther}
                onChangeText={setDeleteReasonOther}
                placeholder="Share a short reason"
                placeholderTextColor="#9CA3AF"
                maxLength={120}
                style={styles.confirmInput}
              />
            </View>
          )}
          <View style={styles.confirmInputGroup}>
            <Text style={styles.confirmInputLabel}>Additional feedback (optional)</Text>
            <TextInput
              value={deleteFeedback}
              onChangeText={setDeleteFeedback}
              placeholder="Anything else we should know?"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              maxLength={500}
              style={styles.confirmTextarea}
              textAlignVertical="top"
            />
            <Text style={styles.confirmHelperText}>{deleteFeedback.length}/500 characters</Text>
          </View>
          <TouchableOpacity
            style={styles.confirmAcknowledgeRow}
            activeOpacity={0.8}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setDeleteAccountAcknowledged((prev) => !prev);
            }}
          >
            <View
              style={[
                styles.confirmCheckbox,
                deleteAccountAcknowledged && styles.confirmCheckboxChecked
              ]}
            >
              {deleteAccountAcknowledged && <View style={styles.confirmCheckboxIndicator} />}
            </View>
            <Text style={styles.confirmAcknowledgeText}>
              I understand that permanently deleting my account cannot be undone.
            </Text>
          </TouchableOpacity>
            {deleteAccountError && (
              <Text style={styles.confirmError}>{deleteAccountError}</Text>
            )}
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelButton}
                onPress={closeDeleteAccountModal}
                disabled={deleteAccountLoading}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmDeleteButton,
                  (deleteAccountLoading || isDeleteActionDisabled) && styles.confirmDeleteButtonDisabled
                ]}
                onPress={confirmDeleteAccount}
                disabled={isDeleteActionDisabled}
              >
                {deleteAccountLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmDeleteText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  headerButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  headerButtonText: {
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  saveButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
  },
  saveButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  saveButtonTextDisabled: {
    color: '#9CA3AF',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    margin: 20,
    marginBottom: 0,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarIcon: {
    fontSize: 48,
    color: '#9CA3AF',
  },
  avatarEditButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#3B82F6',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarEditIcon: {
    fontSize: 18,
  },
  avatarLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  formSection: {
    paddingHorizontal: 20,
  },
  fieldContainer: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  inputEmpty: {
    borderColor: '#F3F4F6',
  },
  locationDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  locationIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  locationText: {
    flex: 1,
    fontSize: 16,
    color: '#166534',
    fontWeight: '500',
  },
  locationChangeButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  locationChangeText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '600',
  },
  locationOptions: {
    gap: 12,
  },
  locationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  locationOptionDisabled: {
    opacity: 0.6,
  },
  locationOptionIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  locationOptionText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  genderOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  genderOption: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  genderOptionSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  genderOptionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  genderOptionText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
    textAlign: 'center',
  },
  genderOptionTextSelected: {
    color: '#FFFFFF',
  },
  confirmReasonSection: {
    marginTop: 12,
    marginBottom: 12,
    gap: 8,
  },
  confirmSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  confirmReasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  confirmReasonOptionSelected: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  confirmReasonOptionText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  confirmReasonOptionTextSelected: {
    color: '#991B1B',
  },
  confirmRadioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmRadioOuterSelected: {
    borderColor: '#DC2626',
  },
  confirmRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DC2626',
  },
  confirmInputGroup: {
    marginTop: 8,
  },
  confirmInputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  confirmInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  confirmTextarea: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#FFFFFF',
    minHeight: 100,
  },
  confirmHelperText: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
  },
  confirmAcknowledgeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
    gap: 12,
  },
  confirmCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  confirmCheckboxChecked: {
    borderColor: '#DC2626',
    backgroundColor: '#FEE2E2',
  },
  confirmCheckboxIndicator: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#DC2626',
  },
  confirmAcknowledgeText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
  },
  dangerSection: {
    marginHorizontal: 20,
    marginTop: 32,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  dangerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 8,
  },
  dangerDescription: {
    fontSize: 14,
    color: '#7F1D1D',
    lineHeight: 20,
  },
  dangerButton: {
    marginTop: 16,
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  dangerButtonDisabled: {
    opacity: 0.7,
  },
  dangerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  dangerLinkButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  dangerLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1D4ED8',
    textDecorationLine: 'underline',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  modalButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  modalButtonText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  modalSaveButton: {
    backgroundColor: '#3B82F6',
  },
  modalSaveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  modalField: {
    marginBottom: 24,
  },
  modalFieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  stateContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stateOption: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderWidth: 2,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
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
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  confirmText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 8,
  },
  confirmError: {
    marginTop: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#B91C1C',
    textAlign: 'center',
  },
  confirmActions: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  confirmCancelButton: {
    flex: 1,
    marginRight: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  confirmCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  confirmDeleteButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDeleteButtonDisabled: {
    backgroundColor: '#F87171',
  },
  confirmDeleteText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
