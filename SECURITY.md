# Security Policy

## Reporting a Vulnerability

Please do not report security vulnerabilities through public GitHub issues.

If you discover a vulnerability, email **bright@zumbador.com** with:
- A description of the issue
- Steps to reproduce
- Potential impact

You can expect an acknowledgment within 48 hours and a resolution update within 7 days.

## Scope

This policy applies to the open-source codebase in this repository. The production deployment and any proprietary data layers are managed separately and are not in scope for this program.

## Notes on API Keys

This project requires several third-party API keys (EIA, NREL, Mapbox, Anthropic). Never commit API keys to the repository. The `.env` file is included in `.gitignore` for this reason. If you discover an exposed key in the repository history, please report it immediately so it can be rotated.
