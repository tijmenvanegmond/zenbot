#!/usr/bin/env python3
"""
Custom Piper TTS HTTP Server with Audio Effects
Provides simple HTTP API for text-to-speech with multiple voice support and audio effects
"""

from flask import Flask, request, Response, jsonify
import subprocess
import os
import re
import sys
import numpy as np
import struct
from typing import Optional
from piper import PiperVoice, SynthesisConfig
from effects import AudioEffects

app = Flask(__name__)

# Available voice models
VOICES = {
    "lessac": "/app/voices/en_US-lessac-medium.onnx",      # Clear female
    "ryan": "/app/voices/en_US-ryan-medium.onnx",          # Clear male
    "danny": "/app/voices/en_US-danny-low.onnx",           # Robotic male
    "amy": "/app/voices/en_US-amy-medium.onnx",            # Soft female
    "joe": "/app/voices/en_US-joe-medium.onnx",            # Deep male
    "john": "/app/voices/en_US-john-medium.onnx",          # Male voice (new default)
}

DEFAULT_VOICE = "john"  # Male voice as default

# Initialize audio effects processor
audio_effects = AudioEffects(sample_rate=22050)

@app.route('/api/tts', methods=['GET'])
def synthesize():
    """
    Generate TTS audio from text
    Query parameters:
      - text: Text to synthesize (required)
      - voice: Voice to use (optional, default: john)
      - speed: Speed multiplier (optional, default: 1.0)
      - effect: Effect preset (optional): zen, omnic, cave, demon, chipmunk, glitch, radio, ghost, telephone
      - reverb: Reverb amount 0-1 (optional)
      - pitch: Pitch shift in semitones -12 to +12 (optional)
      - distortion: Distortion gain 1-50 (optional)
      - echo: Echo delay in ms (optional)
      - bitcrush: Bit depth 1-16 (optional)
    """
    text = request.args.get('text', '')
    voice_name = request.args.get('voice', DEFAULT_VOICE)
    speed = float(request.args.get('speed', 1.0))

    # Effect parameters
    effect_preset = request.args.get('effect', None)
    reverb = request.args.get('reverb', None)
    pitch = request.args.get('pitch', None)
    distortion = request.args.get('distortion', None)
    echo = request.args.get('echo', None)
    bitcrush = request.args.get('bitcrush', None)

    if not text:
        return jsonify({"error": "Missing 'text' parameter"}), 400

    # Get voice model path
    voice_path = VOICES.get(voice_name)
    if not voice_path:
        return jsonify({
            "error": f"Unknown voice: {voice_name}",
            "available_voices": list(VOICES.keys())
        }), 400

    if not os.path.exists(voice_path):
        return jsonify({"error": f"Voice model not found: {voice_path}"}), 500

    try:
        # Run piper TTS per chunk; [pause] / [pause:0.8] markers become silence
        noise = request.args.get('noise', None, type=float)
        noise_w = request.args.get('noise_w', None, type=float)
        audio = synthesize_with_pauses(text, voice_path, speed, noise, noise_w)

        # Apply effect preset if specified
        if effect_preset:
            audio = audio_effects.apply_preset(audio, effect_preset)

        # Apply individual effects if specified
        if reverb is not None:
            reverb_amount = float(reverb)
            audio = audio_effects.apply_reverb(audio, room_size=0.5, wet=reverb_amount)

        if pitch is not None:
            semitones = float(pitch)
            audio = audio_effects.apply_pitch_shift(audio, semitones)

        if distortion is not None:
            gain = float(distortion)
            audio = audio_effects.apply_distortion(audio, gain)

        if echo is not None:
            delay_ms = float(echo)
            audio = audio_effects.apply_echo(audio, delay_ms)

        if bitcrush is not None:
            bits = int(bitcrush)
            audio = audio_effects.apply_bitcrush(audio, bits)

        # Convert back to PCM
        audio = np.clip(audio, -1.0, 1.0)
        pcm_processed = (audio * 32767).astype(np.int16).tobytes()

        # Create WAV with processed audio
        wav_data = create_wav_header(len(pcm_processed)) + pcm_processed

        return Response(
            wav_data,
            mimetype='audio/wav',
            headers={
                'Content-Disposition': 'inline; filename="speech.wav"'
            }
        )

    except subprocess.TimeoutExpired:
        return jsonify({"error": "TTS generation timed out"}), 504
    except subprocess.CalledProcessError as e:
        error_msg = e.stderr.decode('utf-8') if e.stderr else str(e)
        return jsonify({"error": f"Piper TTS failed: {error_msg}"}), 500
    except Exception as e:
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

@app.route('/api/voices', methods=['GET'])
def list_voices():
    """List available voices"""
    voice_info = {}
    for name, path in VOICES.items():
        exists = os.path.exists(path)
        voice_info[name] = {
            "path": path,
            "available": exists
        }

    return jsonify({
        "voices": voice_info,
        "default": DEFAULT_VOICE
    })

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "service": "piper-tts"})

SAMPLE_RATE = 22050
PAUSE_MARKER = re.compile(r"\[pause(?::(\d+(?:\.\d+)?))?\]", re.IGNORECASE)
DEFAULT_PAUSE_SECONDS = 0.5
MAX_PAUSE_SECONDS = 3.0


# Voices stay loaded in memory: loading takes ~0.8s, synthesis ~0.1s
_voice_cache = {}


def get_voice(voice_path: str) -> PiperVoice:
    if voice_path not in _voice_cache:
        _voice_cache[voice_path] = PiperVoice.load(voice_path)
    return _voice_cache[voice_path]


def run_piper(text: str, voice_path: str, speed: float,
              noise: Optional[float] = None, noise_w: Optional[float] = None) -> np.ndarray:
    """
    Synthesize text, returning float32 audio.
    noise   - expressiveness/variation in tone (piper default 0.667; lower = calmer)
    noise_w - variation in phoneme timing (piper default 0.8; lower = more even cadence)
    """
    config = SynthesisConfig(
        length_scale=1.0 / speed,  # Inverse for piper
        noise_scale=noise,
        noise_w_scale=noise_w,
    )
    arrays = [chunk.audio_float_array for chunk in get_voice(voice_path).synthesize(text, config)]
    if not arrays:
        return np.zeros(0, dtype=np.float32)
    return np.concatenate(arrays).astype(np.float32)


def synthesize_with_pauses(text: str, voice_path: str, speed: float,
                           noise: Optional[float] = None,
                           noise_w: Optional[float] = None) -> np.ndarray:
    """
    Split text on [pause] / [pause:SECONDS] markers, synthesize each chunk and
    join them with exact silence. Text without markers is a single piper run.
    """
    parts = PAUSE_MARKER.split(text)
    # re.split with one group gives: [text, seconds, text, seconds, ..., text]
    chunks = parts[0::2]
    pauses = parts[1::2]

    segments = []
    for i, chunk in enumerate(chunks):
        if chunk.strip():
            segments.append(run_piper(chunk.strip(), voice_path, speed, noise, noise_w))
        if i < len(pauses):
            seconds = float(pauses[i]) if pauses[i] else DEFAULT_PAUSE_SECONDS
            seconds = min(max(seconds, 0.0), MAX_PAUSE_SECONDS)
            segments.append(np.zeros(int(SAMPLE_RATE * seconds), dtype=np.float32))

    if not segments:
        return np.zeros(0, dtype=np.float32)
    return np.concatenate(segments)


def create_wav_header(data_size: int, sample_rate: int = 22050, bits_per_sample: int = 16, channels: int = 1) -> bytes:
    """Create WAV file header for PCM audio data"""
    byte_rate = sample_rate * channels * bits_per_sample // 8
    block_align = channels * bits_per_sample // 8

    header = bytearray()

    # RIFF header
    header.extend(b'RIFF')
    header.extend((data_size + 36).to_bytes(4, 'little'))  # File size - 8
    header.extend(b'WAVE')

    # fmt chunk
    header.extend(b'fmt ')
    header.extend((16).to_bytes(4, 'little'))  # fmt chunk size
    header.extend((1).to_bytes(2, 'little'))   # Audio format (1 = PCM)
    header.extend(channels.to_bytes(2, 'little'))
    header.extend(sample_rate.to_bytes(4, 'little'))
    header.extend(byte_rate.to_bytes(4, 'little'))
    header.extend(block_align.to_bytes(2, 'little'))
    header.extend(bits_per_sample.to_bytes(2, 'little'))

    # data chunk
    header.extend(b'data')
    header.extend(data_size.to_bytes(4, 'little'))

    return bytes(header)

if __name__ == '__main__':
    print("🎙️ Piper TTS HTTP Server")
    print(f"Available voices: {', '.join(VOICES.keys())}")
    print(f"Default voice: {DEFAULT_VOICE}")
    print("Listening on http://0.0.0.0:8080")
    print()

    # Verify voice models exist
    missing = [name for name, path in VOICES.items() if not os.path.exists(path)]
    if missing:
        print(f"⚠️  Warning: Missing voice models: {', '.join(missing)}")

    app.run(host='0.0.0.0', port=8080, debug=False)