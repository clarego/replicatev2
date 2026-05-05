import { useState, useRef, useEffect } from 'react';
import { Play, Loader2, Download, ZoomIn, RefreshCw } from 'lucide-react';
import { fetchModel, createPrediction, getPrediction, clearVersionCache } from '../utils/replicateApi';
import { saveGeneration } from '../utils/generationStorage';
import { Model, Prediction } from '../types/replicate';
import { ExamplesDisplay } from './ExamplesDisplay';
import { MediaInput } from './MediaInput';
import { ModelExample } from '../data/curatedModels';

const EXAMPLES: ModelExample[] = [
  {
    name: 'Face Enhancement (4x)',
    input: {
      image: 'https://replicate.delivery/pbxt/IS6z50uYJFdFeh1vCmXe9zasYbG16HqOOMETljyUJ1hmlUXU/keanu.jpeg',
      scale: 4,
      face_enhance: true,
    },
    output: 'https://replicate.delivery/pbxt/lv0iOW3u6DrNOd30ybfmufqWebiuW10YjILw05YZGbeipZZCB/output.png',
  },
];

// Minimal prop shape for MediaInput
const IMAGE_PROP = { type: 'string' as const, format: 'uri', title: 'Image' };

const OWNER = 'daanelson';
const MODEL_NAME = 'real-esrgan-a100';

interface ImageUpscalerRunnerProps {
  studentName: string;
}

export function ImageUpscalerRunner({ studentName }: ImageUpscalerRunnerProps) {
  const [model, setModel] = useState<Model | null>(null);
  const [loadingModel, setLoadingModel] = useState(true);
  const [modelError, setModelError] = useState('');

  const [imageUrl, setImageUrl] = useState('');
  const [scale, setScale] = useState(4);
  const [faceEnhance, setFaceEnhance] = useState(false);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [outputUrl, setOutputUrl] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadLatestVersion();
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (running && startTime) {
      interval = setInterval(() => setElapsedTime(Math.floor((Date.now() - startTime) / 1000)), 100);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [running, startTime]);

  const loadLatestVersion = async (forceRefresh = false) => {
    setLoadingModel(true);
    setModelError('');
    if (forceRefresh) clearVersionCache(OWNER, MODEL_NAME);
    try {
      const m = await fetchModel(OWNER, MODEL_NAME, forceRefresh);
      setModel(m);
    } catch (err) {
      setModelError(err instanceof Error ? err.message : 'Failed to load model');
    } finally {
      setLoadingModel(false);
    }
  };

  const handleRun = async () => {
    if (!model || !imageUrl.trim() || !studentName.trim()) return;
    setRunning(true);
    setError('');
    setOutputUrl('');
    setStartTime(Date.now());
    setElapsedTime(0);

    try {
      const input = { image: imageUrl.trim(), scale, face_enhance: faceEnhance };
      const prediction = await createPrediction(model.latest_version.id, input);
      const result = await pollPrediction(prediction.id);
      setOutputUrl(typeof result.output === 'string' ? result.output : Array.isArray(result.output) ? result.output[0] : '');
      await saveGeneration(result, studentName, model, input);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upscaling failed');
    } finally {
      setRunning(false);
    }
  };

  const pollPrediction = (id: string): Promise<Prediction> =>
    new Promise((resolve, reject) => {
      const check = async () => {
        try {
          const p = await getPrediction(id);
          if (p.status === 'succeeded') return resolve(p);
          if (p.status === 'failed') return reject(new Error(p.error || 'Prediction failed'));
          pollRef.current = setTimeout(check, 1500);
        } catch (err) {
          reject(err);
        }
      };
      check();
    });

  const handleUseExample = (exampleInputs: Record<string, any>) => {
    if (exampleInputs.image) setImageUrl(String(exampleInputs.image));
    if (exampleInputs.scale !== undefined) setScale(Number(exampleInputs.scale));
    if (exampleInputs.face_enhance !== undefined) setFaceEnhance(Boolean(exampleInputs.face_enhance));
    setOutputUrl('');
    setError('');
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <ZoomIn className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-semibold text-gray-800">Image Upscaler</h2>
                <p className="text-xs text-gray-500 font-mono">{OWNER}/{MODEL_NAME}</p>
              </div>
            </div>
            <button
              onClick={() => loadLatestVersion(true)}
              disabled={loadingModel}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
              title="Refresh to latest model version"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingModel ? 'animate-spin' : ''}`} />
              {loadingModel ? 'Loading...' : 'Refresh Version'}
            </button>
          </div>

          {modelError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">{modelError}</div>
          )}

          {!loadingModel && model && (
            <p className="text-xs text-gray-400 mb-4 font-mono">Version: {model.latest_version.id.substring(0, 16)}...</p>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Image <span className="text-red-500">*</span>
              </label>
              <MediaInput
                keyName="image"
                value={imageUrl}
                onChange={(_, url) => setImageUrl(String(url))}
                prop={IMAGE_PROP}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Scale Factor: <span className="text-blue-600 font-bold">{scale}x</span>
              </label>
              <input
                type="range"
                min={2}
                max={10}
                step={1}
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>2x</span>
                <span>4x (default)</span>
                <span>10x</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="face_enhance"
                checked={faceEnhance}
                onChange={(e) => setFaceEnhance(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="face_enhance" className="text-sm font-medium text-gray-700">
                Face Enhancement — improve facial details
              </label>
            </div>
          </div>

          <button
            onClick={handleRun}
            disabled={running || loadingModel || !imageUrl.trim() || !studentName.trim()}
            className={`w-full mt-6 py-3 px-4 rounded-md font-medium flex items-center justify-center gap-2 transition-colors ${
              running || loadingModel || !imageUrl.trim() || !studentName.trim()
                ? 'bg-gray-400 cursor-not-allowed text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {running ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Upscaling... ({elapsedTime}s)
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Upscale Image
              </>
            )}
          </button>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}
        </div>

        <ExamplesDisplay
          examples={EXAMPLES}
          onUseExample={handleUseExample}
        />
      </div>

      {outputUrl && (
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Upscaled Result</h2>
          <div className="mb-4">
            <img
              src={outputUrl}
              alt="Upscaled output"
              className="w-full rounded-lg border border-gray-200 shadow-sm"
            />
          </div>
          <a
            href={outputUrl}
            download="upscaled.png"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Upscaled Image
          </a>
        </div>
      )}
    </div>
  );
}
