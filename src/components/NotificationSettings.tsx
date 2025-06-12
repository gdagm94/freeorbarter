import React, { useState, useEffect } from 'react';
import { X, Bell, BellOff, Volume2, VolumeX, TestTube, RotateCcw, Save, Clock, Globe, Smartphone, Mail, Monitor } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface NotificationSettings {
  id?: string;
  user_id: string;
  enabled: boolean;
  delivery_methods: {
    email: boolean;
    push: boolean;
    in_app: boolean;
  };
  frequency: 'real-time' | 'daily' | 'weekly';
  quiet_hours: {
    enabled: boolean;
    start_time: string;
    end_time: string;
    timezone: string;
  };
  categories: {
    system_alerts: {
      enabled: boolean;
      sound: boolean;
      banner: boolean;
      priority: 'urgent' | 'normal' | 'low';
    };
    security: {
      enabled: boolean;
      sound: boolean;
      banner: boolean;
      priority: 'urgent' | 'normal' | 'low';
    };
    messages: {
      enabled: boolean;
      sound: boolean;
      banner: boolean;
      priority: 'urgent' | 'normal' | 'low';
    };
    activity: {
      enabled: boolean;
      sound: boolean;
      banner: boolean;
      priority: 'urgent' | 'normal' | 'low';
    };
    marketing: {
      enabled: boolean;
      sound: boolean;
      banner: boolean;
      priority: 'urgent' | 'normal' | 'low';
    };
  };
  created_at?: string;
  updated_at?: string;
}

interface NotificationSettingsProps {
  onClose: () => void;
}

const defaultSettings: Omit<NotificationSettings, 'user_id'> = {
  enabled: true,
  delivery_methods: {
    email: true,
    push: true,
    in_app: true,
  },
  frequency: 'real-time',
  quiet_hours: {
    enabled: false,
    start_time: '22:00',
    end_time: '08:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  },
  categories: {
    system_alerts: {
      enabled: true,
      sound: true,
      banner: true,
      priority: 'urgent',
    },
    security: {
      enabled: true,
      sound: true,
      banner: true,
      priority: 'urgent',
    },
    messages: {
      enabled: true,
      sound: true,
      banner: true,
      priority: 'normal',
    },
    activity: {
      enabled: true,
      sound: false,
      banner: true,
      priority: 'normal',
    },
    marketing: {
      enabled: false,
      sound: false,
      banner: false,
      priority: 'low',
    },
  },
};

export function NotificationSettings({ onClose }: NotificationSettingsProps) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingNotification, setTestingNotification] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('notification_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (data) {
          setSettings(data);
        } else {
          // Create default settings for new user
          const newSettings = { ...defaultSettings, user_id: user.id };
          setSettings(newSettings);
          await saveSettings(newSettings);
        }
      } catch (err) {
        console.error('Error fetching notification settings:', err);
        setSettings({ ...defaultSettings, user_id: user.id });
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [user]);

  const saveSettings = async (settingsToSave: NotificationSettings) => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('notification_settings')
        .upsert({
          ...settingsToSave,
          user_id: user.id,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error('Error saving notification settings:', err);
      setSaveMessage('Error saving settings. Please try again.');
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (updates: Partial<NotificationSettings>) => {
    if (!settings) return;
    
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const updateCategory = (category: keyof NotificationSettings['categories'], updates: Partial<NotificationSettings['categories'][keyof NotificationSettings['categories']]>) => {
    if (!settings) return;

    const newSettings = {
      ...settings,
      categories: {
        ...settings.categories,
        [category]: {
          ...settings.categories[category],
          ...updates,
        },
      },
    };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const resetToDefaults = async () => {
    if (!user) return;

    const defaultSettingsWithUser = { ...defaultSettings, user_id: user.id };
    setSettings(defaultSettingsWithUser);
    await saveSettings(defaultSettingsWithUser);
  };

  const testNotification = async () => {
    setTestingNotification(true);
    try {
      // Create a test notification
      await supabase
        .from('notifications')
        .insert([{
          user_id: user?.id,
          type: 'system_alerts',
          content: 'This is a test notification to preview your settings.',
          read: false,
        }]);

      setSaveMessage('Test notification sent!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error('Error sending test notification:', err);
      setSaveMessage('Error sending test notification.');
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setTestingNotification(false);
    }
  };

  const getTimezones = () => {
    return Intl.supportedValuesOf('timeZone').slice(0, 50); // Show first 50 common timezones
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Notification Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Save Message */}
          {saveMessage && (
            <div className={`p-4 rounded-lg ${
              saveMessage.includes('Error') 
                ? 'bg-red-100 text-red-700 border border-red-200' 
                : 'bg-green-100 text-green-700 border border-green-200'
            }`}>
              {saveMessage}
            </div>
          )}

          {/* Master Toggle */}
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {settings.enabled ? (
                  <Bell className="w-6 h-6 text-indigo-600" />
                ) : (
                  <BellOff className="w-6 h-6 text-gray-400" />
                )}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">All Notifications</h3>
                  <p className="text-sm text-gray-600">Enable or disable all notifications</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => updateSettings({ enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>

          {settings.enabled && (
            <>
              {/* Delivery Methods */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Delivery Methods</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Mail className="w-5 h-5 text-gray-600" />
                        <span className="font-medium">Email</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.delivery_methods.email}
                          onChange={(e) => updateSettings({
                            delivery_methods: {
                              ...settings.delivery_methods,
                              email: e.target.checked
                            }
                          })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Smartphone className="w-5 h-5 text-gray-600" />
                        <span className="font-medium">Push</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.delivery_methods.push}
                          onChange={(e) => updateSettings({
                            delivery_methods: {
                              ...settings.delivery_methods,
                              push: e.target.checked
                            }
                          })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Monitor className="w-5 h-5 text-gray-600" />
                        <span className="font-medium">In-App</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.delivery_methods.in_app}
                          onChange={(e) => updateSettings({
                            delivery_methods: {
                              ...settings.delivery_methods,
                              in_app: e.target.checked
                            }
                          })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Frequency */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Notification Frequency</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { value: 'real-time', label: 'Real-time', desc: 'Instant notifications' },
                    { value: 'daily', label: 'Daily Digest', desc: 'Once per day summary' },
                    { value: 'weekly', label: 'Weekly Summary', desc: 'Weekly roundup' },
                  ].map((option) => (
                    <label key={option.value} className="cursor-pointer">
                      <div className={`border-2 rounded-lg p-4 transition-colors ${
                        settings.frequency === option.value
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <div className="flex items-center space-x-3">
                          <input
                            type="radio"
                            name="frequency"
                            value={option.value}
                            checked={settings.frequency === option.value}
                            onChange={(e) => updateSettings({ frequency: e.target.value as any })}
                            className="text-indigo-600 focus:ring-indigo-500"
                          />
                          <div>
                            <div className="font-medium">{option.label}</div>
                            <div className="text-sm text-gray-600">{option.desc}</div>
                          </div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Quiet Hours */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Clock className="w-5 h-5 text-gray-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Quiet Hours</h3>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.quiet_hours.enabled}
                      onChange={(e) => updateSettings({
                        quiet_hours: {
                          ...settings.quiet_hours,
                          enabled: e.target.checked
                        }
                      })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {settings.quiet_hours.enabled && (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                        <input
                          type="time"
                          value={settings.quiet_hours.start_time}
                          onChange={(e) => updateSettings({
                            quiet_hours: {
                              ...settings.quiet_hours,
                              start_time: e.target.value
                            }
                          })}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                        <input
                          type="time"
                          value={settings.quiet_hours.end_time}
                          onChange={(e) => updateSettings({
                            quiet_hours: {
                              ...settings.quiet_hours,
                              end_time: e.target.value
                            }
                          })}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                        <select
                          value={settings.quiet_hours.timezone}
                          onChange={(e) => updateSettings({
                            quiet_hours: {
                              ...settings.quiet_hours,
                              timezone: e.target.value
                            }
                          })}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        >
                          {getTimezones().map((tz) => (
                            <option key={tz} value={tz}>{tz}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Notification Categories */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Notification Categories</h3>
                
                {[
                  { key: 'system_alerts', label: 'System Alerts & Updates', desc: 'Important system notifications and app updates' },
                  { key: 'security', label: 'Account Security', desc: 'Login alerts and security notifications' },
                  { key: 'messages', label: 'Messages & Mentions', desc: 'New messages and when you\'re mentioned' },
                  { key: 'activity', label: 'Activity on Your Content', desc: 'Comments, likes, and interactions with your items' },
                  { key: 'marketing', label: 'Marketing & Promotions', desc: 'Product updates and promotional content' },
                ].map((category) => {
                  const categoryKey = category.key as keyof NotificationSettings['categories'];
                  const categorySettings = settings.categories[categoryKey];
                  
                  return (
                    <div key={category.key} className="border border-gray-200 rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="font-semibold text-gray-900">{category.label}</h4>
                          <p className="text-sm text-gray-600">{category.desc}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={categorySettings.enabled}
                            onChange={(e) => updateCategory(categoryKey, { enabled: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>

                      {categorySettings.enabled && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              {categorySettings.sound ? (
                                <Volume2 className="w-4 h-4 text-gray-600" />
                              ) : (
                                <VolumeX className="w-4 h-4 text-gray-400" />
                              )}
                              <span className="text-sm font-medium">Sound</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={categorySettings.sound}
                                onChange={(e) => updateCategory(categoryKey, { sound: e.target.checked })}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Banner</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={categorySettings.banner}
                                onChange={(e) => updateCategory(categoryKey, { banner: e.target.checked })}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                            <select
                              value={categorySettings.priority}
                              onChange={(e) => updateCategory(categoryKey, { priority: e.target.value as any })}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            >
                              <option value="urgent">Urgent</option>
                              <option value="normal">Normal</option>
                              <option value="low">Low</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t">
            <button
              onClick={testNotification}
              disabled={testingNotification || !settings.enabled}
              className="flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <TestTube className="w-5 h-5 mr-2" />
              {testingNotification ? 'Sending...' : 'Test Notification'}
            </button>

            <button
              onClick={resetToDefaults}
              className="flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Reset to Defaults
            </button>

            <div className="flex-1"></div>

            <div className="flex items-center text-sm text-gray-600">
              <Save className="w-4 h-4 mr-1" />
              {saving ? 'Saving...' : 'Auto-saved'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}