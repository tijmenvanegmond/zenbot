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

    # ----- Phase vocoder (pitch shift without changing duration) -----

    _N_FFT = 1024
    _HOP = 256

    def _stft(self, x: np.ndarray) -> np.ndarray:
        n_fft, hop = self._N_FFT, self._HOP
        win = np.hanning(n_fft)
        x = np.pad(x, (n_fft // 2, n_fft // 2))
        frames = 1 + (len(x) - n_fft) // hop
        return np.stack(
            [np.fft.rfft(win * x[i * hop: i * hop + n_fft]) for i in range(frames)],
            axis=1,
        )

    def _istft(self, spec: np.ndarray, length: int) -> np.ndarray:
        n_fft, hop = self._N_FFT, self._HOP
        win = np.hanning(n_fft)
        frames = spec.shape[1]
        out = np.zeros(n_fft + hop * (frames - 1))
        norm = np.zeros_like(out)
        for i in range(frames):
            out[i * hop: i * hop + n_fft] += win * np.fft.irfft(spec[:, i], n_fft)
            norm[i * hop: i * hop + n_fft] += win ** 2
        out = (out / np.maximum(norm, 1e-8))[n_fft // 2:]
        return np.pad(out, (0, max(0, length - len(out))))[:length]

    def time_stretch(self, audio: np.ndarray, rate: float) -> np.ndarray:
        """Change duration without changing pitch (rate > 1 = shorter)"""
        spec = self._stft(audio)
        if spec.shape[1] < 2:
            return audio
        steps = np.arange(0, spec.shape[1] - 1, rate)
        expected = np.linspace(0, np.pi * self._HOP, spec.shape[0])
        phase = np.angle(spec[:, 0])
        out = np.zeros((spec.shape[0], len(steps)), dtype=complex)
        for t, step in enumerate(steps):
            i, frac = int(step), step - int(step)
            mag = (1 - frac) * np.abs(spec[:, i]) + frac * np.abs(spec[:, i + 1])
            out[:, t] = mag * np.exp(1j * phase)
            dphi = np.angle(spec[:, i + 1]) - np.angle(spec[:, i]) - expected
            dphi -= 2 * np.pi * np.round(dphi / (2 * np.pi))
            phase = phase + expected + dphi
        return self._istft(out, int(round(len(audio) / rate)))

    def apply_pitch_shift(self, audio: np.ndarray, semitones: float) -> np.ndarray:
        """
        Shift pitch by semitones, keeping the same duration

        Args:
            audio: Input audio array
            semitones: Number of semitones to shift (-12 to +12)
        """
        if semitones == 0 or len(audio) == 0:
            return audio

        # Resample (changes pitch and length), then stretch back to length
        k = 2 ** (-semitones / 12.0)
        resampled = signal.resample(audio, max(1, int(len(audio) * k)))
        shifted = self.time_stretch(resampled, k)
        return np.pad(shifted, (0, max(0, len(audio) - len(shifted))))[: len(audio)]

    def apply_octave_layer(self, audio: np.ndarray, mix: float = 0.2, semitones: float = -12) -> np.ndarray:
        """
        Blend in a pitch-shifted copy of the same audio (aligned by
        construction) for a doubled, synthetic monk tone
        """
        if mix <= 0:
            return audio
        return audio + mix * self.apply_pitch_shift(audio, semitones)

    def apply_room(self, audio: np.ndarray, seconds: float = 0.25, wet: float = 0.1) -> np.ndarray:
        """
        Convolution reverb with a short, darkened, decaying tail. Starts
        immediately (no pre-delay), so it reads as room rather than echo.
        """
        n = int(self.sample_rate * seconds)
        if n < 1 or wet <= 0:
            return audio
        t = np.arange(n) / self.sample_rate
        rng = np.random.default_rng(7)  # fixed: same room every time
        ir = rng.standard_normal(n) * np.exp(-t * (6.9 / seconds))
        b, a = signal.butter(2, 3500 / (self.sample_rate / 2))
        ir = signal.lfilter(b, a, ir)
        ir /= np.sqrt(np.sum(ir ** 2))
        tail = signal.fftconvolve(audio, ir)
        tail = np.pad(tail, (0, len(audio) + n - len(tail)))
        return (1 - wet) * np.pad(audio, (0, n)) + wet * tail

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
        - zen: Zenbot voice - robot over a subtle octave layer, small room
        - omnic: Robot voice
        - cave: Deep echoing cave
        - demon: Demonic distorted voice
        - chipmunk: High pitched
        - glitch: Digital corruption
        - radio: Lo-fi radio transmission
        - ghost: Ethereal ghostly
        - telephone: Phone quality
        """
        if preset == "zen":
            # Zenbot's voice: omnic robot over a 20% octave-down layer, small room
            audio = self.apply_robot(self.apply_octave_layer(audio, mix=0.2))
            audio = self.apply_room(audio, seconds=0.25, wet=0.1)
            # Normalize: the layer adds level
            peak = np.max(np.abs(audio))
            if peak > 0.95:
                audio = audio / peak * 0.9

        elif preset == "omnic":
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
