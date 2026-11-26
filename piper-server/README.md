# Piper TTS Server with Audio Effects

Enhanced Piper TTS server with real-time audio effects processing.

## API Endpoints

### Generate TTS with Effects

**GET** `/api/tts`

**Parameters:**
- `text` (required): Text to synthesize
- `voice` (optional): Voice model (john, joe, ryan, lessac, amy, danny)
- `speed` (optional): Speed multiplier (0.5-2.0)
- `effect` (optional): Effect preset name
- `reverb` (optional): Reverb amount (0-1)
- `pitch` (optional): Pitch shift in semitones (-12 to +12)
- `distortion` (optional): Distortion gain (1-50)
- `echo` (optional): Echo delay in milliseconds
- `bitcrush` (optional): Bit depth (1-16)

### Effect Presets

**Omnic** (`effect=omnic`)
- Robot voice with subtle reverb
- Perfect for Zenyatta/omnic character

**Cave** (`effect=cave`)
- Deep echoing cave ambience
- Heavy reverb with lowered pitch

**Demon** (`effect=demon`)
- Demonic distorted voice
- Very low pitch with heavy distortion

**Chipmunk** (`effect=chipmunk`)
- High-pitched cartoon voice

**Glitch** (`effect=glitch`)
- Digital corruption and artifacts
- Bitcrushed with stuttering

**Radio** (`effect=radio`)
- Lo-fi radio transmission
- Reduced bit depth with distortion

**Ghost** (`effect=ghost`)
- Ethereal ghostly voice
- Chorus and heavy reverb

**Telephone** (`effect=telephone`)
- Phone call quality
- Reduced quality with slight echo

## Examples

```bash
# Basic TTS
curl "http://localhost:8080/api/tts?text=Hello+world&voice=john"

# Robot voice (omnic preset)
curl "http://localhost:8080/api/tts?text=Experience+tranquility&voice=john&effect=omnic"

# Custom effects combination
curl "http://localhost:8080/api/tts?text=Testing&voice=john&pitch=-3&reverb=0.5&echo=300"

# Chipmunk voice
curl "http://localhost:8080/api/tts?text=Squeaky+voice&voice=john&effect=chipmunk"

# Demonic voice
curl "http://localhost:8080/api/tts?text=Fear+me&voice=joe&effect=demon"
```

## Effect Parameters

### Reverb
- `reverb=0.0` - No reverb (dry)
- `reverb=0.3` - Subtle room ambience
- `reverb=0.7` - Large hall
- `reverb=1.0` - Cathedral

### Pitch Shift
- `pitch=-12` - One octave down
- `pitch=-5` - Deeper voice
- `pitch=0` - No change
- `pitch=5` - Higher voice
- `pitch=12` - One octave up

### Distortion
- `distortion=3` - Subtle warmth
- `distortion=10` - Heavy overdrive
- `distortion=30` - Extreme distortion

### Echo
- `echo=100` - Quick slap echo
- `echo=500` - Medium delay
- `echo=1000` - Long echo

### Bitcrush
- `bitcrush=16` - CD quality (no effect)
- `bitcrush=8` - Lo-fi/retro
- `bitcrush=4` - Heavy degradation
- `bitcrush=1` - Extreme digital corruption

## Voice Models

- **john** (default) - Balanced male voice
- **joe** - Deep male voice
- **ryan** - Clear male voice
- **lessac** - Clear female voice
- **amy** - Soft female voice
- **danny** - Robotic male voice (low quality)

## Health Check

**GET** `/health`

Returns server status.

**GET** `/api/voices`

Returns list of available voice models.
