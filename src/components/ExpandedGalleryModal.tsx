import { useState, useEffect } from 'react';
import { X, Search, ChevronLeft, ChevronRight, Trash2, Box } from 'lucide-react';
import { StudentGeneration } from '../types/generation';

interface ExpandedGalleryModalProps {
  generations: StudentGeneration[];
  onClose: () => void;
  onSelectGeneration: (generation: StudentGeneration) => void;
  isAdmin?: boolean;
  onDelete?: (id: string) => Promise<void>;
}

const ITEMS_PER_PAGE = 24;

export function ExpandedGalleryModal({ generations, onClose, onSelectGeneration, isAdmin = false, onDelete }: ExpandedGalleryModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [failedThumbnails, setFailedThumbnails] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, gen: StudentGeneration) => {
    e.stopPropagation();
    if (!onDelete) return;
    if (!confirm(`Delete this generation by ${gen.student_name}?`)) return;

    setDeletingId(gen.id);
    try {
      await onDelete(gen.id);
    } catch {
      alert('Failed to delete generation');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredGenerations = generations.filter(gen =>
    gen.student_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredGenerations.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentGenerations = filteredGenerations.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">All Student Generations</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="mt-2 text-sm text-gray-600">
            Showing {currentGenerations.length} of {filteredGenerations.length} generations
            {searchQuery && ` matching "${searchQuery}"`}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {currentGenerations.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-500">
                {searchQuery ? 'No generations found matching your search' : 'No generations available'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {currentGenerations.map((gen) => {
                const thumbnailFailed = failedThumbnails.has(gen.id);
                const shouldUseThumbnail = gen.thumbnail_url && !thumbnailFailed && !gen.thumbnail_url.endsWith('.mp4');

                return (
                  <button
                    key={gen.id}
                    onClick={() => {
                      onSelectGeneration(gen);
                      onClose();
                    }}
                    className="relative flex flex-col gap-2 hover:opacity-80 transition-opacity group"
                  >
                    <div className="aspect-square bg-gray-900 rounded-lg overflow-hidden border-2 border-transparent group-hover:border-blue-400 transition-colors relative">
                      {shouldUseThumbnail ? (
                        <>
                          <img
                            src={gen.thumbnail_url}
                            alt={`By ${gen.student_name}`}
                            className="w-full h-full object-cover"
                            onError={() => {
                              setFailedThumbnails(prev => new Set(prev).add(gen.id));
                            }}
                          />
                          {gen.generation_type === 'video' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                              <div className="w-10 h-10 bg-white bg-opacity-90 rounded-full flex items-center justify-center">
                                <div className="w-0 h-0 border-l-[10px] border-l-gray-800 border-t-[7px] border-t-transparent border-b-[7px] border-b-transparent ml-1"></div>
                              </div>
                            </div>
                          )}
                        </>
                      ) : gen.generation_type === 'image' ? (
                        <img
                          src={gen.content_url}
                          alt={`By ${gen.student_name}`}
                          className="w-full h-full object-cover"
                        />
                      ) : gen.generation_type === 'video' ? (
                        <>
                          <video
                            src={gen.content_url}
                            className="w-full h-full object-cover"
                            muted
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                            <div className="w-10 h-10 bg-white bg-opacity-90 rounded-full flex items-center justify-center">
                              <div className="w-0 h-0 border-l-[10px] border-l-gray-800 border-t-[7px] border-t-transparent border-b-[7px] border-b-transparent ml-1"></div>
                            </div>
                          </div>
                        </>
                      ) : gen.generation_type === '3d' ? (
                        gen.thumbnail_url && !thumbnailFailed ? (
                          <img
                            src={gen.thumbnail_url}
                            alt={`3D by ${gen.student_name}`}
                            className="w-full h-full object-cover"
                            onError={() => setFailedThumbnails(prev => new Set(prev).add(gen.id))}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-gray-800 to-gray-900">
                            <Box className="w-8 h-8 text-blue-400" />
                            <span className="text-[10px] text-gray-400">3D Model</span>
                          </div>
                        )
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white text-xs">
                          {gen.generation_type}
                        </div>
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {gen.student_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(gen.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {isAdmin && onDelete && (
                      <button
                        onClick={(e) => handleDelete(e, gen)}
                        disabled={deletingId === gen.id}
                        className="absolute top-1.5 right-1.5 p-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        title="Delete generation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-200">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed text-gray-700 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              Previous
            </button>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
            </div>

            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed text-gray-700 rounded-lg transition-colors"
            >
              Next
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
