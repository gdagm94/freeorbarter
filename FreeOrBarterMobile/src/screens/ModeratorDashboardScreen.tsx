import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Image,
  Modal,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { fetchReports, getReportTarget, isModerator, Report, ReportTarget } from '../lib/moderator';
import { removeContent, banUser, dismissReport, resolveReport } from '../lib/moderatorActions';
import * as Haptics from 'expo-haptics';
import { useDeviceInfo } from '../hooks/useDeviceInfo';
import { useResponsiveStyles, getResponsivePadding } from '../utils/responsive';

type ReportStatus = 'pending' | 'in_review' | 'resolved' | 'dismissed' | 'all';

export default function ModeratorDashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReportStatus>('pending');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [targetContent, setTargetContent] = useState<ReportTarget | null>(null);
  const [loadingTarget, setLoadingTarget] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [userIsModerator, setUserIsModerator] = useState(false);
  const [showContentModal, setShowContentModal] = useState(false);
  const { isTablet } = useDeviceInfo();
  const responsiveStyles = useResponsiveStyles();
  const padding = getResponsivePadding(isTablet);

  useEffect(() => {
    const checkAccess = async () => {
      const moderator = await isModerator();
      setUserIsModerator(moderator);
      
      if (!moderator) {
        Alert.alert('Access Denied', 'You do not have moderator permissions.');
        navigation.goBack();
        return;
      }

      loadReports();
    };

    checkAccess();
  }, [navigation]);

  useEffect(() => {
    if (userIsModerator) {
      loadReports();
    }
  }, [statusFilter, userIsModerator]);

  const loadReports = async () => {
    if (!refreshing) setLoading(true);
    setError(null);
    try {
      const status = statusFilter === 'all' ? undefined : statusFilter;
      const data = await fetchReports(status);
      setReports(data);
    } catch (err) {
      console.error('Error loading reports:', err);
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadReports();
  };

  const handleViewTarget = async (report: Report) => {
    setSelectedReport(report);
    setLoadingTarget(true);
    setTargetContent(null);
    setShowContentModal(true);

    try {
      const target = await getReportTarget(report);
      setTargetContent(target);
    } catch (err) {
      console.error('Error loading target:', err);
    } finally {
      setLoadingTarget(false);
    }
  };

  const handleRemoveContent = async (report: Report) => {
    if (!report.target_id || (report.target_type !== 'item' && report.target_type !== 'message')) {
      return;
    }

    // Narrow the type for TypeScript
    const targetType = report.target_type as 'item' | 'message';
    const targetId = report.target_id;

    Alert.alert(
      'Remove Content',
      `Are you sure you want to remove this ${targetType}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(report.id);
            try {
              await removeContent(targetType, targetId, report.id);
              await resolveReport(report.id, 'remove_content', targetType, targetId, 'Content removed by moderator');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await loadReports();
              setShowContentModal(false);
              setSelectedReport(null);
              setTargetContent(null);
            } catch (err) {
              console.error('Error removing content:', err);
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to remove content');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleBanUser = async (report: Report) => {
    let userId: string;
    
    if (report.target_type === 'user') {
      userId = report.target_id;
    } else {
      // If reporting an item/message, ban the content creator
      if (!targetContent || targetContent.type !== 'item') {
        Alert.alert('Error', 'Cannot determine user to ban');
        return;
      }
      userId = targetContent.data.user_id;
    }

    Alert.alert(
      'Ban User',
      'Are you sure you want to ban this user? They will be unable to log in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Ban',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(report.id);
            try {
              await banUser(userId, report.id, 'User banned due to reported content');
              await resolveReport(report.id, 'ban_user', 'user', userId, 'User banned by moderator');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await loadReports();
              setShowContentModal(false);
              setSelectedReport(null);
              setTargetContent(null);
            } catch (err) {
              console.error('Error banning user:', err);
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to ban user');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleDismiss = async (report: Report) => {
    Alert.alert(
      'Dismiss Report',
      'Are you sure you want to dismiss this report?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dismiss',
          onPress: async () => {
            setActionLoading(report.id);
            try {
              await dismissReport(report.id, 'Report dismissed by moderator');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await loadReports();
              setShowContentModal(false);
              setSelectedReport(null);
              setTargetContent(null);
            } catch (err) {
              console.error('Error dismissing report:', err);
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to dismiss report');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const getTimeRemaining = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const hoursElapsed = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
    const hoursRemaining = 24 - hoursElapsed;

    if (hoursRemaining <= 0) {
      return { text: 'Overdue', color: '#DC2626' };
    } else if (hoursRemaining <= 4) {
      return { text: `${Math.ceil(hoursRemaining)}h remaining`, color: '#EA580C' };
    } else {
      return { text: `${Math.ceil(hoursRemaining)}h remaining`, color: '#6B7280' };
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const renderReportItem = ({ item: report }: { item: Report }) => {
    const timeRemaining = report.status === 'pending' ? getTimeRemaining(report.created_at) : null;
    const borderColor = 
      report.status === 'pending' ? '#EAB308' :
      report.status === 'in_review' ? '#3B82F6' :
      report.status === 'resolved' ? '#10B981' :
      '#6B7280';

    return (
      <TouchableOpacity
        style={[styles.reportCard, { borderLeftColor: borderColor, borderLeftWidth: 4 }]}
        onPress={() => handleViewTarget(report)}
        activeOpacity={0.7}
      >
        <View style={styles.reportHeader}>
          <Text style={styles.reportType}>
            {report.target_type.charAt(0).toUpperCase() + report.target_type.slice(1)} Report
          </Text>
          {timeRemaining && (
            <Text style={[styles.timeRemaining, { color: timeRemaining.color }]}>
              {timeRemaining.text}
            </Text>
          )}
        </View>

        <Text style={styles.reportCategory}>
          <Text style={styles.label}>Category: </Text>
          {report.category}
        </Text>

        {report.description && (
          <Text style={styles.reportDescription} numberOfLines={2}>
            {report.description}
          </Text>
        )}

        <Text style={styles.reportMeta}>
          Reported {formatTimeAgo(report.created_at)}
          {report.reporter && ` by ${report.reporter.username}`}
        </Text>

        {(report.status === 'pending' || report.status === 'in_review') && (
          <View style={styles.actionButtons}>
            {(report.target_type === 'item' || report.target_type === 'message') && (
              <TouchableOpacity
                style={[styles.actionButton, styles.removeButton]}
                onPress={() => handleRemoveContent(report)}
                disabled={actionLoading === report.id}
              >
                <Text style={styles.actionButtonText}>Remove</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionButton, styles.banButton]}
              onPress={() => handleBanUser(report)}
              disabled={actionLoading === report.id}
            >
              <Text style={styles.actionButtonText}>Ban User</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.dismissButton]}
              onPress={() => handleDismiss(report)}
              disabled={actionLoading === report.id}
            >
              <Text style={styles.actionButtonText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        )}

        {actionLoading === report.id && (
          <ActivityIndicator size="small" color="#3B82F6" style={styles.loadingIndicator} />
        )}
      </TouchableOpacity>
    );
  };

  if (!userIsModerator) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Moderator Dashboard</Text>
        <TouchableOpacity
          onPress={onRefresh}
          disabled={loading}
          style={styles.refreshButton}
        >
          <Text style={styles.refreshButtonText}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Status Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={[styles.filterContent, { paddingHorizontal: padding }]}
      >
        {(['all', 'pending', 'in_review', 'resolved', 'dismissed'] as ReportStatus[]).map((status) => {
          // Format status text: replace underscores with spaces and capitalize
          const formatStatusText = (s: string) => {
            return s
              .split('_')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
          };

          return (
            <TouchableOpacity
              key={status}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setStatusFilter(status);
              }}
              style={[
                styles.filterButton,
                statusFilter === status && styles.filterButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  statusFilter === status && styles.filterButtonTextActive,
                ]}
              >
                {formatStatusText(status)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading reports...</Text>
        </View>
      ) : reports.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No reports found</Text>
        </View>
      ) : (
        <View style={[responsiveStyles.contentContainer, { paddingHorizontal: padding }]}>
          <FlatList
            data={reports}
            renderItem={renderReportItem}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            contentContainerStyle={styles.listContent}
          />
        </View>
      )}

      {/* Content Preview Modal */}
      <Modal
        visible={showContentModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowContentModal(false);
          setSelectedReport(null);
          setTargetContent(null);
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Content Preview</Text>
            <TouchableOpacity
              onPress={() => {
                setShowContentModal(false);
                setSelectedReport(null);
                setTargetContent(null);
              }}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {loadingTarget ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.loadingText}>Loading content...</Text>
              </View>
            ) : targetContent ? (
              <View>
                <Text style={styles.contentType}>
                  Type: {targetContent.type.charAt(0).toUpperCase() + targetContent.type.slice(1)}
                </Text>

                {targetContent.type === 'item' && (
                  <View>
                    <Text style={styles.contentTitle}>{targetContent.data.title}</Text>
                    <Text style={styles.contentDescription}>{targetContent.data.description}</Text>
                    {targetContent.data.images && targetContent.data.images.length > 0 && (
                      <Image
                        source={{ uri: targetContent.data.images[0] }}
                        style={styles.contentImage}
                        resizeMode="cover"
                      />
                    )}
                    <Text style={styles.contentMeta}>
                      Created {formatTimeAgo(targetContent.data.created_at)}
                    </Text>
                  </View>
                )}

                {targetContent.type === 'message' && (
                  <View>
                    <Text style={styles.contentText}>{targetContent.data.content}</Text>
                    {targetContent.data.image_url && (
                      <Image
                        source={{ uri: targetContent.data.image_url }}
                        style={styles.contentImage}
                        resizeMode="cover"
                      />
                    )}
                    <Text style={styles.contentMeta}>
                      Sent {formatTimeAgo(targetContent.data.created_at)}
                    </Text>
                  </View>
                )}

                {targetContent.type === 'user' && (
                  <View style={styles.userPreview}>
                    {targetContent.data.avatar_url ? (
                      <Image
                        source={{ uri: targetContent.data.avatar_url }}
                        style={styles.userAvatar}
                      />
                    ) : (
                      <View style={styles.userAvatarPlaceholder}>
                        <Text style={styles.userAvatarText}>👤</Text>
                      </View>
                    )}
                    <Text style={styles.userName}>{targetContent.data.username}</Text>
                    <Text style={styles.contentMeta}>
                      Member since {new Date(targetContent.data.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.centerContainer}>
                <Text style={styles.emptyText}>Content not found or has been deleted</Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
  },
  refreshButton: {
    padding: 8,
  },
  refreshButtonText: {
    fontSize: 20,
    color: '#3B82F6',
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#3B82F6',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    padding: 12,
    margin: 16,
    borderRadius: 8,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 14,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 16,
  },
  listContent: {
    padding: 16,
  },
  reportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  timeRemaining: {
    fontSize: 12,
    fontWeight: '600',
  },
  reportCategory: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  label: {
    fontWeight: '600',
  },
  reportDescription: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
  },
  reportMeta: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
  },
  removeButton: {
    backgroundColor: '#FEE2E2',
  },
  banButton: {
    backgroundColor: '#FEE2E2',
  },
  dismissButton: {
    backgroundColor: '#F3F4F6',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
    textAlign: 'center',
  },
  loadingIndicator: {
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#6B7280',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  contentType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 16,
  },
  contentTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  contentDescription: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 16,
    lineHeight: 24,
  },
  contentText: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 16,
    lineHeight: 24,
  },
  contentImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
  contentMeta: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  userPreview: {
    alignItems: 'center',
    padding: 24,
  },
  userAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
  },
  userAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  userAvatarText: {
    fontSize: 40,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
});

