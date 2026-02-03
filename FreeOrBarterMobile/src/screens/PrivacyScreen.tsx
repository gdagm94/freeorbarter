import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BackButton } from '../components/BackButton';

export default function PrivacyScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton style={styles.backButton} />
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.updateDate}>Last Updated: November 10, 2025</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Introduction</Text>
          <Text style={styles.paragraph}>
            FreeorBarter ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy
            explains how we collect, use, disclose, and safeguard your information when you use our mobile
            application and services.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Information We Collect</Text>
          <Text style={styles.paragraph}>
            We collect information that you provide directly to us:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Account information (email, username, password)</Text>
            <Text style={styles.bullet}>• Profile information (name, location, bio)</Text>
            <Text style={styles.bullet}>• Item listings (photos, descriptions, locations)</Text>
            <Text style={styles.bullet}>• Messages and communications with other users</Text>
            <Text style={styles.bullet}>• Device information and usage data</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. How We Use Your Information</Text>
          <Text style={styles.paragraph}>
            We use the information we collect to:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Provide and maintain our services</Text>
            <Text style={styles.bullet}>• Connect you with other users</Text>
            <Text style={styles.bullet}>• Send notifications about activity on your account</Text>
            <Text style={styles.bullet}>• Improve and personalize your experience</Text>
            <Text style={styles.bullet}>• Prevent fraud and ensure platform safety</Text>
            <Text style={styles.bullet}>• Comply with legal obligations</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Information Sharing</Text>
          <Text style={styles.paragraph}>
            We share your information only in the following circumstances:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• With other users as necessary to facilitate transactions</Text>
            <Text style={styles.bullet}>• With service providers who assist in operating our platform</Text>
            <Text style={styles.bullet}>• When required by law or to protect rights and safety</Text>
            <Text style={styles.bullet}>• With your explicit consent</Text>
          </View>
          <Text style={styles.paragraph}>
            We do not sell your personal information to third parties.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Data Security</Text>
          <Text style={styles.paragraph}>
            We implement appropriate technical and organizational measures to protect your personal information.
            However, no method of transmission over the internet is 100% secure, and we cannot guarantee
            absolute security.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Your Rights</Text>
          <Text style={styles.paragraph}>
            You have the right to:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Access and review your personal information</Text>
            <Text style={styles.bullet}>• Update or correct your information</Text>
            <Text style={styles.bullet}>• Delete your account and associated data</Text>
            <Text style={styles.bullet}>• Opt out of marketing communications</Text>
            <Text style={styles.bullet}>• Request a copy of your data</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Account Deletion</Text>
          <Text style={styles.paragraph}>
            You can permanently delete your Free or Barter account at any time. Deleting your account removes your profile,
            listings, messages, friends, notifications, and associated media from our systems.
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Web: Profile &gt; Account deletion</Text>
            <Text style={styles.bullet}>• iOS / Android: Settings &gt; Delete account</Text>
          </View>
          <Text style={styles.smallPrint}>
            We keep a minimal audit record (your account identifier, email, and deletion timestamp) solely to document the request
            for legal, safety, and fraud-prevention purposes. The log is stored securely and does not retain your listings or messages.
          </Text>
          <Text style={styles.paragraph}>
            Need a copy of your data or help with deletion? Email support@freeorbarter.com before you confirm the request.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Location Data</Text>
          <Text style={styles.paragraph}>
            We collect location data to help you find items near you and to show your items to nearby users.
            You can control location permissions through your device settings.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. Children's Privacy</Text>
          <Text style={styles.paragraph}>
            Our service is not intended for children under 18. We do not knowingly collect personal
            information from children. If you believe we have collected information from a child, please
            contact us immediately.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. Changes to This Policy</Text>
          <Text style={styles.paragraph}>
            We may update this Privacy Policy from time to time. We will notify you of any changes by
            posting the new policy on this page and updating the "Last Updated" date.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. Contact Us</Text>
          <Text style={styles.paragraph}>
            If you have questions about this Privacy Policy or our data practices, please contact us at:
          </Text>
          <Text style={styles.contactText}>support@freeorbarter.com</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.copyright}>
            © {new Date().getFullYear()} FreeorBarter. All rights reserved.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 8,
  },
  backIcon: {
    fontSize: 24,
    color: '#1F2937',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  updateDate: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    color: '#4B5563',
    marginBottom: 8,
  },
  smallPrint: {
    fontSize: 12,
    lineHeight: 20,
    color: '#6B7280',
    marginBottom: 8,
  },
  bulletList: {
    marginTop: 8,
    marginLeft: 8,
  },
  bullet: {
    fontSize: 14,
    lineHeight: 24,
    color: '#4B5563',
    marginBottom: 4,
  },
  contactText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#4F46E5',
    fontWeight: '600',
    marginTop: 8,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  copyright: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});

