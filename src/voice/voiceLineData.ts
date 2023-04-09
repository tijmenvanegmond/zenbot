import adviceList from './zenVoiceLines.json'

export interface VoiceLineData  {
    text: string;
    voiceUri: string;
    length: number;
}

export const VoiceLineDataCollection: VoiceLineData[] = adviceList.data; 
