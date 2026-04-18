// AudioWorkletProcessor for mic capture.
//
// Runs on the audio thread: the browser calls `process()` every 128 input
// frames (fixed by the spec). We buffer 20 ms windows (320 samples at
// 16 kHz — we only start the host AudioContext at 16 kHz, so input
// arrives pre-resampled) and post each window + its RMS back to the main
// thread for VAD and WebSocket forwarding.
//
// RMS is scaled by 32768 so values match the Int16 amplitude units used
// by the Android native recorder — that lets us reuse the same threshold
// constants without unit conversion.

class VadProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(320);
    this._bufferIdx = 0;
  }

  process(inputs, outputs) {
    const output = outputs[0] && outputs[0][0];
    // Silent output keeps the node scheduled in the pull-based audio graph
    // when we connect it to the destination. Without this, some browsers
    // may prune the chain and stop calling process().
    if (output) output.fill(0);

    const input = inputs[0] && inputs[0][0];
    if (!input || input.length === 0) return true;

    for (let i = 0; i < input.length; i++) {
      this._buffer[this._bufferIdx++] = input[i];
      if (this._bufferIdx === 320) {
        let sumSq = 0;
        for (let j = 0; j < 320; j++) {
          sumSq += this._buffer[j] * this._buffer[j];
        }
        const rms = Math.sqrt(sumSq / 320) * 32768;

        // `.slice()` makes a copy; structured-clone ships it to main.
        // Transferables would save one copy but force a per-frame buffer
        // allocation, so the perf delta is a wash at 50 frames/sec.
        this.port.postMessage({
          type: 'frame',
          pcm: this._buffer.slice(),
          rms,
        });
        this._bufferIdx = 0;
      }
    }
    return true;
  }
}

registerProcessor('vad-processor', VadProcessor);
