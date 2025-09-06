export interface AIService {
  processText(input: string): Promise<string>;
  setVoice(voice: string): void;
  setEmotion(emotion: string): void;
  setContext(context: any): void;
  reset(): void;
}
