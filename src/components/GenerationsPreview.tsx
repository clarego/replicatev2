import { useState, useEffect } from 'react';
import { Image, Maximize2, Box } from 'lucide-react';
import { StudentGeneration } from '../types/generation';
import { supabase } from '../utils/supabase';
import { GenerationDetailModal } from './GenerationDetailModal';
import { ExpandedGalleryModal } from './ExpandedGalleryModal';
import { migrateReplicateDeliveryVideos } from '../utils/migrateGenerations';
import { useMobileDetection } from '../hooks/useMobileDetection';
import { cleanupOldStorageFiles, deleteGeneration } from '../utils/generationStorage';

interface GenerationsPreviewProps {
  isAdmin?: boolean;
  onRemix?: (generation: StudentGeneration) => void;
}

export function GenerationsPreview({ isAdmin = false, onRemix }: GenerationsPreviewProps) {
  const { isMobile } = useMobileDetection();
  const [generations, setGenerations] = useState<StudentGeneration[]>([]);
  const [selectedGeneration, setSelectedGeneration] = useState<StudentGeneration | null>(null);
  const [startIndex, setStartIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showExpandedGallery, setShowExpandedGallery] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationAttempted, setMigrationAttempted] = useState(false);
  const [failedThumbnails, setFailedThumbnails] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadGenerations(true);

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      loadGenerations(false);
    }, 30000);

    // Listen for custom event when a new generation is saved
    const handleGenerationSaved = () => {
      console.log('New generation saved, refreshing gallery...');
      loadGenerations(false);
    };
    window.addEventListener('generation-saved', handleGenerationSaved);

    return () => {
      clearInterval(interval);
      window.removeEventListener('generation-saved', handleGenerationSaved);
    };
  }, []);

  useEffect(() => {
    if (generations.length > 3) {
      const interval = setInterval(() => {
        setStartIndex((prev) => (prev + 3) % generations.length);
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [generations.length]);

  const loadGenerations = async (isInitialLoad: boolean = false) => {
    try {
      // Clean up old storage files and database records (8+ days old)
      if (isInitialLoad) {
        cleanupOldStorageFiles().catch(err =>
          console.error('Background cleanup failed:', err)
        );
      }

      // Clean up very old temporary records that failed to process
      const thirtyMinutesAgo = new Date();
      thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);

      await supabase
        .from('student_generations')
        .delete()
        .lt('created_at', thirtyMinutesAgo.toISOString())
        .is('content_url', null);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from('student_generations')
        .select('*')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      // Show all generations with valid content URLs
      const validGenerations = (data || []).filter(gen => {
        return gen.content_url && gen.content_url.length > 0;
      });

      setGenerations(validGenerations);

      // Only check for migration on initial load and if not already attempted
      if (isInitialLoad && !migrationAttempted) {
        const hasReplicateVideos = validGenerations.some(gen =>
          gen.generation_type === 'video' && gen.content_url.includes('replicate.delivery')
        );

        if (hasReplicateVideos) {
          setMigrating(true);
          setMigrationAttempted(true);
          console.log('Found replicate.delivery videos, starting migration...');
          migrateReplicateDeliveryVideos().finally(() => {
            setMigrating(false);
            // Reload to show migrated videos
            setTimeout(() => loadGenerations(false), 2000);
          });
        }
      }
    } catch (error) {
      console.error('Error loading generations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getVisibleGenerations = () => {
    if (generations.length === 0) return [];
    if (generations.length <= 3) return generations;

    const visible = [];
    for (let i = 0; i < 3; i++) {
      visible.push(generations[(startIndex + i) % generations.length]);
    }
    return visible;
  };

  const visibleGenerations = getVisibleGenerations();

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
        <div className="flex items-center justify-center h-24 sm:h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (generations.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
        <div className="text-center">
          <Image className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-xs sm:text-sm text-gray-500">No student generations yet</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-2 sm:px-3 py-1.5 sm:py-2">
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Image className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <h3 className="text-xs sm:text-sm font-semibold">Student Generations</h3>
              {migrating && (
                <div className="flex items-center gap-1">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                  <span className="text-[10px]">Processing...</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs">{generations.length} total</span>
              <button
                onClick={() => setShowExpandedGallery(true)}
                className="p-1 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
                title="Expand gallery"
              >
                <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-4">
          <div className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-3'} gap-2 sm:gap-3`}>
            {visibleGenerations.map((gen) => {
              const thumbnailFailed = failedThumbnails.has(gen.id);
              const shouldUseThumbnail = gen.thumbnail_url && !thumbnailFailed && !gen.thumbnail_url.endsWith('.mp4');

              return (
                <button
                  key={gen.id}
                  onClick={() => setSelectedGeneration(gen)}
                  className="flex flex-col gap-1.5 sm:gap-2 hover:opacity-80 transition-opacity group"
                >
                  <div className="aspect-square bg-gray-900 rounded-md sm:rounded-lg overflow-hidden border-2 border-transparent group-hover:border-blue-400 transition-colors relative">
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
                            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white bg-opacity-90 rounded-full flex items-center justify-center">
                              <div className="w-0 h-0 border-l-[8px] sm:border-l-[10px] border-l-gray-800 border-t-[6px] sm:border-t-[7px] border-t-transparent border-b-[6px] sm:border-b-[7px] border-b-transparent ml-1"></div>
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
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white bg-opacity-90 rounded-full flex items-center justify-center">
                            <div className="w-0 h-0 border-l-[8px] sm:border-l-[10px] border-l-gray-800 border-t-[6px] sm:border-t-[7px] border-t-transparent border-b-[6px] sm:border-b-[7px] border-b-transparent ml-1"></div>
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
                    <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                      {gen.student_name}
                    </p>
                    <p className="text-[10px] sm:text-xs text-gray-500">
                      {new Date(gen.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {selectedGeneration && (
        <GenerationDetailModal
          generation={selectedGeneration}
          onClose={() => setSelectedGeneration(null)}
          isAdmin={isAdmin}
          onDelete={async (id) => {
            await deleteGeneration(id);
            setSelectedGeneration(null);
            loadGenerations(false);
          }}
          onRemix={onRemix}
        />
      )}

      {showExpandedGallery && (
        <ExpandedGalleryModal
          generations={generations}
          onClose={() => setShowExpandedGallery(false)}
          onSelectGeneration={setSelectedGeneration}
          isAdmin={isAdmin}
          onDelete={async (id) => {
            await deleteGeneration(id);
            loadGenerations(false);
          }}
        />
      )}
    </>
  );
}
