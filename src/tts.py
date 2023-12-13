import sys
import pyttsx3

engine = pyttsx3.init()
voices = engine.getProperty('voices')
engine.setProperty('voice', voices[0].id)

rate = 180
engine.setProperty('rate', rate)     # setting up voice rate

conversation= ""

args = len(sys.argv)
for i in range(1, args):
    conversation = conversation + sys.argv[i] + "\n"

file = "output.mp3"
engine.save_to_file(conversation, file)
engine.runAndWait()
print("Output saved as: " + file)