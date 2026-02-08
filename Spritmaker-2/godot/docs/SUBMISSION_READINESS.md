# Submission Readiness Checklist

This checklist is for final Devpost submission hardening.

## Security

- [x] No real API keys in tracked files (`.env`, `.env.example`, docs, scripts)
- [x] `.env` excluded from version control
- [ ] Rotate any key that was previously committed/shared

## Required Submission Assets

- [ ] Public code repository link added to Devpost
- [ ] Demo video uploaded (target: 2-3 minutes)
- [ ] Project description and Gemini usage sections completed
- [ ] Team members and eligibility details verified

## Technical Validation

- [ ] `npm run build` succeeds in `src/zerograft-ai/src/mcp-servers/godot`
- [ ] `npm test` succeeds in `src/zerograft-ai/src/mcp-servers/godot`
- [ ] AI router starts and accepts HTTP/WS requests
- [ ] Godot fork connects to AI router
- [ ] Core demo scenario runs end-to-end without manual recovery

## Documentation Consistency

- [ ] Ports are consistent everywhere (`9876`, `9877`, `9878`)
- [ ] README reflects MVP status and real startup flow
- [ ] Architecture doc matches current runtime behavior
- [ ] Known limitations are stated explicitly

## Demo Reliability

- [ ] Demo path avoids unfinished TODO/placeholder flows
- [ ] SpriteMancer backend is running and reachable
- [ ] Fallback behavior (if backend unavailable) is shown clearly
- [ ] Approval workflow is visible in demo (human-in-loop)
