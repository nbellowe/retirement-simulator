# Retirement Simulator

A self-contained Monte Carlo retirement simulator that runs entirely in your browser.

**[Open the simulator →](https://nbellowe.github.io/retirement-simulator)**
**[Read the docs →](https://nbellowe.github.io/retirement-simulator/docs/)**

## Usage

1. Generate a starter profile with the `monarch-money-tools` CLI:
   ```bash
   monarch init-profile
   ```
2. Edit `profile.yaml` with your numbers.
3. Open the simulator and drag `profile.yaml` onto the page (or use **Load file**).
4. Tweak settings interactively; use **Download** to save changes back to `profile.yaml`.

## Profile loading

- **Drag-and-drop** a `profile.yaml` anywhere on the page
- **Load file** button in the YAML Settings panel
- **Paste / edit** YAML directly in the YAML Settings panel and click **Apply YAML**
- Your profile is saved automatically in `localStorage` between sessions

## Sample profile

`sample-profile.yaml` contains a fictional reference profile (Alex & Jordan).

## Privacy

All computation runs client-side. Your profile data never leaves your browser.

## Development

```bash
npm install
npm run dev      # dev server at localhost:5173/retirement-simulator/
npm run build    # produces dist/
```

See `CLAUDE.md` for architecture details.
