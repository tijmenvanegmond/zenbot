"""
Audio Effects Module
Provides various audio effects for TTS output
"""

import numpy as np
from scipy import signal
from typing import Optional


class AudioEffects:
    """Audio effects processor for TTS audio"""

    def __init__(self, sample_rate: int = 22050):
        self.sample_rate = sample_rate

    def apply_reverb(self, audio: np.ndarray, room_size: float = 0.5, damping: float = 0.5, wet: float = 0.3) -> np.ndarray:
        """
        Apply reverb effect

        Args:
            audio: Input audio array
            room_size: Room size (0-1), larger = more echo
            damping: High frequency damping (0-1)
            wet: Wet/dry mix (0-1), 0 = all dry, 1 = all wet
        """
        # Simple comb filter reverb
        delay_samples = int(room_size * self.sample_rate * 0.05)  # Up to 50ms delay

        if delay_samples < 1:
            return audio

        # Create impulse response for reverb
        impulse = np.zeros(delay_samples * 4)
        impulse[0] = 1.0

        # Add delayed copies with decay
        decay = 0.5
        for i in range(1, 8):
            idx = int(delay_samples * i * (1 + np.random.random() * 0.1))
            if idx < len(impulse):
                impulse[idx] = decay ** i

        # Apply damping (low-pass filter)
        if damping > 0:
            b, a = signal.butter(2, damping * 0.5, btype='low')
            impulse = signal.filtfilt(b, a, impulse)

        # Convolve with impulse response
        reverb = signal.fftconvolve(audio, impulse, mode='same')

        # Mix wet and dry
        return audio * (1 - wet) + reverb * wet

    def apply_pitch_shift(self, audio: np.ndarray, semitones: float) -> np.ndarray:
        """
        Shift pitch by semitones

        Args:
            audio: Input audio array
            semitones: Number of semitones to shift (-12 to +12)
        """
        if semitones == 0:
            return audio

        # Calculate pitch shift ratio
        ratio = 2 ** (semitones / 12.0)

        # Resample to change pitch
        num_samples = int(len(audio) / ratio)
        indices = np.linspace(0, len(audio) - 1, num_samples)

        # Linear interpolation
        shifted = np.interp(indices, np.arange(len(audio)), audio)

        # Resample back to original length (changes speed)
        final_indices = np.linspace(0, len(shifted) - 1, len(audio))
        result = np.interp(final_indices, np.arange(len(shifted)), shifted)

        return result

    def apply_distortion(self, audio: np.ndarray, gain: float = 5.0) -> np.ndarray:
        """
        Apply distortion/overdrive effect

        Args:
            audio: Input audio array
            gain: Distortion amount (1-50)
        """
        # Soft clipping distortion
        gained = audio * gain
        distorted = np.tanh(gained)

        # Normalize
        max_val = np.max(np.abs(distorted))
        if max_val > 0:
            distorted = distorted / max_val * 0.8

        return distorted

    def apply_bitcrush(self, audio: np.ndarray, bits: int = 8) -> np.ndarray:
        """
        Apply bitcrusher effect (reduce bit depth)

        Args:
            audio: Input audio array
            bits: Target bit depth (1-16)
        """
        # Quantize to fewer bits
        levels = 2 ** bits
        quantized = np.round(audio * levels) / levels

        return quantized

    def apply_robot(self, audio: np.ndarray) -> np.ndarray:
        """
        Apply robot/vocoder effect (subtle)
        """
        # Subtle ring modulation for robot effect
        modulator_freq = 25  # Hz - lower frequency, less harsh
        t = np.arange(len(audio)) / self.sample_rate
        modulator = np.sin(2 * np.pi * modulator_freq * t)

        # Reduced modulation depth for subtlety
        robot = audio * (0.7 + 0.3 * modulator)  # Was 0.5 + 0.5, now gentler

        # No pitch shift here - profiles handle pitch
        # robot = self.apply_pitch_shift(robot, -3)

        return robot

    def apply_echo(self, audio: np.ndarray, delay_ms: float = 500, decay: float = 0.5) -> np.ndarray:
        """
        Apply echo effect

        Args:
            audio: Input audio array
            delay_ms: Delay in milliseconds
            decay: Echo decay factor (0-1)
        """
        delay_samples = int(delay_ms * self.sample_rate / 1000)

        if delay_samples < 1 or delay_samples >= len(audio):
            return audio

        result = audio.copy()

        # Add delayed copies
        for i in range(3):
            delay_pos = delay_samples * (i + 1)
            if delay_pos < len(audio):
                echo_strength = decay ** (i + 1)
                result[delay_pos:] += audio[:len(audio) - delay_pos] * echo_strength

        # Normalize
        max_val = np.max(np.abs(result))
        if max_val > 1.0:
            result = result / max_val * 0.95

        return result

    def apply_glitch(self, audio: np.ndarray) -> np.ndarray:
        """
        Apply glitch effect (random digital artifacts)
        """
        result = audio.copy()

        # Random short stutters
        num_glitches = np.random.randint(5, 15)
        for _ in range(num_glitches):
            pos = np.random.randint(0, len(audio) - 1000)
            length = np.random.randint(50, 200)

            if pos + length < len(audio):
                # Repeat a small section
                result[pos:pos+length] = audio[pos:pos+length] * 0.3

        # Add tremolo
        tremolo_freq = 10  # Hz
        t = np.arange(len(audio)) / self.sample_rate
        tremolo = 0.5 + 0.5 * np.sin(2 * np.pi * tremolo_freq * t)
        result = result * tremolo

        return result

    def apply_chorus(self, audio: np.ndarray) -> np.ndarray:
        """
        Apply chorus effect
        """
        # Multiple delayed copies with slight pitch variation
        result = audio.copy()

        delays = [10, 20, 30]  # ms
        for delay_ms in delays:
            delay_samples = int(delay_ms * self.sample_rate / 1000)
            if delay_samples < len(audio):
                delayed = np.pad(audio, (delay_samples, 0), mode='constant')[:len(audio)]
                result += delayed * 0.3

        # Normalize
        max_val = np.max(np.abs(result))
        if max_val > 0:
            result = result / max_val * 0.9

        return result

    def apply_preset(self, audio: np.ndarray, preset: str) -> np.ndarray:
        """
        Apply a preset effect combination

        Available presets:
        - omnic: Robot voice with reverb
        - cave: Deep echoing cave
        - demon: Demonic distorted voice
        - chipmunk: High pitched
        - glitch: Digital corruption
        - radio: Lo-fi radio transmission
        - ghost: Ethereal ghostly
        - telephone: Phone quality
        """
        if preset == "omnic":
            audio = self.apply_robot(audio)
            # Reverb and distortion now passed as individual parameters, not in preset

        elif preset == "cave":
            audio = self.apply_pitch_shift(audio, -2)
            audio = self.apply_reverb(audio, room_size=0.9, wet=0.6)

        elif preset == "demon":
            audio = self.apply_pitch_shift(audio, -8)
            audio = self.apply_distortion(audio, gain=15)
            audio = self.apply_reverb(audio, room_size=0.7, wet=0.4)

        elif preset == "chipmunk":
            audio = self.apply_pitch_shift(audio, 8)

        elif preset == "glitch":
            audio = self.apply_glitch(audio)
            audio = self.apply_bitcrush(audio, bits=4)

        elif preset == "radio":
            audio = self.apply_bitcrush(audio, bits=8)
            audio = self.apply_distortion(audio, gain=3)

        elif preset == "ghost":
            audio = self.apply_pitch_shift(audio, 2)
            audio = self.apply_chorus(audio)
            audio = self.apply_reverb(audio, room_size=0.8, wet=0.7)

        elif preset == "telephone":
            audio = self.apply_bitcrush(audio, bits=10)
            audio = self.apply_echo(audio, delay_ms=100, decay=0.3)

        return audio
