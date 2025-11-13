import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  AlertCircle, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Trash2, 
  Ban, 
  Eye, 
  Filter,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { fetchReports, getReportTarget, updateReportStatus, isModerator, Report, ReportTarget } from '../lib/moderator';
import { removeContent, banUser, dismissReport, resolveReport } from '../lib/moderatorActions';
import { formatDistanceToNow } from 'date-fns';

type ReportStatus = 'pending' | 'in_review' | 'resolved' | 'dismissed' | 'all';

function ModeratorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReportStatus>('pending');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [targetContent, setTargetContent] = useState<ReportTarget | null>(null);
  const [loadingTarget, setLoadingTarget] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [userIsModerator, setUserIsModerator] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      const moderator = await isModerator();
      setUserIsModerator(moderator);
      
      if (!moderator) {
        navigate('/');
        return;
      }

      loadReports();
    };

    checkAccess();
  }, [navigate]);

  useEffect(() => {
    if (userIsModerator) {
      loadReports();
    }
  }, [statusFilter, userIsModerator]);

  const loadReports = async () => {
    setLoading(true);
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
    }
  };

  const handleViewTarget = async (report: Report) => {
    setSelectedReport(report);
    setLoadingTarget(true);
    setTargetContent(null);

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

    const confirmed = window.confirm(
      `Are you sure you want to remove this ${report.target_type}? This action cannot be undone.`
    );

    if (!confirmed) return;

    setActionLoading(report.id);
    try {
      await removeContent(report.target_type, report.target_id, report.id);
      await resolveReport(report.id, 'remove_content', report.target_type, report.target_id, 'Content removed by moderator');
      await loadReports();
      setSelectedReport(null);
      setTargetContent(null);
    } catch (err) {
      console.error('Error removing content:', err);
      alert(err instanceof Error ? err.message : 'Failed to remove content');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBanUser = async (report: Report) => {
    if (report.target_type !== 'user') {
      // If reporting an item/message, ban the content creator
      if (!targetContent || targetContent.type !== 'item') return;
      const userId = targetContent.data.user_id;
      
      const confirmed = window.confirm(
        `Are you sure you want to ban this user? They will be unable to log in.`
      );

      if (!confirmed) return;

      setActionLoading(report.id);
      try {
        await banUser(userId, report.id, 'User banned due to reported content');
        await resolveReport(report.id, 'ban_user', 'user', userId, 'User banned by moderator');
        await loadReports();
        setSelectedReport(null);
        setTargetContent(null);
      } catch (err) {
        console.error('Error banning user:', err);
        alert(err instanceof Error ? err.message : 'Failed to ban user');
      } finally {
        setActionLoading(null);
      }
    } else {
      const confirmed = window.confirm(
        `Are you sure you want to ban this user? They will be unable to log in.`
      );

      if (!confirmed) return;

      setActionLoading(report.id);
      try {
        await banUser(report.target_id, report.id, 'User banned due to report');
        await resolveReport(report.id, 'ban_user', 'user', report.target_id, 'User banned by moderator');
        await loadReports();
        setSelectedReport(null);
        setTargetContent(null);
      } catch (err) {
        console.error('Error banning user:', err);
        alert(err instanceof Error ? err.message : 'Failed to ban user');
      } finally {
        setActionLoading(null);
      }
    }
  };

  const handleDismiss = async (report: Report) => {
    const confirmed = window.confirm('Are you sure you want to dismiss this report?');
    if (!confirmed) return;

    setActionLoading(report.id);
    try {
      await dismissReport(report.id, 'Report dismissed by moderator');
      await loadReports();
      setSelectedReport(null);
      setTargetContent(null);
    } catch (err) {
      console.error('Error dismissing report:', err);
      alert(err instanceof Error ? err.message : 'Failed to dismiss report');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'in_review':
        return <Eye className="w-4 h-4 text-blue-600" />;
      case 'resolved':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'dismissed':
        return <XCircle className="w-4 h-4 text-gray-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTimeRemaining = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const hoursElapsed = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
    const hoursRemaining = 24 - hoursElapsed;

    if (hoursRemaining <= 0) {
      return { text: 'Overdue', color: 'text-red-600' };
    } else if (hoursRemaining <= 4) {
      return { text: `${Math.ceil(hoursRemaining)}h remaining`, color: 'text-orange-600' };
    } else {
      return { text: `${Math.ceil(hoursRemaining)}h remaining`, color: 'text-gray-600' };
    }
  };

  if (!userIsModerator) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Moderator Dashboard</h1>
          <p className="text-gray-600 mt-1">Review and manage user reports</p>
        </div>
        <button
          onClick={loadReports}
          disabled={loading}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex items-center space-x-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">Filter by status:</span>
          {(['all', 'pending', 'in_review', 'resolved', 'dismissed'] as ReportStatus[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="animate-pulse">Loading reports...</div>
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
          No reports found
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Reports List */}
          <div className="space-y-4">
            {reports.map((report) => {
              const timeRemaining = report.status === 'pending' ? getTimeRemaining(report.created_at) : null;
              
              return (
                <div
                  key={report.id}
                  className={`bg-white rounded-lg shadow-md p-4 border-l-4 ${
                    report.status === 'pending' ? 'border-yellow-500' :
                    report.status === 'in_review' ? 'border-blue-500' :
                    report.status === 'resolved' ? 'border-green-500' :
                    'border-gray-500'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(report.status)}
                      <span className="font-semibold text-gray-900">
                        {report.target_type.charAt(0).toUpperCase() + report.target_type.slice(1)} Report
                      </span>
                    </div>
                    {timeRemaining && (
                      <span className={`text-xs font-medium ${timeRemaining.color}`}>
                        {timeRemaining.text}
                      </span>
                    )}
                  </div>

                  <div className="text-sm text-gray-600 mb-2">
                    <span className="font-medium">Category:</span> {report.category}
                  </div>

                  {report.description && (
                    <div className="text-sm text-gray-700 mb-2">
                      {report.description}
                    </div>
                  )}

                  <div className="text-xs text-gray-500 mb-3">
                    Reported {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                    {report.reporter && ` by ${report.reporter.username}`}
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleViewTarget(report)}
                      className="flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </button>
                    
                    {report.status === 'pending' || report.status === 'in_review' ? (
                      <>
                        {(report.target_type === 'item' || report.target_type === 'message') && (
                          <button
                            onClick={() => handleRemoveContent(report)}
                            disabled={actionLoading === report.id}
                            className="flex items-center px-3 py-1.5 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Remove
                          </button>
                        )}
                        <button
                          onClick={() => handleBanUser(report)}
                          disabled={actionLoading === report.id}
                          className="flex items-center px-3 py-1.5 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 disabled:opacity-50"
                        >
                          <Ban className="w-4 h-4 mr-1" />
                          Ban User
                        </button>
                        <button
                          onClick={() => handleDismiss(report)}
                          disabled={actionLoading === report.id}
                          className="flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 disabled:opacity-50"
                        >
                          Dismiss
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-gray-500">
                        {report.status === 'resolved' ? 'Resolved' : 'Dismissed'}
                        {report.resolved_at && ` ${formatDistanceToNow(new Date(report.resolved_at), { addSuffix: true })}`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Target Content Preview */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Content Preview</h2>
            {selectedReport ? (
              loadingTarget ? (
                <div className="text-center py-8 text-gray-500">Loading content...</div>
              ) : targetContent ? (
                <div>
                  <div className="mb-4">
                    <span className="text-sm font-medium text-gray-700">Type:</span>{' '}
                    <span className="text-sm text-gray-900">{targetContent.type}</span>
                  </div>

                  {targetContent.type === 'item' && (
                    <div>
                      <h3 className="font-semibold text-lg mb-2">{targetContent.data.title}</h3>
                      <p className="text-gray-700 mb-4">{targetContent.data.description}</p>
                      {targetContent.data.images && targetContent.data.images.length > 0 && (
                        <img
                          src={targetContent.data.images[0]}
                          alt={targetContent.data.title}
                          className="w-full h-48 object-cover rounded mb-4"
                        />
                      )}
                      <div className="text-sm text-gray-500">
                        Created {formatDistanceToNow(new Date(targetContent.data.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  )}

                  {targetContent.type === 'message' && (
                    <div>
                      <p className="text-gray-700 mb-4 whitespace-pre-wrap">{targetContent.data.content}</p>
                      {targetContent.data.image_url && (
                        <img
                          src={targetContent.data.image_url}
                          alt="Message attachment"
                          className="w-full h-48 object-cover rounded mb-4"
                        />
                      )}
                      <div className="text-sm text-gray-500">
                        Sent {formatDistanceToNow(new Date(targetContent.data.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  )}

                  {targetContent.type === 'user' && (
                    <div>
                      <div className="flex items-center space-x-4 mb-4">
                        {targetContent.data.avatar_url ? (
                          <img
                            src={targetContent.data.avatar_url}
                            alt={targetContent.data.username}
                            className="w-16 h-16 rounded-full"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-2xl">👤</span>
                          </div>
                        )}
                        <div>
                          <h3 className="font-semibold text-lg">{targetContent.data.username}</h3>
                          <div className="text-sm text-gray-500">
                            Member since {new Date(targetContent.data.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Content not found or has been deleted
                </div>
              )
            ) : (
              <div className="text-center py-8 text-gray-500">
                Select a report to view content
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ModeratorDashboard;

