import sys
import torch
from TTS.api import TTS

# Get device
device = "cuda" if torch.cuda.is_available() else "cpu"

print(TTS().list_models())


text= ""

args = len(sys.argv)
for i in range(1, args):
    text = text + sys.argv[i] + "\n"


# Init TTS
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)

tts.tts_to_file(text=text, speaker_wav="zen-training.wav", language="en", file_path="output.wav")