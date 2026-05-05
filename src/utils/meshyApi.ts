const PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meshy-proxy`;

export interface MeshyTextTo3DPayload {
  mode: 'preview' | 'refine';
  prompt: string;
  art_style: 'realistic' | 'cartoon' | 'low-poly' | 'sculpture' | 'pbr';
  should_remesh?: boolean;
}

export interface MeshyImageTo3DPayload {
  image_url: string;
  enable_pbr?: boolean;
  should_remesh?: boolean;
  should_texture?: boolean;
  save_pre_remeshed_model?: boolean;
}

export interface MeshyMultiImageTo3DPayload {
  image_urls: string[];
  should_remesh?: boolean;
  should_texture?: boolean;
  save_pre_remeshed_model?: boolean;
  enable_pbr?: boolean;
}

export interface MeshyTaskResponse {
  result: string;
  task_id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED';
  model_urls?: {
    glb?: string;
    fbx?: string;
    usdz?: string;
    obj?: string;
    mtl?: string;
  };
  thumbnail_url?: string;
  video_url?: string;
  texture_urls?: Array<{
    base_color?: string;
    metallic?: string;
    normal?: string;
    roughness?: string;
  }>;
  progress?: number;
}

async function proxyFetch(path: string, options?: RequestInit): Promise<Response> {
  const url = `${PROXY_URL}?path=${encodeURIComponent(path)}`;

  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
}

export interface MeshyTaskResponseWithEndpoint extends MeshyTaskResponse {
  _endpoint?: string;
}

export async function createTextTo3DTask(
  payload: MeshyTextTo3DPayload
): Promise<MeshyTaskResponseWithEndpoint> {
  const response = await proxyFetch('/v2/text-to-3d', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to create text-to-3D task: ${response.statusText}`);
  }

  const result = await response.json();
  const taskId = result.result || result.task_id;
  return { ...result, task_id: taskId, _endpoint: '/v2/text-to-3d' };
}

export async function createImageTo3DTask(
  payload: MeshyImageTo3DPayload
): Promise<MeshyTaskResponseWithEndpoint> {
  const response = await proxyFetch('/v2/image-to-3d', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to create image-to-3D task: ${response.statusText}`);
  }

  const result = await response.json();
  const taskId = result.result || result.task_id;
  return { ...result, task_id: taskId, _endpoint: '/v2/image-to-3d' };
}

export async function createMultiImageTo3DTask(
  payload: MeshyMultiImageTo3DPayload
): Promise<MeshyTaskResponseWithEndpoint> {
  const response = await proxyFetch('/v2/image-to-3d', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to create multi-image-to-3D task: ${response.statusText}`);
  }

  const result = await response.json();
  const taskId = result.result || result.task_id;
  return { ...result, task_id: taskId, _endpoint: '/v2/image-to-3d' };
}

export async function getTaskStatus(
  taskId: string,
  endpoint: string = '/v2/text-to-3d'
): Promise<MeshyTaskResponse> {
  const response = await proxyFetch(`${endpoint}/${taskId}`);

  if (!response.ok) {
    let errorMessage = `Failed to get task status: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage += ` - ${errorData.error}`;
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export async function pollTaskUntilComplete(
  taskId: string,
  onProgress?: (progress: number) => void,
  endpoint: string = '/v2/text-to-3d'
): Promise<MeshyTaskResponse> {
  let attempts = 0;
  const maxAttempts = 300;

  while (attempts < maxAttempts) {
    try {
      const status = await getTaskStatus(taskId, endpoint);

      console.log(`[Meshy Poll] Attempt ${attempts + 1}/${maxAttempts} - Status: ${status.status}, Progress: ${status.progress}%`);

      if (onProgress && status.progress !== undefined) {
        onProgress(status.progress);
      }

      if (status.status === 'SUCCEEDED') {
        console.log('[Meshy Poll] Task completed successfully!');
        return status;
      }

      if (status.status === 'FAILED') {
        console.error('[Meshy Poll] Task failed');
        throw new Error('Task failed');
      }

      const delay = status.progress && status.progress >= 90 ? 3000 : 2000;
      await new Promise(resolve => setTimeout(resolve, delay));
      attempts++;
    } catch (error) {
      console.error(`[Meshy Poll] Error on attempt ${attempts + 1}:`, error);

      if (attempts >= maxAttempts - 1) {
        throw error;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }
  }

  console.error('[Meshy Poll] Task timeout after max attempts');
  throw new Error('Task timeout - the 3D model generation took too long. Please try again.');
}

export interface MeshyRetexturePayload {
  model_url: string;
  text_style_prompt: string;
  enable_original_uv?: boolean;
  enable_pbr?: boolean;
}

export interface MeshyRetextureResponse {
  result: string;
  task_id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED';
  model_urls?: {
    glb?: string;
    fbx?: string;
    usdz?: string;
    obj?: string;
  };
  thumbnail_url?: string;
  progress?: number;
}

export async function createRetextureTask(
  payload: MeshyRetexturePayload
): Promise<MeshyRetextureResponse> {
  const response = await proxyFetch('/v1/retexture', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Failed to create retexture task: ${err.message || response.statusText}`);
  }

  const result = await response.json();
  const taskId = result.result || result.task_id;
  return { ...result, task_id: taskId };
}

export async function pollRetextureUntilComplete(
  taskId: string,
  onProgress?: (progress: number) => void
): Promise<MeshyRetextureResponse> {
  let attempts = 0;
  const maxAttempts = 300;

  while (attempts < maxAttempts) {
    const response = await proxyFetch(`/v1/retexture/${taskId}`);

    if (!response.ok) {
      throw new Error(`Failed to get retexture status: ${response.statusText}`);
    }

    const status: MeshyRetextureResponse = await response.json();

    if (onProgress && status.progress !== undefined) {
      onProgress(status.progress);
    }

    if (status.status === 'SUCCEEDED') return status;
    if (status.status === 'FAILED') throw new Error('Retexture task failed');

    await new Promise(resolve => setTimeout(resolve, 2000));
    attempts++;
  }

  throw new Error('Retexture task timed out');
}

export function proxyMeshyAssetUrl(assetUrl: string | undefined): string {
  if (!assetUrl || !assetUrl.trim()) {
    return '';
  }

  if (!assetUrl.includes('assets.meshy.ai')) {
    return assetUrl;
  }

  return `${PROXY_URL}?path=${encodeURIComponent(assetUrl)}`;
}
