export class TimeOrchestrator {
  constructor(options = {}) {
    this.fps = options.fps || 60;
    this.frameStep = parseFloat((1000 / this.fps).toFixed(2));
    this.accumulatedTime = 0;
  }

  nextFrameTick() {
    this.accumulatedTime += this.frameStep;
    return parseFloat(this.accumulatedTime.toFixed(2));
  }

  reset() {
    this.accumulatedTime = 0;
  }

  getFrameNumber() {
    // Calculate frame number based on accumulated time and frame duration
    // Using Math.round to handle potential floating point inaccuracies
    return Math.round(this.accumulatedTime / this.frameStep);
  }
}
