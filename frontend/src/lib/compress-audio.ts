/**
 * Client-side audio compression for Lectly.
 *
 * Compresses audio files in the browser BEFORE uploading to drastically
 * reduce upload time on slow mobile connections.
 *
 * A 38MB lecture recording at 128kbps stereo → ~6MB at 64kbps mono.
 * For speech/lectures, 64kbps mono produces identical transcription quality.
 *
 * Uses Web Audio API for decoding + lamejs for MP3 encoding.
 * Works in all modern browsers including mobile Chrome/Safari.
 */

// @ts-expect-error lamejs has no type definitions
import lamejs from "lamejs";

/** Threshold: only compress files larger than 8MB */
const COMPRESS_THRESHOLD = 8 * 1024 * 1024;

/** Target bitrate for compressed audio (kbps). 64 is plenty for speech. */
const TARGET_BITRATE = 64;

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  wasCompressed: boolean;
}

/**
 * Compress an audio file to a smaller MP3 if it exceeds the size threshold.
 *
 * @param file - Original audio file from file picker
 * @param onProgress - Callback with compression progress (0-100)
 * @returns CompressionResult with the (possibly compressed) file
 */
export async function compressAudio(
  file: File,
  onProgress?: (pct: number) => void
): Promise<CompressionResult> {
  // Skip compression for small files — not worth the processing time
  if (file.size <= COMPRESS_THRESHOLD) {
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      wasCompressed: false,
    };
  }

  // Skip if already a small MP3 (likely already compressed)
  if (file.type === "audio/mpeg" && file.size <= COMPRESS_THRESHOLD * 1.5) {
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      wasCompressed: false,
    };
  }

  try {
    console.log(`[Lectly] Compressing ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)...`);
    onProgress?.(5);

    // Step 1: Decode audio file to raw PCM using Web Audio API
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const arrayBuffer = await file.arrayBuffer();
    onProgress?.(15);

    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    onProgress?.(30);

    // Step 2: Get raw samples (convert to mono if stereo)
    const sampleRate = audioBuffer.sampleRate;
    const numChannels = audioBuffer.numberOfChannels;
    let samples: Float32Array;

    if (numChannels === 1) {
      samples = audioBuffer.getChannelData(0);
    } else {
      // Mix down to mono — average all channels
      const left = audioBuffer.getChannelData(0);
      const right = audioBuffer.getChannelData(1);
      samples = new Float32Array(left.length);
      for (let i = 0; i < left.length; i++) {
        samples[i] = (left[i] + right[i]) / 2;
      }
    }

    onProgress?.(40);

    // Step 3: Encode to MP3 using lamejs
    // Downsample to 22050Hz for speech (saves ~50% more space, speech doesn't need >16kHz)
    const targetSampleRate = sampleRate > 32000 ? 22050 : sampleRate;
    const mp3encoder = new lamejs.Mp3Encoder(1, targetSampleRate, TARGET_BITRATE);

    // Resample if needed
    let processedSamples: Int16Array;
    if (targetSampleRate !== sampleRate) {
      const ratio = targetSampleRate / sampleRate;
      const newLength = Math.round(samples.length * ratio);
      const resampled = new Float32Array(newLength);
      for (let i = 0; i < newLength; i++) {
        const srcIdx = i / ratio;
        const srcIdxFloor = Math.floor(srcIdx);
        const srcIdxCeil = Math.min(srcIdxFloor + 1, samples.length - 1);
        const frac = srcIdx - srcIdxFloor;
        resampled[i] = samples[srcIdxFloor] * (1 - frac) + samples[srcIdxCeil] * frac;
      }
      // Convert Float32 to Int16
      processedSamples = new Int16Array(resampled.length);
      for (let i = 0; i < resampled.length; i++) {
        const s = Math.max(-1, Math.min(1, resampled[i]));
        processedSamples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
    } else {
      // Convert Float32 to Int16 without resampling
      processedSamples = new Int16Array(samples.length);
      for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        processedSamples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
    }

    onProgress?.(50);

    // Encode in chunks to avoid blocking the UI
    const CHUNK_SIZE = 1152; // lamejs processes in frames of 1152 samples
    const mp3Chunks: Int8Array[] = [];
    const totalChunks = Math.ceil(processedSamples.length / CHUNK_SIZE);

    for (let i = 0; i < processedSamples.length; i += CHUNK_SIZE) {
      const chunk = processedSamples.subarray(i, i + CHUNK_SIZE);
      const mp3buf = mp3encoder.encodeBuffer(chunk);
      if (mp3buf.length > 0) {
        mp3Chunks.push(new Int8Array(mp3buf));
      }

      // Report progress (50% to 95% range during encoding)
      if (i % (CHUNK_SIZE * 100) === 0) {
        const chunkProgress = Math.round((i / CHUNK_SIZE / totalChunks) * 45) + 50;
        onProgress?.(chunkProgress);
        // Yield to UI thread periodically
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    // Flush remaining
    const mp3end = mp3encoder.flush();
    if (mp3end.length > 0) {
      mp3Chunks.push(new Int8Array(mp3end));
    }

    onProgress?.(98);

    // Combine chunks into a single Blob
    const mp3Blob = new Blob(mp3Chunks as unknown as BlobPart[], { type: "audio/mpeg" });
    const compressedName = file.name.replace(/\.[^.]+$/, "") + "_compressed.mp3";
    const compressedFile = new File([mp3Blob], compressedName, { type: "audio/mpeg" });

    // Close audio context
    await audioContext.close();

    const ratio = ((1 - compressedFile.size / file.size) * 100).toFixed(0);
    console.log(
      `[Lectly] Compression complete: ${(file.size / 1024 / 1024).toFixed(1)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(1)}MB (${ratio}% smaller)`
    );

    onProgress?.(100);

    return {
      file: compressedFile,
      originalSize: file.size,
      compressedSize: compressedFile.size,
      wasCompressed: true,
    };
  } catch (err) {
    // If compression fails for any reason, just upload the original file
    console.warn("[Lectly] Audio compression failed, uploading original:", err);
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      wasCompressed: false,
    };
  }
}
