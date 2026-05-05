import { supabase, extractVideoThumbnail, createImageThumbnail, downloadAndUploadMedia } from './supabase';
import { Prediction, Model } from '../types/replicate';

export async function saveGeneration(
  prediction: Prediction,
  studentName: string,
  model: Model,
  inputs: Record<string, unknown>
): Promise<void> {
  if (!studentName.trim()) {
    console.warn('Student name is required to save generation');
    return;
  }

  try {
    const output = prediction.output;
    let contentUrl = '';
    let generationType: 'image' | 'video' | 'audio' | 'text' | '3d' = 'text';
    let thumbnailUrl: string | null = null;

    if (Array.isArray(output) && output.length > 0) {
      contentUrl = output[0];
      generationType = detectMediaType(contentUrl);
    } else if (typeof output === 'string') {
      contentUrl = output;
      generationType = detectMediaType(contentUrl);
    } else if (output && typeof output === 'object') {
      if ('url' in output) {
        contentUrl = (output as { url: string }).url;
        generationType = detectMediaType(contentUrl);
      } else {
        contentUrl = JSON.stringify(output);
        generationType = 'text';
      }
    }

    if (!contentUrl) {
      console.warn('No content URL found in prediction output');
      return;
    }

    let permanentContentUrl = contentUrl;

    if (generationType === 'image') {
      try {
        console.log('Downloading and storing image permanently:', contentUrl);
        permanentContentUrl = await downloadAndUploadMedia(contentUrl, 'image');
        console.log('Image stored permanently:', permanentContentUrl);

        console.log('Creating image thumbnail');
        try {
          thumbnailUrl = await createImageThumbnail(permanentContentUrl);
          console.log('Image thumbnail created:', thumbnailUrl);
        } catch (thumbError) {
          console.warn('Failed to create thumbnail, using content URL as fallback:', thumbError);
          thumbnailUrl = permanentContentUrl;
        }
      } catch (error) {
        console.error('Failed to process image:', error);
        permanentContentUrl = contentUrl;
        thumbnailUrl = contentUrl;
      }
    } else if (generationType === 'video') {
      try {
        console.log('Downloading and storing video permanently:', contentUrl);
        permanentContentUrl = await downloadAndUploadMedia(contentUrl, 'video');
        console.log('Video stored permanently:', permanentContentUrl);

        console.log('Extracting video thumbnail from:', permanentContentUrl);
        try {
          thumbnailUrl = await extractVideoThumbnail(permanentContentUrl);
          console.log('Video thumbnail extracted and uploaded:', thumbnailUrl);
        } catch (thumbError) {
          console.warn('Failed to extract video thumbnail:', thumbError);
          thumbnailUrl = permanentContentUrl;
        }
      } catch (error) {
        console.error('Failed to process video:', error);
        permanentContentUrl = contentUrl;
        thumbnailUrl = contentUrl;
      }
    } else if (generationType === 'audio') {
      try {
        console.log('Downloading and storing audio permanently:', contentUrl);
        permanentContentUrl = await downloadAndUploadMedia(contentUrl, 'audio');
        console.log('Audio stored permanently:', permanentContentUrl);
      } catch (error) {
        console.error('Failed to process audio:', error);
        permanentContentUrl = contentUrl;
      }
    }

    const { error } = await supabase.from('student_generations').insert({
      student_name: studentName.trim(),
      model_name: model.name || model.owner + '/' + model.name,
      model_version: model.latest_version.id,
      generation_type: generationType,
      content_url: permanentContentUrl,
      thumbnail_url: thumbnailUrl,
      input_data: inputs,
      prediction_id: prediction.id,
      output_data: output,
    });

    if (error) {
      console.error('Error saving generation to database:', error);
    } else {
      // Dispatch custom event to notify components that a new generation was saved
      window.dispatchEvent(new CustomEvent('generation-saved'));
    }
  } catch (error) {
    console.error('Error saving generation:', error);
  }
}

function detectMediaType(url: string): 'image' | 'video' | 'audio' | 'text' | '3d' {
  const urlLower = url.toLowerCase();

  if (urlLower.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/)) {
    return 'image';
  }

  if (urlLower.match(/\.(mp4|webm|mov|avi|mkv)$/)) {
    return 'video';
  }

  if (urlLower.match(/\.(mp3|wav|ogg|m4a|flac)$/)) {
    return 'audio';
  }

  if (urlLower.match(/\.(glb|gltf)$/)) {
    return '3d';
  }

  if (urlLower.includes('image') || urlLower.includes('img')) {
    return 'image';
  }

  if (urlLower.includes('video') || urlLower.includes('vid')) {
    return 'video';
  }

  if (urlLower.includes('audio') || urlLower.includes('sound')) {
    return 'audio';
  }

  return 'text';
}

async function checkFileExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.error('Error checking file:', url, error);
    return false;
  }
}

export async function cleanupBrokenGenerations(): Promise<number> {
  try {
    console.log('Starting cleanup of broken generation records...');

    const { data: generations, error: fetchError } = await supabase
      .from('student_generations')
      .select('id, content_url, thumbnail_url');

    if (fetchError) {
      console.error('Error fetching generations for cleanup:', fetchError);
      return 0;
    }

    if (!generations || generations.length === 0) {
      console.log('No generations to check');
      return 0;
    }

    const brokenIds: string[] = [];

    for (const gen of generations) {
      const contentExists = await checkFileExists(gen.content_url);

      if (!contentExists) {
        console.log(`Found broken record: ${gen.id} - ${gen.content_url}`);
        brokenIds.push(gen.id);
      }
    }

    if (brokenIds.length === 0) {
      console.log('No broken records found');
      return 0;
    }

    console.log(`Deleting ${brokenIds.length} broken records...`);

    const { error: deleteError } = await supabase
      .from('student_generations')
      .delete()
      .in('id', brokenIds);

    if (deleteError) {
      console.error('Error deleting broken records:', deleteError);
      return 0;
    }

    console.log(`Successfully deleted ${brokenIds.length} broken records`);
    return brokenIds.length;
  } catch (error) {
    console.error('Error during cleanup:', error);
    return 0;
  }
}

export async function saveMeshyGeneration(data: {
  studentName: string;
  modelOwner: string;
  modelName: string;
  modelId?: string;
  inputs: Record<string, unknown>;
  outputs: string[];
  thumbnailUrl?: string | null;
  taskResult?: unknown;
  processingTime: number;
  estimatedCost: number;
  timestamp: string;
}): Promise<void> {
  if (!data.studentName?.trim()) {
    console.warn('Student name is required to save generation');
    return;
  }

  try {
    const contentUrl = data.outputs[0] || '';
    const generationType = detectMediaType(contentUrl);

    const { error } = await supabase.from('student_generations').insert({
      student_name: data.studentName.trim(),
      model_name: `${data.modelOwner}/${data.modelName}`,
      model_version: data.modelId || 'meshy-v1',
      generation_type: generationType,
      content_url: contentUrl,
      thumbnail_url: data.thumbnailUrl ?? null,
      input_data: data.inputs,
      prediction_id: `meshy-${Date.now()}`,
      output_data: data.taskResult ?? data.outputs,
    });

    if (error) {
      console.error('Error saving Meshy generation to database:', error);
    } else {
      // Dispatch custom event to notify components that a new generation was saved
      window.dispatchEvent(new CustomEvent('generation-saved'));
    }
  } catch (error) {
    console.error('Error saving Meshy generation:', error);
  }
}

export async function getStoredGenerations() {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const { data, error } = await supabase
      .from('student_generations')
      .select('*')
      .gte('created_at', oneWeekAgo.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching generations:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching generations:', error);
    return [];
  }
}

export async function deleteGeneration(generationId: string): Promise<void> {
  const { data: gen, error: fetchError } = await supabase
    .from('student_generations')
    .select('id, content_url, thumbnail_url')
    .eq('id', generationId)
    .maybeSingle();

  if (fetchError) throw new Error('Failed to find generation');
  if (!gen) throw new Error('Generation not found');

  const filesToDelete: string[] = [];

  if (gen.content_url && gen.content_url.includes('replicate-images/')) {
    const path = gen.content_url.split('replicate-images/').pop();
    if (path) filesToDelete.push(path);
  }

  if (gen.thumbnail_url && gen.thumbnail_url.includes('replicate-images/')) {
    const path = gen.thumbnail_url.split('replicate-images/').pop();
    if (path && !filesToDelete.includes(path)) filesToDelete.push(path);
  }

  if (filesToDelete.length > 0) {
    await supabase.storage.from('replicate-images').remove(filesToDelete);
  }

  const { error: deleteError } = await supabase
    .from('student_generations')
    .delete()
    .eq('id', generationId);

  if (deleteError) throw new Error('Failed to delete generation record');
}

export async function cleanupOldStorageFiles() {
  try {
    const eightDaysAgo = new Date();
    eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

    const { data: oldGenerations, error: fetchError } = await supabase
      .from('student_generations')
      .select('id, content_url, thumbnail_url')
      .lt('created_at', eightDaysAgo.toISOString());

    if (fetchError) {
      console.error('Error fetching old generations for cleanup:', fetchError);
      return;
    }

    if (!oldGenerations || oldGenerations.length === 0) {
      return;
    }

    const filesToDelete: string[] = [];

    for (const gen of oldGenerations) {
      if (gen.content_url && gen.content_url.includes('replicate-images/')) {
        const path = gen.content_url.split('replicate-images/').pop();
        if (path) {
          filesToDelete.push(path);
        }
      }

      if (gen.thumbnail_url && gen.thumbnail_url.includes('replicate-images/')) {
        const path = gen.thumbnail_url.split('replicate-images/').pop();
        if (path && !filesToDelete.includes(path)) {
          filesToDelete.push(path);
        }
      }
    }

    if (filesToDelete.length > 0) {
      console.log(`Cleaning up ${filesToDelete.length} old storage files...`);

      const { error: deleteError } = await supabase.storage
        .from('replicate-images')
        .remove(filesToDelete);

      if (deleteError) {
        console.error('Error deleting old storage files:', deleteError);
      } else {
        console.log(`Successfully deleted ${filesToDelete.length} old storage files`);
      }
    }

    const generationIds = oldGenerations.map(gen => gen.id);
    if (generationIds.length > 0) {
      const { error: deleteRecordsError } = await supabase
        .from('student_generations')
        .delete()
        .in('id', generationIds);

      if (deleteRecordsError) {
        console.error('Error deleting old generation records:', deleteRecordsError);
      } else {
        console.log(`Successfully deleted ${generationIds.length} old generation records`);
      }
    }
  } catch (error) {
    console.error('Error during storage cleanup:', error);
  }
}
