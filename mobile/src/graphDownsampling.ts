import type { SessionGraphPoint } from "./validation";

type SeriesDefinition = {
  value: (point: SessionGraphPoint) => number;
  priority: number;
};

const preservedSeries: SeriesDefinition[] = [
  { value: (point) => point.flowHpa, priority: 940 },
  { value: (point) => point.pressureCm, priority: 930 },
  { value: (point) => point.setpointCm, priority: 900 },
  { value: (point) => point.motorFgHz, priority: 890 },
  { value: (point) => point.spo2Percent ?? Number.NaN, priority: 920 },
  { value: (point) => point.pulseBpm ?? Number.NaN, priority: 910 },
  { value: (point) => point.humidifierTempC ?? Number.NaN, priority: 920 },
  { value: (point) => point.humidifierRhPercent ?? Number.NaN, priority: 920 },
  { value: (point) => point.hoseTempC ?? Number.NaN, priority: 920 },
];

const bucketEnvelopeSeries: SeriesDefinition[] = [
  { value: (point) => point.flowHpa, priority: 700 },
  { value: (point) => point.pressureCm, priority: 690 },
];

export function downsampleSessionGraphPoints(
  points: SessionGraphPoint[],
  maxPoints: number,
): SessionGraphPoint[] {
  const pointLimit = Number.isFinite(maxPoints)
    ? Math.max(0, Math.floor(maxPoints))
    : 120;
  if (pointLimit === 0 || points.length === 0) return [];
  if (pointLimit === 1) return [points[points.length - 1]];
  if (points.length <= pointLimit) return points;
  if (pointLimit === 2) return [points[0], points[points.length - 1]];

  const priorities = new Map<number, number>();
  const preserve = (index: number, priority: number) => {
    if (!Number.isSafeInteger(index) || index < 0 || index >= points.length) return;
    priorities.set(index, Math.max(priority, priorities.get(index) ?? -Infinity));
  };

  preserve(0, 1_000);
  preserve(points.length - 1, 1_000);

  for (const series of preservedSeries) {
    const finite = finiteSeriesExtrema(points, series.value);
    if (!finite) continue;
    preserve(finite.firstIndex, series.priority);
    preserve(finite.lastIndex, series.priority);
    preserve(finite.minimumIndex, series.priority + 2);
    preserve(finite.maximumIndex, series.priority + 1);
  }

  const mandatoryCount = Math.min(pointLimit, priorities.size);
  const remainingForEnvelopes = Math.max(0, pointLimit - mandatoryCount);
  const bucketCount = Math.floor(remainingForEnvelopes / (bucketEnvelopeSeries.length * 2));
  for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex += 1) {
    const start = Math.floor((bucketIndex * points.length) / bucketCount);
    const end = Math.max(start + 1, Math.floor(((bucketIndex + 1) * points.length) / bucketCount));
    for (const series of bucketEnvelopeSeries) {
      const extrema = finiteSeriesExtrema(points, series.value, start, end);
      if (!extrema) continue;
      preserve(extrema.minimumIndex, series.priority);
      preserve(extrema.maximumIndex, series.priority - 1);
    }
  }

  if (priorities.size < pointLimit) {
    for (let slot = 0; slot < pointLimit && priorities.size < pointLimit; slot += 1) {
      preserve(Math.round((slot * (points.length - 1)) / (pointLimit - 1)), 100);
    }
  }
  if (priorities.size < pointLimit) {
    for (let index = 0; index < points.length && priorities.size < pointLimit; index += 1) {
      preserve(index, 10);
    }
  }

  const selectedIndexes = [...priorities.entries()]
    .sort((left, right) => right[1] - left[1] || left[0] - right[0])
    .slice(0, pointLimit)
    .map(([index]) => index)
    .sort((left, right) => left - right);
  return selectedIndexes.map((index) => points[index]);
}

function finiteSeriesExtrema(
  points: SessionGraphPoint[],
  valueAt: (point: SessionGraphPoint) => number,
  start = 0,
  end = points.length,
): {
  firstIndex: number;
  lastIndex: number;
  minimumIndex: number;
  maximumIndex: number;
} | null {
  let firstIndex = -1;
  let lastIndex = -1;
  let minimumIndex = -1;
  let maximumIndex = -1;
  let minimumValue = Infinity;
  let maximumValue = -Infinity;
  const boundedStart = Math.max(0, Math.min(points.length, Math.floor(start)));
  const boundedEnd = Math.max(boundedStart, Math.min(points.length, Math.ceil(end)));
  for (let index = boundedStart; index < boundedEnd; index += 1) {
    const value = valueAt(points[index]);
    if (!Number.isFinite(value)) continue;
    if (firstIndex < 0) firstIndex = index;
    lastIndex = index;
    if (value < minimumValue) {
      minimumValue = value;
      minimumIndex = index;
    }
    if (value > maximumValue) {
      maximumValue = value;
      maximumIndex = index;
    }
  }
  return firstIndex < 0
    ? null
    : {
        firstIndex,
        lastIndex,
        minimumIndex,
        maximumIndex,
      };
}
