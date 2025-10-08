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

export default function TermsScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.updateDate}>Last Updated: October 8, 2025</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
          <Text style={styles.paragraph}>
            By accessing and using FreeorBarter, you accept and agree to be bound by the terms and 
            provisions of this agreement. If you do not agree to these terms, please do not use our service.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Use of Service</Text>
          <Text style={styles.paragraph}>
            FreeorBarter provides a platform for users to list items they wish to give away for free or 
            trade with others. Users must:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Be at least 18 years old or have parental consent</Text>
            <Text style={styles.bullet}>• Provide accurate and truthful information</Text>
            <Text style={styles.bullet}>• Not use the service for illegal activities</Text>
            <Text style={styles.bullet}>• Respect other users and community guidelines</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. User Responsibilities</Text>
          <Text style={styles.paragraph}>
            Users are solely responsible for:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• The accuracy of their listings</Text>
            <Text style={styles.bullet}>• The condition and safety of items they list</Text>
            <Text style={styles.bullet}>• Communication and arrangements with other users</Text>
            <Text style={styles.bullet}>• Compliance with local laws and regulations</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Prohibited Items</Text>
          <Text style={styles.paragraph}>
            The following items are prohibited from being listed:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Illegal or stolen goods</Text>
            <Text style={styles.bullet}>• Weapons or explosives</Text>
            <Text style={styles.bullet}>• Hazardous materials</Text>
            <Text style={styles.bullet}>• Animals (unless through approved channels)</Text>
            <Text style={styles.bullet}>• Counterfeit or pirated goods</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Liability</Text>
          <Text style={styles.paragraph}>
            FreeorBarter acts as a platform connecting users. We are not responsible for:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• The quality, safety, or legality of items listed</Text>
            <Text style={styles.bullet}>• The accuracy of listings or user communications</Text>
            <Text style={styles.bullet}>• Any disputes between users</Text>
            <Text style={styles.bullet}>• Loss, damage, or injury resulting from transactions</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Content Rights</Text>
          <Text style={styles.paragraph}>
            By posting content on FreeorBarter, you grant us a non-exclusive, worldwide license to use, 
            display, and distribute your content on our platform. You retain ownership of your content.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Account Termination</Text>
          <Text style={styles.paragraph}>
            We reserve the right to suspend or terminate accounts that violate these terms or engage in 
            harmful behavior. Users may also delete their accounts at any time.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Changes to Terms</Text>
          <Text style={styles.paragraph}>
            We may update these terms from time to time. Continued use of the service after changes 
            constitutes acceptance of the new terms.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. Contact</Text>
          <Text style={styles.paragraph}>
            For questions about these terms, please contact us at support@freeorbarter.com
          </Text>
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
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  copyright: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});

