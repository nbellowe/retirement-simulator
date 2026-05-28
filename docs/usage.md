# Usage

## Profile Loading

- **Drag-and-drop** a `profile.yaml` anywhere on the page
- **Load file** button in the YAML Settings panel
- **Paste / edit** YAML directly in the YAML Settings panel and click **Apply YAML**
- Your profile is saved automatically in `localStorage` between sessions

## Downloading Changes

After adjusting sliders or editing YAML, click **Download** to save your current profile back to `profile.yaml`.

## Quick Scenarios

The **Quick Scenarios** panel offers preset buttons grouped by assumption type (returns, withdrawal strategy, spending). Each button changes one category and preserves your other settings, so you can compose scenarios (e.g., historical returns + Guyton-Klinger + lean spending).

## Simulation Methods

| Method | Description |
|---|---|
| Monte Carlo | Random draws from a normal distribution with your equity/bond return assumptions |
| Historical bootstrap | Randomly samples from the actual 1928–present annual return sequence |
| Deterministic | Single expected-return path with no randomness |

## Withdrawal Strategies

| Strategy | Description |
|---|---|
| Constant dollar | Fixed real spending each year |
| Percent of portfolio | Spend a fixed percentage of current portfolio each year |
| 1/N remaining years | Divide portfolio by remaining years each year |
| Guardrails | Cut spending if withdrawal rate exceeds upper trigger; raise if below lower trigger |
| Guyton-Klinger | Rule-based cuts and raises with capital preservation and prosperity triggers |
| Vanguard dynamic | Constrain year-over-year spending changes within a floor/ceiling band |
