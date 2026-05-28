# Retirement Simulator

A self-contained Monte Carlo retirement simulator that runs entirely in your browser.

**[Open the simulator →](https://nbellowe.github.io/retirement-simulator)**

## Usage

1. Open the simulator and use **Intro guide** to choose a starting path.
2. Either upload an existing YAML profile, build a starter profile from core household stats, or load the fictional sample profile.
3. Tweak settings interactively; use **Download** to save changes back to `profile.yaml`.

If you already use the `monarch-money-tools` CLI, you can generate a starter profile first:
   ```bash
   monarch init-profile
   ```
Then drag `profile.yaml` onto the page or use **Load file** in the YAML Settings panel.

## Profile loading

- **Drag-and-drop** a `profile.yaml` anywhere on the page
- **Load file** button in the YAML Settings panel
- **Paste / edit** YAML directly in the YAML Settings panel and click **Apply YAML**
- **Intro guide** can build a starter profile from stats or load the fictional sample
- Your profile is saved automatically in `localStorage` between sessions

## Sample profile

`sample-profile.yaml` contains a fictional reference profile (Alex & Jordan).

## Privacy

All computation runs client-side. Your profile data never leaves your browser.
