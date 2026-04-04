# Contributing to Vertiport Evaluation System

Thank you for your interest in contributing. This project is in active early development, so contributions are welcome but may take time to review.

## How to Contribute

### Reporting Bugs

Open an issue with:
- A clear description of the problem
- Steps to reproduce
- What you expected vs. what actually happened
- Your browser and OS

### Suggesting Features

Open an issue with the `enhancement` label. Describe the use case, not just the feature — it helps understand whether it fits the project's direction.

### Submitting Code

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Test locally (`npm run dev`)
4. Open a pull request with a clear description of what changed and why

### Areas Where Contributions Are Welcome

- Nationwide parcel API integrations (counties beyond Harris County, TX)
- Additional demand scoring data sources
- UI/UX improvements
- Test coverage
- Documentation

### Areas That Are Out of Scope for Public Contributions

The core scoring model — weights, thresholds, and normalization logic — is proprietary and not open to external modification. PRs that alter scoring calculations will not be merged.

## Code Style

No formal style guide is enforced. Match the surrounding code. React components use functional style with hooks.

## Questions

Open an issue or reach out via the contact information in the README.
