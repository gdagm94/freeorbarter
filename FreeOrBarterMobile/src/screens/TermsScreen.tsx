import React, { useEffect, useState } from 'react';
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
import { fetchLatestPolicy, PolicyStatus } from '../lib/policy';

export default function TermsScreen() {
  const navigation = useNavigation();
  const [policyStatus, setPolicyStatus] = useState<PolicyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const status = await fetchLatestPolicy();
        if (isMounted) {
          setPolicyStatus(status);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unable to load policy.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton style={styles.backButton} />
        <Text style={styles.headerTitle}>Community Guidelines</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {policyStatus?.policy && (
          <View style={styles.section}>
            <Text style={styles.updateDate}>
              Effective {new Date(policyStatus.policy.publishedAt).toLocaleDateString()} • Version {policyStatus.policy.version}
            </Text>
          </View>
        )}

        {loading && (
          <View style={styles.section}>
            <Text style={styles.paragraph}>Loading latest policy…</Text>
          </View>
        )}

        {error && (
          <View style={styles.section}>
            <Text style={[styles.paragraph, { color: '#DC2626' }]}>{error}</Text>
          </View>
        )}

        {policyStatus?.policy && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{policyStatus.policy.title}</Text>
            <Text style={styles.paragraph}>{policyStatus.policy.content}</Text>
          </View>
        )}

        {!loading && !error && !policyStatus?.policy && (
          <View style={styles.section}>
            <Text style={styles.paragraph}>Policy content is currently unavailable.</Text>
          </View>
        )}
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

