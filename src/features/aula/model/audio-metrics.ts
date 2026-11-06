import type { LiveAudioSample } from "./types";

export function clamp01(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function standardDeviation(values: number[], mean = average(values)) {
  if (values.length === 0) return 0;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function percentile(values: number[], ratio: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * ratio)));
  return sorted[index];
}

export function computeRms(data: Float32Array) {
  let sum = 0;
  for (const value of data) {
    sum += value * value;
  }
  return Math.sqrt(sum / data.length);
}

export function computeZeroCrossingRate(data: Float32Array) {
  let crossings = 0;
  for (let index = 1; index < data.length; index += 1) {
    if ((data[index - 1] >= 0 && data[index] < 0) || (data[index - 1] < 0 && data[index] >= 0)) {
      crossings += 1;
    }
  }
  return crossings / data.length;
}

export function estimatePitchHz(data: Float32Array, sampleRate: number) {
  const rms = computeRms(data);
  if (rms < 0.01) return undefined;

  const minHz = 80;
  const maxHz = 320;
  const minOffset = Math.floor(sampleRate / maxHz);
  const maxOffset = Math.floor(sampleRate / minHz);
  let bestOffset = -1;
  let bestCorr = 0;

  for (let offset = minOffset; offset <= maxOffset; offset += 1) {
    let corr = 0;
    for (let index = 0; index < data.length - offset; index += 1) {
      corr += data[index] * data[index + offset];
    }
    corr /= data.length - offset;
    if (corr > bestCorr) {
      bestCorr = corr;
      bestOffset = offset;
    }
  }

  if (bestOffset <= 0 || bestCorr < 0.15) return undefined;
  return sampleRate / bestOffset;
}

export function deriveSpeechMetrics(
  samples: LiveAudioSample[],
  maxRms: number,
  confidence?: number,
) {
  if (!samples.length) return {};

  const allRmsValues = samples.map((sample) => sample.rms);
  const noiseFloor = percentile(allRmsValues, 0.2);
  const activeFloor = Math.max(0.004, noiseFloor * 1.4);
  const activeSamples = samples.filter((sample) => sample.rms >= activeFloor);
  const speechSamples = activeSamples.length >= 3 ? activeSamples : samples;
  const rmsValues = speechSamples.map((sample) => sample.rms);
  const zcrValues = speechSamples.map((sample) => sample.zcr);
  const pitchValues = speechSamples
    .map((sample) => sample.pitch)
    .filter((value): value is number => typeof value === "number" && value > 0);

  const rmsMean = average(rmsValues);
  const rmsStd = standardDeviation(rmsValues, rmsMean);
  const zcrMean = average(zcrValues);
  const pitchMean = average(pitchValues);
  const pitchStd = standardDeviation(pitchValues, pitchMean);
  const rmsP90 = percentile(rmsValues, 0.9);
  const dynamicReference = Math.max(
    0.012,
    Math.min(maxRms || 0.08, Math.max(rmsP90, rmsMean * 1.25)),
  );
  const signalScore = clamp01(
    (rmsMean - noiseFloor * 0.7) / Math.max(0.008, dynamicReference - noiseFloor * 0.7),
  );
  const noiseScore = clamp01(1 - Math.max(0, zcrMean - 0.12) / 0.22);
  const stabilityScore = clamp01(1 - rmsStd / Math.max(0.01, rmsMean * 1.35));
  const speechPresenceScore = clamp01(activeSamples.length / Math.max(1, samples.length) + 0.25);
  const confidenceScore = typeof confidence === "number" ? clamp01(confidence) : 0.65;

  const clarity = clamp01(
    0.08 +
      signalScore * 0.25 +
      noiseScore * 0.24 +
      stabilityScore * 0.16 +
      confidenceScore * 0.19 +
      speechPresenceScore * 0.08,
  );
  const conviction = clamp01(
    0.07 +
      signalScore * 0.31 +
      stabilityScore * 0.23 +
      confidenceScore * 0.18 +
      noiseScore * 0.13 +
      speechPresenceScore * 0.08,
  );
  const intonation = pitchValues.length
    ? clamp01(Math.min(pitchStd / Math.max(120, pitchMean), 0.45) / 0.45)
    : undefined;
  const verbalQualityScore = average([clarity, conviction, confidenceScore, intonation ?? clarity]);

  return {
    clarity,
    intonation,
    conviction,
    verbalQuality: verbalQualityScore >= 0.55 ? ("adequada" as const) : ("revisar" as const),
  };
}
