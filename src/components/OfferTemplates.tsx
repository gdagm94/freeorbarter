import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Plus, Edit, Trash2, Copy, X } from 'lucide-react';

interface OfferTemplate {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface OfferTemplatesProps {
  currentUserId: string;
  onTemplateSelect: (template: OfferTemplate) => void;
  onClose: () => void;
  isVisible: boolean;
}

export function OfferTemplates({ currentUserId, onTemplateSelect, onClose, isVisible }: OfferTemplatesProps) {
  const [templates, setTemplates] = useState<OfferTemplate[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<OfferTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: ''
  });

  useEffect(() => {
    if (isVisible) {
      fetchTemplates();
    }
  }, [isVisible, currentUserId]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('offer_templates')
        .select('*')
        .eq('user_id', currentUserId)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching templates:', error);
        return;
      }

      setTemplates(data || []);
    } catch (err) {
      console.error('Error in fetchTemplates:', err);
    } finally {
      setLoading(false);
    }
  };

  const createTemplate = async () => {
    if (!formData.title.trim() || !formData.content.trim()) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('offer_templates')
        .insert([{
          user_id: currentUserId,
          title: formData.title.trim(),
          content: formData.content.trim(),
        }]);

      if (error) {
        console.error('Error creating template:', error);
        return;
      }

      setFormData({ title: '', content: '' });
      setShowCreateForm(false);
      fetchTemplates();
    } catch (err) {
      console.error('Error in createTemplate:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateTemplate = async () => {
    if (!editingTemplate || !formData.title.trim() || !formData.content.trim()) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('offer_templates')
        .update({
          title: formData.title.trim(),
          content: formData.content.trim(),
        })
        .eq('id', editingTemplate.id);

      if (error) {
        console.error('Error updating template:', error);
        return;
      }

      setFormData({ title: '', content: '' });
      setEditingTemplate(null);
      fetchTemplates();
    } catch (err) {
      console.error('Error in updateTemplate:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('offer_templates')
        .delete()
        .eq('id', templateId);

      if (error) {
        console.error('Error deleting template:', error);
        return;
      }

      fetchTemplates();
    } catch (err) {
      console.error('Error in deleteTemplate:', err);
    } finally {
      setLoading(false);
    }
  };

  const duplicateTemplate = async (template: OfferTemplate) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('offer_templates')
        .insert([{
          user_id: currentUserId,
          title: `${template.title} (Copy)`,
          content: template.content,
        }]);

      if (error) {
        console.error('Error duplicating template:', error);
        return;
      }

      fetchTemplates();
    } catch (err) {
      console.error('Error in duplicateTemplate:', err);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (template: OfferTemplate) => {
    setEditingTemplate(template);
    setFormData({
      title: template.title,
      content: template.content
    });
    setShowCreateForm(true);
  };

  const cancelEdit = () => {
    setFormData({ title: '', content: '' });
    setEditingTemplate(null);
    setShowCreateForm(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Offer Templates
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Templates List */}
          <div className="w-1/2 border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Template
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto"></div>
                  <p className="text-sm text-gray-500 mt-2">Loading...</p>
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center text-gray-500">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No templates yet</p>
                  <p className="text-xs">Create your first template to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">
                            {template.title}
                          </h4>
                          <p className="text-xs text-gray-500 mt-1">
                            Updated {formatDate(template.updated_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => onTemplateSelect(template)}
                            className="p-1 text-indigo-600 hover:bg-indigo-100 rounded transition-colors"
                            title="Use template"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => startEdit(template)}
                            className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                            title="Edit template"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteTemplate(template.id)}
                            className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                            title="Delete template"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Create/Edit Form */}
          <div className="w-1/2 flex flex-col">
            {showCreateForm ? (
              <div className="flex-1 flex flex-col">
                <div className="p-4 border-b border-gray-200">
                  <h4 className="font-medium text-gray-900">
                    {editingTemplate ? 'Edit Template' : 'Create New Template'}
                  </h4>
                </div>
                <div className="flex-1 p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Template Name
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="e.g., Standard Trade Offer"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Template Content
                    </label>
                    <textarea
                      value={formData.content}
                      onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                      placeholder="Enter your template content here..."
                      className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                    />
                  </div>
                </div>
                <div className="p-4 border-t border-gray-200 flex gap-3">
                  <button
                    onClick={editingTemplate ? updateTemplate : createTemplate}
                    disabled={!formData.title.trim() || !formData.content.trim() || loading}
                    className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? 'Saving...' : (editingTemplate ? 'Update' : 'Create')}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-sm">Select a template to view or create a new one</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
