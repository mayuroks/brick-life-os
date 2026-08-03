# Fixtures

Test audio for the local transcription harness (`scripts/transcribe-local.mjs`).

## `test.opus`

- **Source**: synthesized with macOS `say` + ffmpeg → Opus, **not** a recorded real
  person. Safe to commit.
- **Expected transcript** (assert with `EXPECT_TRANSCRIPT`):
  `hello this is a test of voice transcription for the brick bot`
  (normalize case when comparing — type the substring in lowercase, e.g. `EXPECT_TRANSCRIPT="voice transcription"`).
- **Regenerate**:
  ```sh
  say -o /tmp/brick.aiff "Hello, this is a test of voice transcription for the Brick bot."
  ffmpeg -y -loglevel error -i /tmp/brick.aiff -ar 48000 -ac 1 -c:a libopus fixtures/test.opus
  ```

## Policy

Do **not** commit recordings of real people here. If you replace the fixture with a
real Discord voice clip for a final regression pass, keep it out of git (see
`.gitignore`); re-add it here only with explicit consent.
