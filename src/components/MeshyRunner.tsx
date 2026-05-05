import { useState, useEffect, useRef } from 'react';
import { Play, Loader2, Download, Upload } from 'lucide-react';
import { CuratedModel } from '../data/curatedModels';
import {
  createTextTo3DTask,
  createImageTo3DTask,
  createMultiImageTo3DTask,
  pollTaskUntilComplete,
  createRetextureTask,
  pollRetextureUntilComplete,
  MeshyTaskResponse,
  MeshyTaskResponseWithEndpoint,
  MeshyRetextureResponse,
  MeshyTextTo3DPayload,
  MeshyImageTo3DPayload,
  MeshyMultiImageTo3DPayload,
  proxyMeshyAssetUrl
} from '../utils/meshyApi';
import { ModelViewer3D } from './ModelViewer3D';
import { saveMeshyGeneration } from '../utils/generationStorage';
import { convertGlbToStl } from '../utils/glbToStl';
import { uploadImage } from '../utils/imageUpload';

interface MeshyRunnerProps {
  curatedModel: CuratedModel;
  studentName: string;
  remixInputs?: Record<string, any> | null;
  onRemixConsumed?: () => void;
}

export function MeshyRunner({ curatedModel, studentName, remixInputs, onRemixConsumed }: MeshyRunnerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<MeshyTaskResponse | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const [shouldRetexture, setShouldRetexture] = useState(false);
  const [retextureResult, setRetextureResult] = useState<MeshyRetextureResponse | null>(null);
  const [retexturing, setRetexturing] = useState(false);
  const [retextureProgress, setRetextureProgress] = useState(0);

  const [convertingStl, setConvertingStl] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [textTo3DInputs, setTextTo3DInputs] = useState<MeshyTextTo3DPayload>({
    mode: 'preview',
    prompt: '',
    art_style: 'realistic',
    should_remesh: true,
  });

  const [imageTo3DInputs, setImageTo3DInputs] = useState<MeshyImageTo3DPayload>({
    image_url: '',
    enable_pbr: true,
    should_remesh: true,
    should_texture: true,
    save_pre_remeshed_model: false,
  });

  const [multiImageTo3DInputs, setMultiImageTo3DInputs] = useState<MeshyMultiImageTo3DPayload>({
    image_urls: ['', '', ''],
    should_remesh: true,
    should_texture: true,
    save_pre_remeshed_model: false,
    enable_pbr: true,
  });

  useEffect(() => {
    if (!remixInputs) return;
    if (curatedModel.id === 'meshy-text-to-3d') {
      setTextTo3DInputs(prev => ({ ...prev, ...remixInputs }));
    } else if (curatedModel.id === 'meshy-image-to-3d') {
      setImageTo3DInputs(prev => ({ ...prev, ...remixInputs }));
    } else if (curatedModel.id === 'meshy-multi-image-to-3d') {
      setMultiImageTo3DInputs(prev => ({ ...prev, ...remixInputs }));
    }
    onRemixConsumed?.();
  }, [remixInputs]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (loading && startTime) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [loading, startTime]);

  const handleGenerate = async () => {
    if (!studentName.trim()) {
      setError('Please log in first');
      return;
    }

    setLoading(true);
    setError('');
    setProgress(0);
    setResult(null);
    setRetextureResult(null);
    setRetextureProgress(0);
    setStartTime(Date.now());
    setElapsedTime(0);

    try {
      let taskResponse: MeshyTaskResponseWithEndpoint;

      if (curatedModel.id === 'meshy-text-to-3d') {
        if (!textTo3DInputs.prompt.trim()) {
          throw new Error('Please enter a prompt');
        }
        taskResponse = await createTextTo3DTask(textTo3DInputs);
      } else if (curatedModel.id === 'meshy-image-to-3d') {
        if (!imageTo3DInputs.image_url.trim()) {
          throw new Error('Please enter an image URL');
        }
        taskResponse = await createImageTo3DTask(imageTo3DInputs);
      } else if (curatedModel.id === 'meshy-multi-image-to-3d') {
        const validUrls = multiImageTo3DInputs.image_urls.filter(url => url.trim());
        if (validUrls.length < 2) {
          throw new Error('Please enter at least 2 image URLs');
        }
        taskResponse = await createMultiImageTo3DTask({
          ...multiImageTo3DInputs,
          image_urls: validUrls,
        });
      } else {
        throw new Error('Unknown Meshy model type');
      }

      const completed = await pollTaskUntilComplete(
        taskResponse.task_id,
        (p) => {
          setProgress(p);
        },
        taskResponse._endpoint
      );

      setResult(completed);
      setLoading(false);

      const processingTime = Math.floor((Date.now() - startTime!) / 1000);

      await saveMeshyGeneration({
        studentName,
        modelOwner: curatedModel.owner,
        modelName: curatedModel.modelName,
        modelId: curatedModel.id,
        inputs: curatedModel.id === 'meshy-text-to-3d' ? textTo3DInputs :
                curatedModel.id === 'meshy-image-to-3d' ? imageTo3DInputs : multiImageTo3DInputs,
        outputs: completed.model_urls?.glb ? [completed.model_urls.glb] : [],
        thumbnailUrl: completed.thumbnail_url || null,
        taskResult: completed,
        processingTime,
        estimatedCost: curatedModel.costPerUnit,
        timestamp: new Date().toISOString(),
      });

      if (shouldRetexture && completed.model_urls?.glb) {
        setRetexturing(true);
        try {
          const prompt = curatedModel.id === 'meshy-text-to-3d'
            ? textTo3DInputs.prompt
            : curatedModel.id === 'meshy-image-to-3d'
              ? 'a detailed realistic 3D object'
              : 'a detailed realistic 3D object';

          const retextureTask = await createRetextureTask({
            model_url: completed.model_urls.glb,
            text_style_prompt: `${prompt}, realistic materials, detailed surface textures`,
            enable_original_uv: true,
            enable_pbr: true,
          });

          const retextured = await pollRetextureUntilComplete(
            retextureTask.task_id,
            (p) => setRetextureProgress(p)
          );
          setRetextureResult(retextured);
        } catch (retextureErr) {
          console.error('Retexture failed:', retextureErr);
          setError(`Retexture failed: ${retextureErr instanceof Error ? retextureErr.message : 'Unknown error'}`);
        } finally {
          setRetexturing(false);
        }
      }

    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Generation failed');
    }
  };

  const isFormValid = () => {
    if (curatedModel.id === 'meshy-text-to-3d') {
      return textTo3DInputs.prompt.trim() !== '';
    } else if (curatedModel.id === 'meshy-image-to-3d') {
      return imageTo3DInputs.image_url.trim() !== '';
    } else if (curatedModel.id === 'meshy-multi-image-to-3d') {
      return multiImageTo3DInputs.image_urls.filter(url => url.trim()).length >= 2;
    }
    return false;
  };

  const handleDownloadStl = async (glbUrl: string) => {
    try {
      setConvertingStl(true);
      const proxiedUrl = proxyMeshyAssetUrl(glbUrl);
      const stlBlob = await convertGlbToStl(proxiedUrl);
      const url = URL.createObjectURL(stlBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'model.stl';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error converting to STL:', error);
      alert('Failed to convert model to STL format. The model may not be compatible.');
    } finally {
      setConvertingStl(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    setUploadError('');
    try {
      const imageUrl = await uploadImage(file);
      setImageTo3DInputs({ ...imageTo3DInputs, image_url: imageUrl });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleMultiImageUpload = async (file: File, index: number) => {
    setUploadingImage(true);
    setUploadError('');
    try {
      const imageUrl = await uploadImage(file);
      const newUrls = [...multiImageTo3DInputs.image_urls];
      newUrls[index] = imageUrl;
      setMultiImageTo3DInputs({ ...multiImageTo3DInputs, image_urls: newUrls });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          {curatedModel.name} - Inputs
        </h2>

        {curatedModel.id === 'meshy-text-to-3d' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mode
              </label>
              <select
                value={textTo3DInputs.mode}
                onChange={(e) => setTextTo3DInputs({ ...textTo3DInputs, mode: e.target.value as 'preview' | 'refine' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="preview">Preview (faster, lower quality)</option>
                <option value="refine">Refine (slower, higher quality)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prompt *
              </label>
              <textarea
                value={textTo3DInputs.prompt}
                onChange={(e) => setTextTo3DInputs({ ...textTo3DInputs, prompt: e.target.value })}
                placeholder="Describe the 3D model you want to create..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Art Style
              </label>
              <select
                value={textTo3DInputs.art_style}
                onChange={(e) => setTextTo3DInputs({ ...textTo3DInputs, art_style: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="realistic">Realistic</option>
                <option value="cartoon">Cartoon</option>
                <option value="low-poly">Low Poly</option>
                <option value="sculpture">Sculpture</option>
                <option value="pbr">PBR</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="should_remesh"
                checked={textTo3DInputs.should_remesh}
                onChange={(e) => setTextTo3DInputs({ ...textTo3DInputs, should_remesh: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="should_remesh" className="text-sm font-medium text-gray-700">
                Remesh (optimize topology)
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="text_retexture"
                checked={shouldRetexture}
                onChange={(e) => setShouldRetexture(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="text_retexture" className="text-sm font-medium text-gray-700">
                Retexture (colorise) — automatically applies realistic colours &amp; materials after generation
              </label>
            </div>
          </div>
        )}

        {curatedModel.id === 'meshy-image-to-3d' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Image URL *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={imageTo3DInputs.image_url}
                  onChange={(e) => setImageTo3DInputs({ ...imageTo3DInputs, image_url: e.target.value })}
                  placeholder="https://example.com/image.jpg or upload below"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {uploadingImage ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload
                    </>
                  )}
                </button>
              </div>
              {uploadError && (
                <p className="text-xs text-red-600 mt-1">{uploadError}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">Upload an image or paste a URL (max 10MB, JPEG/PNG/WebP)</p>
              {imageTo3DInputs.image_url && (
                <div className="mt-2">
                  <img
                    src={imageTo3DInputs.image_url}
                    alt="Preview"
                    className="w-32 h-32 object-cover rounded border border-gray-300"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enable_pbr"
                  checked={imageTo3DInputs.enable_pbr}
                  onChange={(e) => setImageTo3DInputs({ ...imageTo3DInputs, enable_pbr: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="enable_pbr" className="text-sm font-medium text-gray-700">
                  Enable PBR (Physically Based Rendering)
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="img_should_remesh"
                  checked={imageTo3DInputs.should_remesh}
                  onChange={(e) => setImageTo3DInputs({ ...imageTo3DInputs, should_remesh: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="img_should_remesh" className="text-sm font-medium text-gray-700">
                  Remesh (optimize topology)
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="should_texture"
                  checked={imageTo3DInputs.should_texture}
                  onChange={(e) => setImageTo3DInputs({ ...imageTo3DInputs, should_texture: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="should_texture" className="text-sm font-medium text-gray-700">
                  Apply texture
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="save_pre_remeshed"
                  checked={imageTo3DInputs.save_pre_remeshed_model}
                  onChange={(e) => setImageTo3DInputs({ ...imageTo3DInputs, save_pre_remeshed_model: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="save_pre_remeshed" className="text-sm font-medium text-gray-700">
                  Save pre-remeshed model
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="img_retexture"
                  checked={shouldRetexture}
                  onChange={(e) => setShouldRetexture(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="img_retexture" className="text-sm font-medium text-gray-700">
                  Retexture (colorise) — automatically applies realistic colours &amp; materials after generation
                </label>
              </div>
            </div>
          </div>
        )}

        {curatedModel.id === 'meshy-multi-image-to-3d' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Image URLs (minimum 2) *
              </label>
              {multiImageTo3DInputs.image_urls.map((url, index) => (
                <div key={index} className="mb-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => {
                        const newUrls = [...multiImageTo3DInputs.image_urls];
                        newUrls[index] = e.target.value;
                        setMultiImageTo3DInputs({ ...multiImageTo3DInputs, image_urls: newUrls });
                      }}
                      placeholder={`Image ${index + 1} URL or upload`}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    />
                    <input
                      ref={(el) => {
                        multiFileInputRefs.current[index] = el;
                      }}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleMultiImageUpload(file, index);
                      }}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => multiFileInputRefs.current[index]?.click()}
                      disabled={uploadingImage}
                      className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {uploadingImage ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {url && (
                    <div className="mt-2">
                      <img
                        src={url}
                        alt={`Preview ${index + 1}`}
                        className="w-24 h-24 object-cover rounded border border-gray-300"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
              {uploadError && (
                <p className="text-xs text-red-600 mb-2">{uploadError}</p>
              )}
              <button
                type="button"
                onClick={() => setMultiImageTo3DInputs({
                  ...multiImageTo3DInputs,
                  image_urls: [...multiImageTo3DInputs.image_urls, '']
                })}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                + Add another image
              </button>
              <p className="text-xs text-gray-500 mt-1">Upload images or paste URLs (max 10MB each, JPEG/PNG/WebP)</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="multi_enable_pbr"
                  checked={multiImageTo3DInputs.enable_pbr}
                  onChange={(e) => setMultiImageTo3DInputs({ ...multiImageTo3DInputs, enable_pbr: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="multi_enable_pbr" className="text-sm font-medium text-gray-700">
                  Enable PBR (Physically Based Rendering)
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="multi_should_remesh"
                  checked={multiImageTo3DInputs.should_remesh}
                  onChange={(e) => setMultiImageTo3DInputs({ ...multiImageTo3DInputs, should_remesh: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="multi_should_remesh" className="text-sm font-medium text-gray-700">
                  Remesh (optimize topology)
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="multi_should_texture"
                  checked={multiImageTo3DInputs.should_texture}
                  onChange={(e) => setMultiImageTo3DInputs({ ...multiImageTo3DInputs, should_texture: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="multi_should_texture" className="text-sm font-medium text-gray-700">
                  Apply texture
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="multi_save_pre_remeshed"
                  checked={multiImageTo3DInputs.save_pre_remeshed_model}
                  onChange={(e) => setMultiImageTo3DInputs({ ...multiImageTo3DInputs, save_pre_remeshed_model: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="multi_save_pre_remeshed" className="text-sm font-medium text-gray-700">
                  Save pre-remeshed model
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="multi_retexture"
                  checked={shouldRetexture}
                  onChange={(e) => setShouldRetexture(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="multi_retexture" className="text-sm font-medium text-gray-700">
                  Retexture (colorise) — automatically applies realistic colours &amp; materials after generation
                </label>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading || retexturing || !isFormValid()}
          className={`w-full mt-6 py-3 px-4 rounded-md font-medium flex items-center justify-center gap-2 transition-colors ${
            loading || retexturing || !isFormValid()
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {retexturing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Retexturing... {retextureProgress}%
            </>
          ) : loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating... {progress}% ({elapsedTime}s)
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              Generate 3D Model
            </>
          )}
        </button>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}
      </div>

      {result && result.model_urls?.glb && (
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Result</h2>

          <div className="mb-4">
            <ModelViewer3D modelUrl={result.model_urls.glb} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {result.model_urls.glb && (
              <a
                href={result.model_urls.glb}
                download
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download GLB
              </a>
            )}
            {result.model_urls.glb && (
              <button
                onClick={() => handleDownloadStl(result.model_urls!.glb!)}
                disabled={convertingStl}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {convertingStl ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Converting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Download STL
                  </>
                )}
              </button>
            )}
            {result.model_urls.fbx && (
              <a
                href={result.model_urls.fbx}
                download
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download FBX
              </a>
            )}
            {result.model_urls.usdz && (
              <a
                href={result.model_urls.usdz}
                download
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download USDZ
              </a>
            )}
            {result.model_urls.obj && (
              <a
                href={result.model_urls.obj}
                download
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download OBJ
              </a>
            )}
          </div>

          {result.thumbnail_url && (
            <div className="mt-4">
              <img
                src={result.thumbnail_url}
                alt="3D Model Thumbnail"
                className="w-full rounded-md border border-gray-200"
              />
            </div>
          )}
        </div>
      )}

      {retextureResult && retextureResult.model_urls?.glb && (
        <div className="bg-white p-6 rounded-lg shadow-md border border-blue-200">
          <h2 className="text-xl font-semibold text-gray-800 mb-1">Retextured Result</h2>
          <p className="text-sm text-gray-500 mb-4">Colours and materials applied automatically</p>

          <div className="mb-4">
            <ModelViewer3D modelUrl={retextureResult.model_urls.glb} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href={retextureResult.model_urls.glb}
              download
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download Retextured GLB
            </a>
            <button
              onClick={() => handleDownloadStl(retextureResult.model_urls!.glb!)}
              disabled={convertingStl}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {convertingStl ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download Retextured STL
                </>
              )}
            </button>
          </div>

          {retextureResult.thumbnail_url && (
            <div className="mt-4">
              <img
                src={retextureResult.thumbnail_url}
                alt="Retextured Model Thumbnail"
                className="w-full rounded-md border border-gray-200"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
