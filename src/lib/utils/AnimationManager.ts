import Animation from './Animation';

export default class AnimationManager {
  public animations: Animation[] = [];

  private _lastTimestamp = Date.now();
  private _animationID: number;
  private _onAnimate: ((dts: number) => void)[] = [];
  private _paused = false;

  constructor() {
    const onAnimate = (dtS: number): void => {
      const animations = this.animations
      for (let i = 0; i < animations.length; i++) {
        // advance the animation
        const animation = animations[i]
        if (animation) {
          const finished = animation.animate(dtS)
          // if the animation is finished (returned true) remove it
          if (finished) {
            // remove the animation
            animations[i] = animations[animations.length - 1]
            animations[animations.length - 1] = animation
            animations.pop()
          }
        }
      }
    }
    this.onAnimate = onAnimate;
  }

  set paused(paused: boolean) {
    this._paused = paused;
  }

  set onAnimate(callback: ((dtS: number) => void)[] | {(dtS: number): void}) {
    if (!callback) {
      throw new Error("Invalid onRender callback")
    }
    if (Array.isArray(callback))
      this._onAnimate = callback;
    else
      this._onAnimate.push(callback);
  }

  addOnAnimate(callback: (dtS: number) => void): void {
    this._onAnimate.push(callback);
  }

  addAnimation(animation: Animation): void {
    this.animations.push(animation);
  }

  cancelAnimation(): void {
    this.animations.shift();
  }

  dispose(): void {
    window.cancelAnimationFrame(this._animationID);
  }

  // Same as set onAnimate, just function vs property
  setOnAnimateCallback(callback: ((dtS: number) => void)[] | {(dtS: number): void}): void {
    this.onAnimate = callback
  }
  
  animate(timestamp: number): void {
    if (!this._paused) {
      const dtS = (timestamp - this._lastTimestamp) / 1000.0;
      this._lastTimestamp = timestamp;
      for (const i in this._onAnimate) {
        this._onAnimate[i](dtS);
      }
    }
    this._animationID = requestAnimationFrame(this.animate.bind(this));
  }
  
  toggleAnimationLoop(): void {
    this._paused = !this._paused;
  }
}