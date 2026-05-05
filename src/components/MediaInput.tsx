import { useState, useEffect } from 'react';
import { InputProperty } from '../types/replicate';
import { uploadImageToStorage } from '../utils/supabase';

export function MediaInput({
  keyName,
  value,
  onChange,
  prop
}: {
  keyName: string;
  value: any;
  onChange: (key: string, value: any) => void;
  prop: InputProperty;
}) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    console.log(`MediaInput [${keyName}] value changed:`, value);
    if (value && typeof value === 'string' && value.startsWith('http')) {
      console.log(`MediaInput [${keyName}] setting preview:`, value);
      setPreview(value);
    } else if (!value || (typeof value === 'string' && !value.startsWith('http'))) {
      console.log(`MediaInput [${keyName}] clearing preview`);
      setPreview(null);
    }
  }, [value, keyName]);

  const processFile = async (file: File) => {
    setUploading(true);
    try {
      console.log('Uploading file:', file.name);
      const publicUrl = await uploadImageToStorage(file);
      console.log('Upload successful, public URL:', publicUrl);
      onChange(keyName, publicUrl);
      setPreview(publicUrl);
      console.log('Updated field:', keyName, 'with URL:', publicUrl);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    await processFile(file);
  };

  const keyLower = keyName.toLowerCase();
  const descLower = prop.description?.toLowerCase() || '';

  let acceptTypes = '*/*';
  let fileType = 'file';

  // Check key name first (higher priority), then description
  // Check audio before video to avoid matching "audio to video" as video
  if (keyLower.includes('image')) {
    acceptTypes = 'image/*';
    fileType = 'image';
  } else if (keyLower.includes('audio')) {
    acceptTypes = 'audio/*';
    fileType = 'audio';
  } else if (keyLower.includes('video')) {
    acceptTypes = 'video/*';
    fileType = 'video';
  } else if (descLower.includes('image')) {
    acceptTypes = 'image/*';
    fileType = 'image';
  } else if (descLower.includes('audio')) {
    acceptTypes = 'audio/*';
    fileType = 'audio';
  } else if (descLower.includes('video')) {
    acceptTypes = 'video/*';
    fileType = 'video';
  }

  return (
    <div className="space-y-3">
      {preview && fileType === 'image' && (
        <div className="border-2 border-blue-200 rounded-lg p-3 bg-blue-50">
          <p className="text-xs font-medium text-gray-700 mb-2">Preview:</p>
          <img
            src={preview}
            alt="Preview"
            className="w-full h-auto max-h-64 object-contain rounded-lg border border-gray-300 bg-white"
          />
        </div>
      )}
      {preview && fileType === 'video' && (
        <div className="border-2 border-blue-200 rounded-lg p-3 bg-blue-50">
          <p className="text-xs font-medium text-gray-700 mb-2">Preview:</p>
          <video
            src={preview}
            controls
            className="w-full max-h-64 rounded-lg border border-gray-300 bg-white"
          />
        </div>
      )}
      {preview && fileType === 'audio' && (
        <div className="border-2 border-blue-200 rounded-lg p-3 bg-blue-50">
          <p className="text-xs font-medium text-gray-700 mb-2">Preview:</p>
          <audio src={preview} controls className="w-full" />
        </div>
      )}

      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
        } ${uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <svg
              className={`w-12 h-12 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`}
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-700">
              {isDragging ? `Drop ${fileType} here` : `Drag and drop ${fileType} here`}
            </p>
            <p className="text-xs text-gray-500">or click to browse files</p>
          </div>
          <input
            type="file"
            id={`${keyName}-file`}
            accept={acceptTypes}
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
          <label
            htmlFor={`${keyName}-file`}
            className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg cursor-pointer transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading...' : `Browse Files`}
          </label>
        </div>
      </div>

      <div className="space-y-1.5 sm:space-y-2">
        <label className="block text-[10px] sm:text-xs font-medium text-gray-600">Or enter URL:</label>
        <input
          type="text"
          id={keyName}
          value={value || ''}
          onChange={(e) => {
            onChange(keyName, e.target.value);
            if (e.target.value.startsWith('http')) {
              setPreview(e.target.value);
            }
          }}
          placeholder="https://example.com/image.jpg"
          className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-[10px] sm:text-xs"
        />
      </div>
    </div>
  );
}
