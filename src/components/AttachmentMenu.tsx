
import { Paperclip, Mic, X } from 'lucide-react';

interface AttachmentMenuProps {
  visible: boolean;
  onClose: () => void;
  onAttach: () => void;
  onVoice: () => void;
}

export function AttachmentMenu({ visible, onClose, onAttach, onVoice }: AttachmentMenuProps) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Attach</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => {
                onAttach();
                onClose();
              }}
              className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                <Paperclip className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">Attach</span>
            </button>

            <button
              onClick={() => {
                onVoice();
                onClose();
              }}
              className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-2">
                <Mic className="w-6 h-6 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">Voice</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
