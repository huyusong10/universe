// Optional GPU evidence. Never block the render loop or treat RAF as presentation.
export function createFrameProfiler(device, enabled, timestamps) {
  let frame = 0, completed = 0, pending = false, generation = 0, destroyed = false;
  let gpuLatest = null, latencyLatest = null, queryFailed = false;
  const gpu = [], latency = [], cpu = [];
  const query = enabled && timestamps ? device.createQuerySet({ type: 'timestamp', count: 2 }) : null;
  const resolve = query ? device.createBuffer({ size: 256, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC }) : null;
  const readback = query ? device.createBuffer({ size: 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }) : null;
  const add = (values, value) => { if (Number.isFinite(value) && value >= 0) { values.push(value); if (values.length > 120) values.shift(); } };
  const p95 = values => values.length ? [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * .95))] : null;
  function sample() {
    frame++;
    if (!query || queryFailed || pending || frame % 12) return null;
    pending = true;
    const serial = frame, epoch = generation;
    return {
      start: { querySet: query, beginningOfPassWriteIndex: 0 },
      end: { querySet: query, endOfPassWriteIndex: 1 },
      resolve(encoder) { encoder.resolveQuerySet(query, 0, 2, resolve, 0); encoder.copyBufferToBuffer(resolve, 0, readback, 0, 16); },
      submitted() {
        const started = performance.now();
        readback.mapAsync(GPUMapMode.READ).then(() => {
          const values = new BigUint64Array(readback.getMappedRange());
          const milliseconds = Number(values[1] - values[0]) / 1e6;
          readback.unmap();
          if (!destroyed && epoch === generation) {
            gpuLatest = milliseconds; latencyLatest = performance.now() - started;
            add(gpu, gpuLatest); add(latency, latencyLatest); completed = serial;
          }
        }).catch(() => { if (!destroyed) queryFailed = true; }).finally(() => { pending = false; });
      }
    };
  }
  return {
    sample,
    cpu(milliseconds) { if (enabled) add(cpu, milliseconds); },
    reset() { generation++; gpu.length = latency.length = cpu.length = 0; completed = frame; gpuLatest = latencyLatest = null; },
    metrics() { return enabled ? { timestampQuery: Boolean(query) && !queryFailed, samples: gpu.length,
      gpuMsLatest: gpuLatest, completionLatencyMsLatest: latencyLatest, gpuMsP95: p95(gpu),
      cpuMsP95: p95(cpu), completionLatencyMsP95: p95(latency), submittedFrames: frame, completedThroughFrame: completed } : null; },
    destroy() { destroyed = true; query?.destroy(); resolve?.destroy(); readback?.destroy(); }
  };
}
