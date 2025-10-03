#!/usr/bin/env python3
"""
Custom Piper TTS HTTP Server
Provides simple HTTP API for text-to-speech with multiple voice support
"""

from flask import Flask, request, Response, jsonify
import subprocess
import os
import sys

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

@app.route('/api/tts', methods=['GET'])
def synthesize():
    """
    Generate TTS audio from text
    Query parameters:
      - text: Text to synthesize (required)
      - voice: Voice to use (optional, default: danny)
      - speed: Speed multiplier (optional, default: 1.0)
    """
    text = request.args.get('text', '')
    voice_name = request.args.get('voice', DEFAULT_VOICE)
    speed = float(request.args.get('speed', 1.0))

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
        # Run piper TTS
        # Output raw PCM audio which we'll convert to WAV
        cmd = [
            "piper",
            "--model", voice_path,
            "--output-raw",
            "--length_scale", str(1.0 / speed),  # Inverse for piper
        ]

        result = subprocess.run(
            cmd,
            input=text.encode('utf-8'),
            capture_output=True,
            check=True,
            timeout=30
        )

        # Return raw audio as WAV
        # Piper outputs 22050Hz 16-bit mono PCM by default
        wav_data = create_wav_header(len(result.stdout)) + result.stdout

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