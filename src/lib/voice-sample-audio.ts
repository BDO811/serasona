// Minimal browser audio utilities for the voice check-in recorder.
// Ported from try.amplifierhealth.com's audio-utils.ts, trimmed down: that
// site also supports FLAC/MP3 via extra encoder libraries (libflacjs,
// lamejs) for a different backend's format requirements. Amplifier's API
// accepts WAV directly (same format MyAbuela's Telnyx call recordings
// already use), so this only needs the WAV path — no extra dependencies.

/** Convert a decoded AudioBuffer to a 16-bit PCM WAV Blob. */
function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numberOfChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = numberOfChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = buffer.length * blockAlign;
  const bufferSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, text: string) {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  }

  writeString(0, "RIFF");
  view.setUint32(4, bufferSize - 8, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return arrayBuffer;
}

/** Decodes whatever MediaRecorder captured (webm/opus) and re-encodes it as
 * a WAV blob Amplifier's API can read directly. */
export async function convertRecordingToWav(recordingBlob: Blob, options?: { voiceClone?: boolean }): Promise<Blob> {
  const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioContext = new AudioContextCtor();
  try {
    const arrayBuffer = await recordingBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    let output = audioBuffer;
    if (options?.voiceClone) {
      if (audioBuffer.duration < 60 || audioBuffer.duration > 183) {
        throw new Error("Record at least 1 minute and no more than 3 minutes. Please try again.");
      }
      // Mono 24 kHz PCM keeps three minutes below the voice upload limit.
      const offline = new OfflineAudioContext(1, Math.ceil(audioBuffer.duration * 24000), 24000);
      const source = offline.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offline.destination);
      source.start();
      output = await offline.startRendering();
      const samples = output.getChannelData(0);
      let audible = 0;
      let clipped = 0;
      for (let start = 0; start < samples.length; start += 2400) {
        let energy = 0;
        const end = Math.min(start + 2400, samples.length);
        for (let i = start; i < end; i++) {
          energy += samples[i] * samples[i];
          if (Math.abs(samples[i]) >= 0.99) clipped++;
        }
        if (Math.sqrt(energy / (end - start)) > 0.003) audible += (end - start) / 24000;
      }
      if (audible < 35) throw new Error("Too little audible speech. Move closer to the microphone and read the passage again in a quiet room.");
      if (clipped / samples.length > 0.01) throw new Error("The recording is distorted. Move a little farther from the microphone and record again.");
    }
    return new Blob([audioBufferToWav(output)], { type: "audio/wav" });
  } finally {
    await audioContext.close();
  }
}

/** Base64-encodes a Blob's bytes, chunked to avoid blowing the call stack on
 * String.fromCharCode(...bigArray) for a multi-minute recording. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/** First MIME type MediaRecorder actually supports in this browser, or null
 * if none of the candidates work (recording isn't available here). */
export function pickSupportedRecordingMimeType(): string | null {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const candidate of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return null;
}
