# main.py (updated for multi-floor)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import pulp
from solver import MORABuildingOptimizer  # Assuming updated solver.py

app = FastAPI(title="MORA Building Optimizer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class OptimizeInput(BaseModel):
    num_floors: int
    grid_size: List[int]  # [rows, cols]
    resources: List[str]
    suppression_rates: List[int]
    rescue_rates: List[int]
    squad_costs: List[int]
    inventory: List[List[int]]
    smoke_map: List[List[List[int]]]
    fire_map: List[List[List[int]]]
    population_map: List[List[List[int]]]
    accessibility: List[List[List[int]]]
    min_suppression_required: List[List[List[int]]]
    value_map: List[List[List[int]]]
    total_budget: int
    M: List[int]
    Tset: List[int]

@app.post("/optimize")
def optimize(input: OptimizeInput):
    optimizer = MORABuildingOptimizer(
        input.num_floors,
        tuple(input.grid_size), 
        input.resources, 
        input.suppression_rates, 
        input.rescue_rates, 
        input.squad_costs, 
        input.inventory,
        input.smoke_map, 
        input.fire_map, 
        input.population_map, 
        input.accessibility, 
        input.min_suppression_required,
        input.value_map, 
        input.total_budget, 
        input.M, 
        input.Tset
    )
    optimizer.build_model()
    optimizer.solve()
    return optimizer.get_results()

@app.get("/health")
def health():
    return {"status": "ok"}