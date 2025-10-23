import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Upload, X, Download, File, Image as ImageIcon } from 'lucide-react';

interface FileAttachmentProps {
  onFileUpload: (fileUrl: string, fileName: string, fileType: string) => void;
  onClose: () => void;
  uploading: boolean;
  setUploading: (uploading: boolean) => void;
}

const ALLOWED_FILE_TYPES = {
  images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  documents: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
  archives: ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'],
  maxSize: 10 * 1024 * 1024, // 10MB
};

export function FileAttachment({ onFileUpload, onClose, uploading, setUploading }: FileAttachmentProps) {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <ImageIcon className="w-8 h-8 text-blue-500" />;
    } else if (fileType === 'application/pdf') {
      return <FileText className="w-8 h-8 text-red-500" />;
    } else {
      return <File className="w-8 h-8 text-gray-500" />;
    }
  };

  const validateFile = (file: File): string | null => {
    const allAllowedTypes = [
      ...ALLOWED_FILE_TYPES.images,
      ...ALLOWED_FILE_TYPES.documents,
      ...ALLOWED_FILE_TYPES.archives
    ];

    if (!allAllowedTypes.includes(file.type)) {
      return `File type ${file.type} is not supported. Please upload images, documents, or archives.`;
    }

    if (file.size > ALLOWED_FILE_TYPES.maxSize) {
      return `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds the 10MB limit.`;
    }

    return null;
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      setUploading(true);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('message-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('message-files')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const validationError = validateFile(file);
    
    if (validationError) {
      alert(validationError);
      return;
    }

    const fileUrl = await uploadFile(file);
    if (fileUrl) {
      onFileUpload(fileUrl, file.name, file.type);
      onClose();
    } else {
      alert('Failed to upload file');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Attach File</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drag and Drop Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragOver
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">
            Drag and drop a file here, or
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50"
          >
            browse files
          </button>
          <p className="text-sm text-gray-500 mt-2">
            Max size: 10MB
          </p>
        </div>

        {/* File Type Info */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <ImageIcon className="w-4 h-4" />
            <span>Images: JPG, PNG, GIF, WebP</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FileText className="w-4 h-4" />
            <span>Documents: PDF, DOC, DOCX, TXT</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <File className="w-4 h-4" />
            <span>Archives: ZIP, RAR, 7Z</span>
          </div>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
          accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.txt,.zip,.rar,.7z"
        />

        {/* Upload Progress */}
        {uploading && (
          <div className="mt-4 flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
            <span className="text-sm text-gray-600">Uploading...</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Component for displaying file attachments in messages
interface FileDisplayProps {
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
  onPress?: () => void;
}

export function FileDisplay({ fileUrl, fileName, fileType, fileSize, onPress }: FileDisplayProps) {
  const getFileIcon = () => {
    if (fileType.startsWith('image/')) {
      return <ImageIcon className="w-6 h-6 text-blue-500" />;
    } else if (fileType === 'application/pdf') {
      return <FileText className="w-6 h-6 text-red-500" />;
    } else {
      return <File className="w-6 h-6 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFilePress = () => {
    if (onPress) {
      onPress();
      return;
    }
    
    // Fallback to direct download
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center gap-3">
        {getFileIcon()}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {fileName}
          </p>
          {fileSize && (
            <p className="text-xs text-gray-500">
              {formatFileSize(fileSize)}
            </p>
          )}
        </div>
        <button
          onClick={handleFilePress}
          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          title="View/Download file"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
