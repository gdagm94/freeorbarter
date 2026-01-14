import { useState, useEffect } from 'react';
import { X, Download, ExternalLink, FileText, File, Image as ImageIcon, FileVideo, FileAudio, Archive } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface FileViewerProps {
  visible: boolean;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
  onClose: () => void;
}

export function FileViewer({
  visible,
  fileUrl,
  fileName,
  fileType,
  fileSize,
  onClose
}: FileViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [visible]);

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <ImageIcon className="w-12 h-12 text-blue-500" />;
    } else if (mimeType === 'application/pdf') {
      return <FileText className="w-12 h-12 text-red-500" />;
    } else if (mimeType.startsWith('video/')) {
      return <FileVideo className="w-12 h-12 text-purple-500" />;
    } else if (mimeType.startsWith('audio/')) {
      return <FileAudio className="w-12 h-12 text-green-500" />;
    } else if (mimeType.includes('zip') || mimeType.includes('archive')) {
      return <Archive className="w-12 h-12 text-orange-500" />;
    } else {
      return <File className="w-12 h-12 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return 'Unknown size';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDownload = async () => {
    try {
      setLoading(true);
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      setError('Failed to download file');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenExternally = () => {
    window.open(fileUrl, '_blank');
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setError(null);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('Error loading PDF:', error);
    setError('Failed to load PDF document');
  };

  const isPdf = fileType === 'application/pdf';
  const isImage = fileType.startsWith('image/');


  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            {getFileIcon(fileType)}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 truncate max-w-md">
                {fileName}
              </h3>
              <p className="text-sm text-gray-500">
                {fileType} {fileSize && `• ${formatFileSize(fileSize)}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg m-4">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {isPdf && (
            <div className="h-full overflow-auto p-4">
              <Document
                file={fileUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={<div className="text-center py-8">Loading PDF...</div>}
              >
                <Page
                  pageNumber={pageNumber}
                  className="shadow-lg"
                  width={Math.min(800, window.innerWidth - 100)}
                />
              </Document>

              {numPages && numPages > 1 && (
                <div className="flex items-center justify-center space-x-4 mt-4">
                  <button
                    onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
                    disabled={pageNumber <= 1}
                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {pageNumber} of {numPages}
                  </span>
                  <button
                    onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
                    disabled={pageNumber >= numPages}
                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}

          {isImage && (
            <div className="h-full flex items-center justify-center p-4">
              <img
                src={fileUrl}
                alt={fileName}
                className="max-w-full max-h-full object-contain"
                style={{ maxHeight: 'calc(90vh - 200px)' }}
              />
            </div>
          )}

          {!isPdf && !isImage && (
            <div className="h-full flex items-center justify-center p-8">
              <div className="text-center">
                {getFileIcon(fileType)}
                <h4 className="text-lg font-medium text-gray-900 mt-4">
                  Preview not available
                </h4>
                <p className="text-gray-500 mt-2">
                  This file type cannot be previewed in the browser.
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Download the file to view it with an appropriate application.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleOpenExternally}
            className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Open in New Tab</span>
          </button>

          <button
            onClick={handleDownload}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>{loading ? 'Downloading...' : 'Download'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
