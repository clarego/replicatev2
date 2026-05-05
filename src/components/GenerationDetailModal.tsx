import { useState } from 'react';
import { X, User, Clock, Cpu, Code, Download, AlertCircle, Timer, Trash2, Loader2, Shuffle } from 'lucide-react';
import { StudentGeneration, isGenerationExpired, getTimeUntilExpiry } from '../types/generation';
import { ModelViewer3D } from './ModelViewer3D';

interface GenerationDetailModalProps {
  generation: StudentGeneration;
  onClose: () => void;
  isAdmin?: boolean;
  onDelete?: (id: string) => Promise<void>;
  onRemix?: (generation: StudentGeneration) => void;
}

export function GenerationDetailModal({ generation, onClose, isAdmin = false, onDelete, onRemix }: GenerationDetailModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!confirm(`Delete this generation by ${generation.student_name}? This cannot be undone.`)) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(generation.id);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete');
      setDeleting(false);
    }
  };
  const isExpired = isGenerationExpired(generation);
  const timeRemaining = getTimeUntilExpiry(generation);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDownload = () => {
    if (isExpired) return;

    const link = document.createElement('a');
    link.href = generation.content_url;
    link.download = `${generation.student_name}_${generation.model_name}_${generation.id}.${getFileExtension(generation.generation_type)}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getFileExtension = (type: string) => {
    const extensions: Record<string, string> = {
      image: 'png',
      video: 'mp4',
      audio: 'mp3',
      text: 'txt',
      '3d': 'glb',
    };
    return extensions[type] || 'file';
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-white">Generation Details</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {isExpired && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900">File Download Expired</p>
                <p className="text-sm text-amber-700 mt-1">
                  This generation is older than 1 hour. The file is no longer available for download, but a preview is retained to prevent misuse.
                </p>
              </div>
            </div>
          )}

          {!isExpired && (
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
              <Timer className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">Download Available</p>
                <p className="text-sm text-blue-700 mt-1">
                  Files are available for download for 1 hour after generation. {timeRemaining}.
                </p>
              </div>
            </div>
          )}

          <div className="mb-6">
            <div className="bg-gray-900 rounded-lg overflow-hidden relative">
              {isExpired && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-10">
                  <div className="bg-white/95 rounded-lg p-6 max-w-md mx-4 text-center">
                    <AlertCircle className="w-12 h-12 text-amber-600 mx-auto mb-3" />
                    <p className="text-lg font-semibold text-gray-900 mb-2">Preview Only</p>
                    <p className="text-sm text-gray-600">
                      This generation has expired. Full quality downloads are only available for 1 hour after generation.
                    </p>
                  </div>
                </div>
              )}
              {generation.generation_type === 'image' ? (
                <img
                  src={generation.content_url}
                  alt={`Generation by ${generation.student_name}`}
                  className="w-full h-auto"
                />
              ) : generation.generation_type === 'video' ? (
                <>
                  {isExpired && generation.thumbnail_url ? (
                    <img
                      src={generation.thumbnail_url}
                      alt={`Video by ${generation.student_name}`}
                      className="w-full h-auto"
                    />
                  ) : (
                    <video
                      src={generation.content_url}
                      controls={!isExpired}
                      className="w-full h-auto"
                      autoPlay={!isExpired}
                      loop
                    >
                      Your browser does not support the video tag.
                    </video>
                  )}
                </>
              ) : generation.generation_type === 'audio' ? (
                <div className="p-8 flex items-center justify-center">
                  <audio src={generation.content_url} controls={!isExpired} className="w-full max-w-md">
                    Your browser does not support the audio tag.
                  </audio>
                </div>
              ) : generation.generation_type === '3d' ? (
                <div className="p-4">
                  <ModelViewer3D modelUrl={generation.content_url} />
                </div>
              ) : (
                <div className="p-8 text-white">
                  <pre className="whitespace-pre-wrap text-sm">{generation.content_url}</pre>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3 pb-4 border-b border-gray-200">
              <User className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500">Student Name</p>
                <p className="text-lg font-semibold text-gray-900">{generation.student_name}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 pb-4 border-b border-gray-200">
              <Clock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500">Generated At</p>
                <p className="text-lg font-semibold text-gray-900">{formatDate(generation.created_at)}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 pb-4 border-b border-gray-200">
              <Cpu className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500">Model Used</p>
                <p className="text-lg font-semibold text-gray-900">{generation.model_name}</p>
                {generation.model_version && (
                  <p className="text-sm text-gray-600 mt-1">Version: {generation.model_version}</p>
                )}
              </div>
            </div>

            {Object.keys(generation.input_data).length > 0 && (
              <div className="flex items-start gap-3">
                <Code className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500 mb-2">Input Parameters</p>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    {Object.entries(generation.input_data).map(([key, value]) => (
                      <div key={key} className="flex flex-col sm:flex-row sm:items-start gap-1">
                        <span className="text-sm font-medium text-gray-700 min-w-[120px]">{key}:</span>
                        <span className="text-sm text-gray-900 break-words flex-1">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {deleteError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {deleteError}
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-gray-200 flex items-center justify-between flex-wrap gap-3">
            <div>
              {isAdmin && onDelete && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
                >
                  {deleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {generation.generation_type === '3d' && onRemix && (
                <button
                  onClick={() => { onRemix(generation); onClose(); }}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
                >
                  <Shuffle className="w-4 h-4" />
                  Remix in Interface
                </button>
              )}
              {!isExpired ? (
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
                >
                  <Download className="w-5 h-5" />
                  Download File
                </button>
              ) : (
                <div className="flex items-center gap-2 text-gray-500">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Download no longer available</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
