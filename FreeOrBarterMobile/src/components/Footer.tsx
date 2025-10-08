import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Linking,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

export default function Footer() {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [subscribeSuccess, setSubscribeSuccess] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  const handleSubscribe = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setSubscribing(true);
    
    try {
      const { error } = await supabase
        .from('newsletter_subscribers')
        .insert([{ email: email.trim() }]);

      if (error) throw error;
      setSubscribeSuccess(true);
      setEmail('');
      setTimeout(() => setSubscribeSuccess(false), 5000);
    } catch (err: any) {
      console.error('Error subscribing to newsletter:', err);
      Alert.alert('Error', 'Failed to subscribe. Please try again.');
    } finally {
      setSubscribing(false);
    }
  };

  const openURL = async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Error', `Cannot open URL: ${url}`);
    }
  };

  return (
    <View style={styles.footer}>
      {/* Brand Section */}
      <View style={styles.section}>
        <View style={styles.brandContainer}>
          <Text style={styles.brandEmoji}>📊</Text>
          <Text style={styles.brandName}>FreeorBarter</Text>
        </View>
        <Text style={styles.brandDescription}>
          FreeorBarter is a community marketplace where you can give away items you no longer need
          or trade them with others. Join us in reducing waste and building connections through
          sharing.
        </Text>
      </View>

      {/* Quick Links */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Links</Text>
        <View style={styles.linksContainer}>
          <TouchableOpacity 
            style={styles.linkButton}
            onPress={() => navigation.navigate('About')}
          >
            <Text style={styles.linkText}>About Us</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.linkButton}
            onPress={() => navigation.navigate('Terms')}
          >
            <Text style={styles.linkText}>Terms of Service</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.linkButton}
            onPress={() => navigation.navigate('Privacy')}
          >
            <Text style={styles.linkText}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Contact */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact Us</Text>
        <TouchableOpacity 
          style={styles.contactButton}
          onPress={() => openURL('mailto:support@freeorbarter.com')}
        >
          <Text style={styles.contactIcon}>📧</Text>
          <Text style={styles.contactText}>support@freeorbarter.com</Text>
        </TouchableOpacity>
      </View>

      {/* Newsletter */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Stay Updated</Text>
        {subscribeSuccess ? (
          <View style={styles.successContainer}>
            <Text style={styles.successText}>Thanks for subscribing! 🎉</Text>
          </View>
        ) : (
          <>
            <Text style={styles.newsletterDescription}>
              Subscribe to our newsletter for updates and new features.
            </Text>
            <View style={styles.subscribeContainer}>
              <TextInput
                style={styles.emailInput}
                placeholder="Enter your email"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[styles.subscribeButton, subscribing && styles.subscribeButtonDisabled]}
                onPress={handleSubscribe}
                disabled={subscribing}
              >
                <Text style={styles.subscribeButtonText}>
                  {subscribing ? 'Subscribing...' : 'Subscribe'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Social Media */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Follow Us</Text>
        <View style={styles.socialContainer}>
          <TouchableOpacity
            style={styles.socialButton}
            onPress={() => openURL('https://instagram.com/freeorbarter')}
          >
            <Text style={styles.socialIcon}>📷</Text>
            <Text style={styles.socialText}>Instagram</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.socialButton}
            onPress={() => openURL('https://facebook.com/freeorbarter')}
          >
            <Text style={styles.socialIcon}>👥</Text>
            <Text style={styles.socialText}>Facebook</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <Text style={styles.copyright}>
          © {new Date().getFullYear()} FreeorBarter. All rights reserved.
        </Text>
        <View style={styles.taglineContainer}>
          <Text style={styles.taglineHeart}>❤️</Text>
          <Text style={styles.tagline}>Made with love for a sustainable future</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    marginTop: 20,
  },
  section: {
    marginBottom: 24,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  brandEmoji: {
    fontSize: 28,
    marginRight: 8,
  },
  brandName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4F46E5',
  },
  brandDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  linksContainer: {
    gap: 8,
  },
  linkButton: {
    paddingVertical: 4,
  },
  linkText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  contactText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  newsletterDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  subscribeContainer: {
    gap: 8,
  },
  emailInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937',
  },
  subscribeButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  subscribeButtonDisabled: {
    opacity: 0.6,
  },
  subscribeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  successContainer: {
    backgroundColor: '#D1FAE5',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  successText: {
    fontSize: 14,
    color: '#059669',
    textAlign: 'center',
    fontWeight: '500',
  },
  socialContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  socialIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  socialText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 20,
    marginTop: 8,
    alignItems: 'center',
  },
  copyright: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 8,
    textAlign: 'center',
  },
  taglineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taglineHeart: {
    fontSize: 14,
    marginRight: 4,
  },
  tagline: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});

