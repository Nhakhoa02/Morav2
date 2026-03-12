# Morav2

Morav2 is a wildfire/smoke response optimization project with:

- a **FastAPI + PuLP optimization backend** for multi-floor incident planning,
- a **Next.js frontend** for editing map layers and running scenarios,
- and **simulation utilities** under `experiment_simulation/`.

The optimizer allocates squads across time steps while balancing three objectives lexicographically:
1. minimize people at risk,
2. minimize burned value,
3. minimize total response cost.

## Repository layout

- `backend/` – FastAPI API and `MORABuildingOptimizer` model.
- `frontend/` – Next.js UI for scenario configuration and result visualization.
- `experiment_simulation/` – smoke/fire simulation tools (CLI and GUI).
- `mora.py` – standalone optimization script with sample data.
- `docs/` – paper and references.

## Prerequisites

- Python 3.10+
- Node.js 18+

## Run the backend locally

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Health check:

```bash
curl http://localhost:8000/health
```

## Run the frontend locally

```bash
cd frontend
npm install
npm run dev
```

The dev server runs on port `9002` by default.

## Connecting frontend to backend

By default, the frontend currently posts optimization requests to a hosted endpoint in `frontend/src/lib/api.tsx`.
If you want to use your local backend, update that URL to:

```text
http://localhost:8000/optimize
```

## Backend API summary

### `POST /optimize`

Expected payload includes:

- topology: `num_floors`, `grid_size`, `Tset`
- squads: `resources`, `suppression_rates`, `rescue_rates`, `squad_costs`, `inventory`, `M`
- grid layers: `smoke_map`, `fire_map`, `population_map`, `accessibility`, `min_suppression_required`, `value_map`
- budget: `total_budget`

Returns objective values (`O1`, `O2`, `O3`) plus per-time-step grids for risk, burn/smoke state, treatment, rescue, and allocation.

### `GET /health`

Returns service status.

## Standalone optimizer script

You can also run the sample script directly:

```bash
python mora.py
```

This solves a bundled sample scenario and prints per-time-step allocation/state tables.
