# Retirement Simulator

A self-contained Monte Carlo retirement simulator that runs entirely in your browser. No server required — open it, load your `profile.yaml`, and get probabilistic projections for portfolio survival, safe withdrawal rates, spending flexibility, and more.

[**Open the simulator →**](https://nbellowe.github.io/retirement-simulator/){ .md-button .md-button--primary }
[**See a sample →**](retirement-simulator/sample.html){ .md-button }

---

## How It Works

The simulator reads a `profile.yaml` file you maintain locally and runs a Monte Carlo simulation (or historical bootstrap, or deterministic path) entirely client-side. Charts show portfolio percentile bands, cashflow, ending-value distribution, feasibility heatmap, historical cohort replays, and scenario comparisons.

All computation is in JavaScript in your browser. Your profile data never leaves your device.

---

## Quick Start

```bash
# Generate a starter profile (requires monarch-money-tools)
monarch init-profile

# Edit with your numbers
open profile.yaml

# Open the simulator
open https://nbellowe.github.io/retirement-simulator/
```

Drag `profile.yaml` onto the page or use **Load file** in the YAML Settings panel.
