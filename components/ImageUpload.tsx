
import React, { useState, useCallback, useRef } from 'react';

interface ImageUploadProps {
  onImageUpload: (base64Image: string, imageType: string) => void;
  isLoading: boolean;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ onImageUpload, isLoading }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Invalid file type. Please upload an image (jpeg, png, gif, webp).');
        setPreview(null);
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
         setError('File is too large. Maximum size is 5MB.');
         setPreview(null);
         return;
      }
      setError(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setPreview(reader.result as string);
        onImageUpload(base64String, file.type);
      };
      reader.onerror = () => {
        setError('Failed to read file.');
        setPreview(null);
      }
      reader.readAsDataURL(file);
    }
  }, [onImageUpload]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="p-4 border border-gray-300 rounded-lg shadow-sm bg-white h-full flex flex-col justify-center items-center">
      <input
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileChange}
        className="hidden"
        ref={fileInputRef}
        disabled={isLoading}
      />
      {preview ? (
        <div className="w-full text-center">
          <img src={preview} alt="Uploaded preview" className="max-w-full max-h-64 h-auto object-contain mx-auto mb-4 rounded" />
          <button
            onClick={handleUploadClick}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-md transition duration-150 ease-in-out disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : 'Change Image'}
          </button>
        </div>
      ) : (
        <button
          onClick={handleUploadClick}
          className="w-full h-48 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-500 transition duration-150 ease-in-out text-gray-500 disabled:opacity-50"
          disabled={isLoading}
        >
          <i className="fas fa-cloud-upload-alt fa-3x mb-2"></i>
          <span>{isLoading ? 'Processing...' : 'Click to Upload Image'}</span>
          <span className="text-xs mt-1">(Max 5MB: JPG, PNG, GIF, WEBP)</span>
        </button>
      )}
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  );
};

export default ImageUpload;
