# Enhanced Conference Action 🎭

The new **Enhanced Conference Action** (`enhanced_conference`) provides advanced multi-personality debates with full transcript generation and granular Zenbot personality selection.

## 🚀 Features

### ✅ **Personality Selection**

Choose exactly which Zenbot personalities participate:

- `zenbot-default` - Classic Zenbot personality
- `zenbot-philosopher` - Deep philosophical analysis
- `zenbot-critic` - Critical examination and skepticism
- `zenbot-optimist` - Positive perspective and hope
- `zenbot-pessimist` - Realistic concerns and challenges
- `zenbot-chaos` - Unconventional and disruptive thinking
- `zenbot-wise` - Ancient wisdom and measured responses

### 📜 **Full Transcripts**

Get detailed conversation logs including:

- All participants and their types (Zenbot vs external AI)
- Round-by-round contributions
- Individual confidence levels
- Synthesis reasoning and consensus metrics
- Complete timing and metadata

### 🤖 **Advanced Provider Control**

- **Zenbot-only mode**: Pure internal Zenbot personality debates
- **External AI integration**: Include OpenAI, Gemini, Anthropic
- **Mixed conferences**: Combine Zenbot personalities with external AIs
- **Provider filtering**: Whitelist/blacklist specific AI providers

## 📋 Usage Examples

### Example 1: Multi-Personality Zenbot Conference

```json
{
  "question": "What is the nature of consciousness?",
  "zenbot_personalities": [
    "zenbot-default",
    "zenbot-philosopher",
    "zenbot-critic"
  ],
  "zenbot_only": true,
  "debate_rounds": 3,
  "include_transcript": true,
  "max_participants": 3
}
```

### Example 2: Mixed AI Conference

```json
{
  "question": "How should AI systems handle ethical dilemmas?",
  "zenbot_personalities": ["zenbot-philosopher", "zenbot-critic"],
  "external_providers": ["gemini", "openai"],
  "zenbot_only": false,
  "debate_rounds": 2,
  "include_transcript": true,
  "max_participants": 4
}
```

### Example 3: Quick Zenbot Debate

```json
{
  "question": "Is technology making humanity better or worse?",
  "zenbot_personalities": ["zenbot-optimist", "zenbot-pessimist"],
  "zenbot_only": true,
  "debate_rounds": 1,
  "include_transcript": false,
  "max_participants": 2
}
```

## 🎯 Parameters

| Parameter              | Type     | Required | Description                                       |
| ---------------------- | -------- | -------- | ------------------------------------------------- |
| `question`             | string   | ✅       | The topic or question for the conference          |
| `zenbot_personalities` | string[] | ❌       | Array of Zenbot personalities to include          |
| `external_providers`   | string[] | ❌       | External AI providers (openai, gemini, anthropic) |
| `debate_rounds`        | number   | ❌       | Number of debate rounds (1-5, default: 2)         |
| `require_consensus`    | boolean  | ❌       | Require high consensus (default: false)           |
| `zenbot_only`          | boolean  | ❌       | Use only Zenbot personalities (default: false)    |
| `include_transcript`   | boolean  | ❌       | Generate detailed transcript (default: true)      |
| `max_participants`     | number   | ❌       | Maximum participants (2-8, default: 4)            |

## 📊 Response Format

The action returns detailed results including:

```json
{
  "success": true,
  "data": {
    "question": "What is consciousness?",
    "response": "Synthesized conference response...",
    "participants": ["zenbot-default", "zenbot-philosopher", "zenbot-critic"],
    "consensusLevel": 0.85,
    "conferenceLevel": "consensus",
    "reasoning": "Synthesis reasoning...",
    "synthesisTime": 2500,
    "totalDuration": 15000,
    "debateRounds": 2,
    "transcript": {
      "timestamp": "2025-09-25T16:30:00.000Z",
      "question": "What is consciousness?",
      "participants": [
        {"id": "zenbot-default", "name": "Zenbot Default", "type": "zenbot"},
        {"id": "zenbot-philosopher", "name": "Zenbot Philosopher", "type": "zenbot"}
      ],
      "rounds": [...],
      "synthesis": {...},
      "metadata": {...}
    },
    "config": {
      "zenbotPersonalities": ["zenbot-default", "zenbot-philosopher"],
      "zenbotOnly": true,
      "externalProviders": []
    }
  },
  "responseText": "**🎭 Enhanced Conference Results**..."
}
```

## 🎭 API Integration

### Discord Command Usage

```
/enhanced_conference question:"What is consciousness?" zenbot_personalities:zenbot-default,zenbot-philosopher zenbot_only:true
```

### API Endpoint Usage

```bash
curl -X POST http://localhost:3001/execute/enhanced_conference \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is the meaning of life?",
    "zenbot_personalities": ["zenbot-philosopher", "zenbot-wise"],
    "include_transcript": true,
    "zenbot_only": true
  }'
```

### AI Function Calling

The action is automatically available to AI assistants as a function with full schema validation.

## 🔧 Technical Details

- **Built on**: Enhanced UnifiedConferenceManager
- **Validation**: Full parameter validation with clear error messages
- **Performance**: Optimized for 2-8 participants with configurable timeouts
- **Memory**: Automatic cleanup after conference completion
- **Logging**: Comprehensive logging for debugging and monitoring

## 🆚 Comparison with Original Conference Action

| Feature               | Original Conference | Enhanced Conference       |
| --------------------- | ------------------- | ------------------------- |
| Personality Selection | ❌                  | ✅ 7 personalities        |
| Transcripts           | ❌                  | ✅ Full conversation logs |
| Zenbot-only Mode      | ❌                  | ✅ Pure internal debates  |
| Provider Control      | ⚠️ Limited          | ✅ Full control           |
| Participant Limits    | 1-3                 | 2-8                       |
| Response Formatting   | ⚠️ Basic            | ✅ Rich formatting        |
| Configuration Options | ⚠️ Few              | ✅ Extensive              |

## 🎉 Benefits

1. **Personality Diversity**: Get perspectives from multiple Zenbot personalities
2. **Full Transparency**: Complete transcripts show the entire debate process
3. **Flexible Control**: Choose exactly which AIs participate
4. **Rich Output**: Detailed metadata and formatted responses
5. **Scalable**: Support for 2-8 participants in a single conference
6. **AI-Ready**: Full schema support for AI function calling

The Enhanced Conference Action transforms multi-AI conversations from basic interactions into rich, documented debates with full personality control!
