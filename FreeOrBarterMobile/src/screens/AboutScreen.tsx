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

export default function AboutScreen() {
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
        <Text style={styles.headerTitle}>About Us</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoEmoji}>📊</Text>
            <Text style={styles.logoText}>FreeorBarter</Text>
          </View>
          <Text style={styles.tagline}>Share • Trade • Connect</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our Mission</Text>
          <Text style={styles.paragraph}>
            FreeorBarter is a community-driven marketplace that makes it easy to give away items you no longer need 
            or trade them with others. We believe in reducing waste, promoting sustainability, and building stronger 
            communities through sharing.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What We Do</Text>
          <Text style={styles.paragraph}>
            Our platform connects people who want to declutter their homes with those looking for items they need. 
            Whether you're giving something away for free or looking to barter, FreeorBarter makes the process simple, 
            safe, and rewarding.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Core Values</Text>
          
          <View style={styles.valueItem}>
            <Text style={styles.valueEmoji}>🌍</Text>
            <View style={styles.valueContent}>
              <Text style={styles.valueTitle}>Sustainability</Text>
              <Text style={styles.valueText}>
                Reducing waste by giving items a second life instead of sending them to landfills.
              </Text>
            </View>
          </View>

          <View style={styles.valueItem}>
            <Text style={styles.valueEmoji}>🤝</Text>
            <View style={styles.valueContent}>
              <Text style={styles.valueTitle}>Community</Text>
              <Text style={styles.valueText}>
                Building connections between neighbors and creating a culture of sharing.
              </Text>
            </View>
          </View>

          <View style={styles.valueItem}>
            <Text style={styles.valueEmoji}>💚</Text>
            <View style={styles.valueContent}>
              <Text style={styles.valueTitle}>Generosity</Text>
              <Text style={styles.valueText}>
                Encouraging kindness and helping others access items they need.
              </Text>
            </View>
          </View>

          <View style={styles.valueItem}>
            <Text style={styles.valueEmoji}>🔄</Text>
            <View style={styles.valueContent}>
              <Text style={styles.valueTitle}>Circular Economy</Text>
              <Text style={styles.valueText}>
                Promoting the reuse and exchange of goods to create a more sustainable future.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Join Our Community</Text>
          <Text style={styles.paragraph}>
            Whether you're looking to declutter, find something you need, or simply want to be part of a 
            sustainable community, FreeorBarter welcomes you. Together, we can make a positive impact on 
            our environment and build a more connected world.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            ❤️ Made with love for a sustainable future
          </Text>
          <Text style={styles.copyright}>
            © {new Date().getFullYear()} FreeorBarter
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
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logoEmoji: {
    fontSize: 48,
    marginRight: 12,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#4F46E5',
  },
  tagline: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    color: '#4B5563',
  },
  valueItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  valueEmoji: {
    fontSize: 32,
    marginRight: 12,
    marginTop: 4,
  },
  valueContent: {
    flex: 1,
  },
  valueTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  valueText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  copyright: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});

