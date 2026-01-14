import React, { useState, useEffect } from 'react';
import { Upload, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ImageUploadProps {
  onImagesUploaded: (urls: string[]) => void;
  maxImages?: number;
  initialImages?: string[];
}

export function ImageUpload({ onImagesUploaded, maxImages = 5, initialImages = [] }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<string[]>(initialImages);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Update preview URLs when initialImages changes
    if (initialImages.length > 0) {
      setPreviewUrls(initialImages);
    }
  }, [initialImages]);

  const uploadImages = async (files: FileList) => {
    if (previewUrls.length + files.length > maxImages) {
      setError(`You can only upload up to ${maxImages} images`);
      return;
    }

    setUploading(true);
    setError(null);
    const uploadedUrls: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('item-images')
          .upload(filePath, file);

        if (uploadError) {
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('item-images')
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
      }

      const newUrls = [...previewUrls, ...uploadedUrls];
      setPreviewUrls(newUrls);
      onImagesUploaded(newUrls);
    } catch (err) {
      setError('Error uploading images. Please try again.');
      console.error('Error uploading images:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadImages(files);
    }
  };

  const removeImage = (index: number) => {
    const newUrls = previewUrls.filter((_, i) => i !== index);
    setPreviewUrls(newUrls);
    onImagesUploaded(newUrls);
  };

  return (
    <div>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      {previewUrls.length < maxImages && (
        <div
          className={`border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-500 transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
        >
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            id="image-upload"
            disabled={uploading}
          />
          <label htmlFor="image-upload" className="cursor-pointer">
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              {uploading ? 'Uploading...' : `Click to upload photos (${previewUrls.length}/${maxImages})`}
            </p>
            <p className="text-xs text-gray-500">PNG, JPG up to 10MB</p>
          </label>
        </div>
      )}
      {previewUrls.length > 0 && (
        <div className="mt-4 grid grid-cols-5 gap-4">
          {previewUrls.map((url, index) => (
            <div key={url} className="relative">
              <img
                src={url}
                alt={`Upload ${index + 1}`}
                className="w-full h-24 object-cover rounded-lg"
              />
              <button
                onClick={() => removeImage(index)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}