# NEXUS AI — Python Sidecar (Placeholder)

> This folder will host the optional Python sidecar for local AI, voice, and vision workloads. **Nothing is implemented in the foundation phase.**

---

## Planned Role

- Local LLM inference via **Ollama** (e.g., `llama3.1`, `phi3`)
- STT/TTS pipelines (Whisper, Piper, etc.)
- Vision / CV helpers (screenshots, window detection)
- Communicates **only** with the Node main-process engine (never directly with the renderer) via `stdio` or `HTTP` (localhost).

---

## Future Structure (proposed)

```
services/sidecar/
  README.md          # this file
  pyproject.toml     # uv/poetry config (future)
  requirements.txt   # or pyproject deps
  src/
    main.py          # FastAPI / stdio entry
    llm/
    stt/
    tts/
  tests/
```

---

## Prerequisites (for later phases)

- **Python 3.11+** (Windows: via python.org or `winget install Python.Python.3.11`)
- **Ollama** — `https://ollama.com/download` → `ollama pull llama3.1`
- `pip` / `uv` for deps (to be documented)

No Python code is required to run the foundation (`npm run dev` works without this folder).

---

*Foundation phase — 2026-10-22.*
