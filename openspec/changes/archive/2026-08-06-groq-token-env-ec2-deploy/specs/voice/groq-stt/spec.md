## MODIFIED Requirements

### Requirement: Validate provider configuration
The bridge SHALL read the transcription provider API key from the environment (sourced from the app's `.env`), require and validate it before making a transcription call, and SHALL return a clean, categorized client response for transcription outcomes (success / error / empty).

#### Scenario: Missing provider key
- **WHEN** the provider API key is not configured in the environment
- **THEN** the bridge returns a clean error outcome that identifies the missing `GROQ_API_KEY` rather than crashing

#### Scenario: Provider key sourced from environment
- **WHEN** `GROQ_API_KEY` is set in the app's environment (`.env` on the box)
- **THEN** the bridge uses that key for the Groq STT call and no key is hardcoded or baked into the image

#### Scenario: Categorized transcription outcome
- **WHEN** a transcription attempt completes
- **THEN** the outcome is returned to the caller categorized as success, error, or empty
