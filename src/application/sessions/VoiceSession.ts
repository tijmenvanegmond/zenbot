export interface TTSRequest {
  text: string;
  channelId: string;
  priority: 'normal' | 'high';
  userId: string;
  timestamp: Date;
}

export class VoiceSession {
  private active = true;
  private ttsQueue: TTSRequest[] = [];
  private startTime = new Date();
  
  constructor(
    public readonly sessionId: string,
    public readonly channelId: string,
    public readonly userId: string,
    public readonly duration: number
  ) {}
  
  isActive(): boolean {
    return this.active && !this.isExpired();
  }
  
  isExpired(): boolean {
    return Date.now() - this.startTime.getTime() > this.duration;
  }
  
  end(): void {
    this.active = false;
    this.ttsQueue = [];
  }
  
  keepAlive(): void {
    // Session continues naturally - no action needed
    // This method exists for explicit session management if needed
  }
  
  queueTTS(request: TTSRequest): void {
    // Insert high priority requests at the front
    if (request.priority === 'high') {
      this.ttsQueue.unshift(request);
    } else {
      this.ttsQueue.push(request);
    }
  }
  
  getNextTTS(): TTSRequest | null {
    return this.ttsQueue.shift() || null;
  }
  
  hasPendingTTS(): boolean {
    return this.ttsQueue.length > 0;
  }
  
  getStatus() {
    return {
      sessionId: this.sessionId,
      channelId: this.channelId,
      userId: this.userId,
      active: this.active,
      expired: this.isExpired(),
      startTime: this.startTime,
      duration: this.duration,
      queueLength: this.ttsQueue.length,
      remainingTime: Math.max(0, this.duration - (Date.now() - this.startTime.getTime()))
    };
  }
}