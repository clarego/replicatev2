import { useState } from 'react';
import { Film, Image as ImageIcon, Loader2, Info, Box, X, QrCode, Music, MessageSquare, Megaphone, ZoomIn } from 'lucide-react';
import { Model } from '../types/replicate';
import { fetchModel, ReplicateAPIError } from '../utils/replicateApi';
import { curatedModels, CuratedModel } from '../data/curatedModels';

interface CuratedModelSelectorProps {
  onModelLoaded: (model: Model, curatedModel?: CuratedModel) => void;
  onMeshyModelSelected?: (curatedModel: CuratedModel) => void;
  onUpscalerSelected?: () => void;
}

type Category = 'video' | 'photo' | '3d' | 'qr' | 'audio' | 'llm' | 'ads' | 'meshy3d' | 'upscaler';

export function CuratedModelSelector({ onModelLoaded, onMeshyModelSelected, onUpscalerSelected }: CuratedModelSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<Category>('photo');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedModelInfo, setSelectedModelInfo] = useState<string | null>(null);

  const filteredModels = curatedModels.filter(m => m.category === selectedCategory);

  const handleCategorySelect = (cat: Category) => {
    if (cat === 'upscaler') {
      setSelectedCategory('upscaler');
      onUpscalerSelected?.();
      return;
    }
    setSelectedCategory(cat);
  };

  const handleLoadModel = async (curatedModel: CuratedModel) => {
    setError('');
    setLoading(true);

    try {
      if (curatedModel.isMeshy) {
        if (onMeshyModelSelected) {
          onMeshyModelSelected(curatedModel);
        }
      } else {
        const model = await fetchModel(curatedModel.owner, curatedModel.modelName, true);
        onModelLoaded(model, curatedModel);
      }
    } catch (err) {
      if (err instanceof ReplicateAPIError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to load model');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md border border-gray-200">
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        {selectedCategory === 'video' ? (
          <Film className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
        ) : selectedCategory === '3d' ? (
          <Box className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
        ) : selectedCategory === 'meshy3d' ? (
          <Box className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
        ) : selectedCategory === 'qr' ? (
          <QrCode className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
        ) : selectedCategory === 'audio' ? (
          <Music className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
        ) : selectedCategory === 'llm' ? (
          <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
        ) : selectedCategory === 'ads' ? (
          <Megaphone className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
        ) : selectedCategory === 'upscaler' ? (
          <ZoomIn className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600" />
        ) : (
          <ImageIcon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
        )}
        <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Select Model</h2>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4 sm:mb-6">
        <button
          onClick={() => handleCategorySelect('photo')}
          className={`py-2 sm:py-3 px-2 sm:px-4 rounded-lg font-medium transition-all text-sm sm:text-base ${
            selectedCategory === 'photo'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <div className="flex items-center justify-center gap-1 sm:gap-2">
            <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden xs:inline sm:inline">Images</span>
            <span className="xs:hidden sm:hidden">Img</span>
          </div>
        </button>
        <button
          onClick={() => handleCategorySelect('video')}
          className={`py-2 sm:py-3 px-2 sm:px-4 rounded-lg font-medium transition-all text-sm sm:text-base ${
            selectedCategory === 'video'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <div className="flex items-center justify-center gap-1 sm:gap-2">
            <Film className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden xs:inline sm:inline">Videos</span>
            <span className="xs:hidden sm:hidden">Vid</span>
          </div>
        </button>
        <button
          onClick={() => handleCategorySelect('3d')}
          className={`py-2 sm:py-3 px-2 sm:px-4 rounded-lg font-medium transition-all text-sm sm:text-base ${
            selectedCategory === '3d'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <div className="flex items-center justify-center gap-1 sm:gap-2">
            <Box className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>3D</span>
          </div>
        </button>
        <button
          onClick={() => handleCategorySelect('qr')}
          className={`py-2 sm:py-3 px-2 sm:px-4 rounded-lg font-medium transition-all text-sm sm:text-base ${
            selectedCategory === 'qr'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <div className="flex items-center justify-center gap-1 sm:gap-2">
            <QrCode className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>QR</span>
          </div>
        </button>
        <button
          onClick={() => handleCategorySelect('audio')}
          className={`py-2 sm:py-3 px-2 sm:px-4 rounded-lg font-medium transition-all text-sm sm:text-base ${
            selectedCategory === 'audio'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <div className="flex items-center justify-center gap-1 sm:gap-2">
            <Music className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Audio</span>
          </div>
        </button>
        <button
          onClick={() => handleCategorySelect('llm')}
          className={`py-2 sm:py-3 px-2 sm:px-4 rounded-lg font-medium transition-all text-sm sm:text-base ${
            selectedCategory === 'llm'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <div className="flex items-center justify-center gap-1 sm:gap-2">
            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>LLM</span>
          </div>
        </button>
        <button
          onClick={() => handleCategorySelect('ads')}
          className={`py-2 sm:py-3 px-2 sm:px-4 rounded-lg font-medium transition-all text-sm sm:text-base ${
            selectedCategory === 'ads'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <div className="flex items-center justify-center gap-1 sm:gap-2">
            <Megaphone className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Ads</span>
          </div>
        </button>
        <button
          onClick={() => handleCategorySelect('meshy3d')}
          className={`py-2 sm:py-3 px-2 sm:px-4 rounded-lg font-medium transition-all text-sm sm:text-base ${
            selectedCategory === 'meshy3d'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <div className="flex items-center justify-center gap-1 sm:gap-2">
            <Box className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden xs:inline sm:inline">Meshy 3D</span>
            <span className="xs:hidden sm:hidden">M3D</span>
          </div>
        </button>
        <button
          onClick={() => handleCategorySelect('upscaler')}
          className={`py-2 sm:py-3 px-2 sm:px-4 rounded-lg font-medium transition-all text-sm sm:text-base ${
            selectedCategory === 'upscaler'
              ? 'bg-teal-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <div className="flex items-center justify-center gap-1 sm:gap-2">
            <ZoomIn className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden xs:inline sm:inline">Upscaler</span>
            <span className="xs:hidden sm:hidden">Up</span>
          </div>
        </button>
      </div>

      {selectedCategory === 'upscaler' && (
        <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg text-center">
          <ZoomIn className="w-8 h-8 text-teal-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-teal-800">Image Upscaler loaded</p>
          <p className="text-xs text-teal-600 mt-1">daanelson/real-esrgan-a100 — upscale images up to 10x</p>
        </div>
      )}

      <div className={`space-y-2 max-h-48 sm:max-h-64 overflow-y-auto overflow-x-visible ${selectedCategory === 'upscaler' ? 'hidden' : ''}`}>
        {filteredModels.map((model) => (
          <div key={model.id} className="relative">
            <div className="w-full flex items-start gap-2 p-3 sm:p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all">
              <button
                onClick={() => handleLoadModel(model)}
                disabled={loading}
                className="flex-1 text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="font-medium text-gray-900 text-sm sm:text-base">{model.name}</div>
                <div className="text-xs sm:text-sm text-gray-500 font-mono mt-1 break-all">
                  {model.owner}/{model.modelName.length > 25 ? model.modelName.substring(0, 25) + '...' : model.modelName}
                </div>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedModelInfo(model.id);
                }}
                className="p-1.5 sm:p-2 hover:bg-blue-100 rounded-lg transition-colors flex-shrink-0"
                title="View model information"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-blue-600" />
                ) : (
                  <Info className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 hover:text-blue-700" />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedModelInfo && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setSelectedModelInfo(null)}
          />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white border-4 border-blue-600 p-4 sm:p-6 rounded-xl shadow-2xl max-w-md w-11/12 sm:w-full max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedModelInfo(null)}
              className="absolute top-2 right-2 sm:top-4 sm:right-4 p-1 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
            <div className="absolute -top-2 -left-2 bg-blue-600 text-white px-2 sm:px-3 py-1 rounded-full text-xs font-bold">
              Model Info
            </div>
            {(() => {
              const model = filteredModels.find(m => m.id === selectedModelInfo);
              if (!model) return null;
              return (
                <>
                  <div className="mb-3 sm:mb-4 pr-6 sm:pr-8">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">{model.name}</h3>
                    <p className="text-xs sm:text-sm text-gray-600 font-mono break-all">
                      {model.owner}/{model.modelName}
                    </p>
                  </div>
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 sm:mb-2">
                        Purpose
                      </div>
                      <div className="text-sm sm:text-base text-gray-800 leading-relaxed">{model.purpose}</div>
                    </div>
                    <div className="border-t pt-3 sm:pt-4">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 sm:mb-2">
                        Cost
                      </div>
                      <div className="text-xl sm:text-2xl font-bold text-green-600 font-mono">
                        ${model.costPerUnit.toFixed(4)}
                        <span className="text-xs sm:text-sm font-normal text-gray-600 ml-1 sm:ml-2">
                          {model.costUnit}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 sm:mt-6 text-center">
                    <p className="text-xs text-gray-500 italic">
                      Click the model name to load it
                    </p>
                  </div>
                </>
              );
            })()}
          </div>
        </>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
    </div>
  );
}
