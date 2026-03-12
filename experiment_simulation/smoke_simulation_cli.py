"""
Deterministic 2D Smoke Spread Simulation

Environment:
- 2D grid: -1 = wall, 0 = empty cell
- Smoke spreads using BFS with depth=1 per time step
- 8-directional spread (up, down, left, right, and diagonals)
- Rooms are connected components of non-wall cells
- Death occurs when all cells in a room become smoke
"""

from collections import deque
from simulation.rescue_manager import RescueManager


def load_floor_map(filename):
    """
    Load multi-floor map from a text file.
    
    File format:
    - "Floor N" headers separate floors (N = 0, 1, 2, ...)
    - Each line contains space-separated values
    - -1 = wall (smoke cannot pass)
    - -2 = door (smoke can pass, separates rooms)
    - -3 = upstair (smoke transfers to floor above in 1 timestep)
    - -4 = downstair (smoke transfers to floor below in 2 timesteps)
    - 0 = empty cell
    - Positive number = population count for that cell's room
    
    Args:
        filename: path to the text file
        
    Returns:
        tuple: (floors, population_map, door_map, stair_map)
            - floors: list of 2D grids, one per floor
            - population_map: dict {(floor, row, col): population}
            - door_map: dict {(floor, row, col)} for door cells
            - stair_map: dict {(floor, row, col): stair_type} where stair_type is -3 or -4
    """
    floors = []
    population_map = {}
    door_map = set()
    stair_map = {}
    
    current_floor = None
    current_grid = []
    row_idx = 0
    
    with open(filename, 'r') as f:
        for line in f:
            line = line.strip()
            
            # Check for floor header
            if line.startswith("Floor"):
                # Save previous floor if exists
                if current_grid:
                    floors.append(current_grid)
                    current_grid = []
                    row_idx = 0
                
                # Parse floor number
                parts = line.split()
                if len(parts) >= 2:
                    current_floor = int(parts[1])
                else:
                    current_floor = len(floors)
                continue
            
            # Skip empty lines
            if not line:
                continue
            
            # If no floor header seen yet, assume floor 0
            if current_floor is None:
                current_floor = 0
            
            row = []
            values = line.split()
            
            for col_idx, val in enumerate(values):
                try:
                    num = int(val)
                    
                    if num == -1:
                        # Wall (smoke cannot pass)
                        row.append(-1)
                    elif num == -2:
                        # Door (smoke can pass, separates rooms)
                        row.append(-2)
                        door_map.add((current_floor, row_idx, col_idx))
                    elif num == -3:
                        # Upstair (smoke transfers up in 1 timestep)
                        row.append(-3)
                        stair_map[(current_floor, row_idx, col_idx)] = -3
                    elif num == -4:
                        # Downstair (smoke transfers down in 2 timesteps)
                        row.append(-4)
                        stair_map[(current_floor, row_idx, col_idx)] = -4
                    elif num == 0:
                        # Empty cell
                        row.append(0)
                    elif num > 0:
                        # Cell with population
                        row.append(0)  # Grid stores 0 for non-wall, non-door, non-stair
                        population_map[(current_floor, row_idx, col_idx)] = num
                    else:
                        # Invalid negative, treat as empty
                        row.append(0)
                except ValueError:
                    # Invalid value, treat as empty
                    row.append(0)
            
            current_grid.append(row)
            row_idx += 1
    
    # Save last floor
    if current_grid:
        floors.append(current_grid)
    
    return floors, population_map, door_map, stair_map


def extract_populations(rooms, population_map):
    """
    Map populations to room IDs based on cell positions.
    Only includes rooms with population > 0 (excludes corridors/empty rooms).
    
    Args:
        rooms: dict {room_id: set of (floor, row, col) cells}
        population_map: dict {(floor, row, col): population}
        
    Returns:
        dict: {room_id: total_population} for rooms with population > 0
    """
    room_populations = {}
    
    for room_id, cells in rooms.items():
        total_pop = 0
        for cell in cells:
            if cell in population_map:
                total_pop += population_map[cell]
        if total_pop > 0:
            room_populations[room_id] = total_pop
    
    return room_populations


def find_rooms(floors, door_map=None):
    """
    Find all rooms (connected components of non-wall, non-door cells) across all floors.
    
    Args:
        floors: list of 2D grids where -1 = wall, -2 = door, -3 = upstair, -4 = downstair, 0+ = empty/populated cell
        door_map: optional set (deprecated, doors now identified by -2 in grid)
        
    Returns:
        dict: {room_id: set of (floor, row, col) tuples in that room}
    """
    # door_map parameter kept for backwards compatibility but not used
    
    rooms = {}
    room_id = 0
    
    # Process each floor separately
    for floor_num, grid in enumerate(floors):
        rows = len(grid)
        cols = len(grid[0]) if rows > 0 else 0
        visited = [[False] * cols for _ in range(rows)]
        
        # 4-directional connectivity (within a floor)
        directions = [(0, 1), (0, -1), (1, 0), (-1, 0)]
        
        for r in range(rows):
            for c in range(cols):
                # Skip walls (-1), doors (-2), stairs (-3, -4), and visited cells
                if grid[r][c] in [-1, -2, -3, -4] or visited[r][c]:
                    continue
                
                # BFS to find connected component (not crossing doors, walls, or stairs)
                room_cells = set()
                queue = deque([(r, c)])
                visited[r][c] = True
                
                while queue:
                    curr_r, curr_c = queue.popleft()
                    room_cells.add((floor_num, curr_r, curr_c))
                    
                    # Explore neighbors
                    for dr, dc in directions:
                        nr, nc = curr_r + dr, curr_c + dc
                        
                        # Check bounds
                        if 0 <= nr < rows and 0 <= nc < cols:
                            # Check if not wall, door, stair, and not visited
                            if grid[nr][nc] not in [-1, -2, -3, -4] and not visited[nr][nc]:
                                visited[nr][nc] = True
                                queue.append((nr, nc))
                
                rooms[room_id] = room_cells
                room_id += 1
    
    return rooms


def get_random_fire_position(floors, rooms, populations):
    """
    Get a random fire starting position on a random floor outside populated rooms.
    
    Args:
        floors: list of 2D grids
        rooms: dict {room_id: set of (floor, row, col)}
        populations: dict {room_id: population count}
    
    Returns:
        tuple: (floor, row, col) for initial smoke position
    """
    import random
    
    # Identify populated rooms
    populated_rooms = set()
    for room_id in rooms:
        if populations.get(room_id, 0) > 0:
            populated_rooms.add(room_id)
    
    # Build cell-to-room mapping for quick lookup
    cell_to_room = {}
    for room_id, room_cells in rooms.items():
        for cell in room_cells:
            cell_to_room[cell] = room_id
    
    # Pick random floor
    random_floor_num = random.randint(0, len(floors) - 1)
    random_floor_grid = floors[random_floor_num]
    
    rows = len(random_floor_grid)
    cols = len(random_floor_grid[0]) if rows > 0 else 0
    
    # Find all valid cells on this floor (outside populated rooms)
    valid_cells = []
    for r in range(rows):
        for c in range(cols):
            # Skip walls, doors, and stairs
            if random_floor_grid[r][c] in [-1, -2, -3, -4]:
                continue
            
            # Check if this cell is in any populated room
            room_id = cell_to_room.get((random_floor_num, r, c))
            if room_id is None or room_id not in populated_rooms:
                valid_cells.append((random_floor_num, r, c))
    
    # Pick random valid cell, or use fallback
    if valid_cells:
        return random.choice(valid_cells)
    else:
        # Fallback: center of random floor
        return (random_floor_num, rows // 2, cols // 2)


def spread_smoke(floors, smoke_cells, stair_map, stair_transfers, current_time, depth=1):
    """
    Spread smoke from all current smoke cells using BFS with maximum depth.
    Supports multi-floor spread via stairs.
    
    Args:
        floors: list of 2D grids
        smoke_cells: set of (floor, row, col) tuples that currently contain smoke
        stair_map: dict {(floor, row, col): stair_type} where stair_type is -3 (upstair) or -4 (downstair)
        stair_transfers: dict {(floor, row, col): arrival_time} for pending smoke transfers
        current_time: current simulation time
        depth: maximum BFS depth within a floor (default: 1)
        
    Returns:
        tuple: (new_smoke_cells, updated_stair_transfers)
    """
    new_smoke = smoke_cells.copy()
    new_transfers = stair_transfers.copy()
    
    # Process transfers that have arrived
    arrived_transfers = [(cell, arrival_time) for cell, arrival_time in stair_transfers.items() 
                         if arrival_time <= current_time]
    for cell, _ in arrived_transfers:
        new_smoke.add(cell)
        del new_transfers[cell]
    
    # Spread smoke within each floor
    for floor_num, grid in enumerate(floors):
        rows = len(grid)
        cols = len(grid[0]) if rows > 0 else 0
        
        # Get smoke cells on this floor (use new_smoke to include just-arrived transfers)
        floor_smoke = {(r, c) for f, r, c in new_smoke if f == floor_num}
        
        # 8-directional spread (including diagonals)
        directions = [(0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (1, -1), (-1, 1), (-1, -1)]
        
        # BFS from all current smoke cells on this floor
        queue = deque()
        visited = set()
        
        # Initialize queue with all current smoke cells at depth 0
        for cell in floor_smoke:
            queue.append((cell[0], cell[1], 0))
            visited.add(cell)
        
        while queue:
            r, c, d = queue.popleft()
            
            # Don't spread beyond max depth
            if d >= depth:
                continue
            
            # Spread to neighbors
            for dr, dc in directions:
                nr, nc = r + dr, c + dc
                
                # Check bounds
                if 0 <= nr < rows and 0 <= nc < cols:
                    # Smoke can pass through everything except walls (-1)
                    # Can pass through doors (-2), stairs (-3, -4), and empty cells (0)
                    if grid[nr][nc] != -1 and (nr, nc) not in visited:
                        visited.add((nr, nc))
                        new_smoke.add((floor_num, nr, nc))
                        queue.append((nr, nc, d + 1))
    
    # Handle stair transfers (schedule transfers when smoke reaches stairs)
    for floor, row, col in new_smoke:
        stair_cell = (floor, row, col)
        if stair_cell in stair_map:
            stair_type = stair_map[stair_cell]
            
            if stair_type == -3:  # Upstair (transfer up in 1 timestep)
                target_floor = floor + 1
                if target_floor < len(floors):
                    target_cell = (target_floor, row, col)
                    # Only schedule if not already smoked or scheduled
                    if target_cell not in new_smoke and target_cell not in new_transfers:
                        new_transfers[target_cell] = current_time + 1
            
            elif stair_type == -4:  # Downstair (transfer down in 2 timesteps)
                target_floor = floor - 1
                if target_floor >= 0:
                    target_cell = (target_floor, row, col)
                    # Only schedule if not already smoked or scheduled
                    if target_cell not in new_smoke and target_cell not in new_transfers:
                        new_transfers[target_cell] = current_time + 2
    
    return new_smoke, new_transfers


def update_deaths(smoke_cells, rooms, populations, rescue_mgr, current_time):
    """
    Update death statistics using RescueManager mechanism.
    
    Args:
        smoke_cells: set of cells containing smoke
        rooms: dict of {room_id: set of cells in room}
        populations: dict of {room_id: population count}
        rescue_mgr: RescueManager instance
        current_time: current simulation time
        
    Returns:
        int: total population dead
    """
    # Use RescueManager to handle rescue operations and deaths
    rescue_mgr.step(rooms, smoke_cells, populations, current_time)
    return rescue_mgr.total_dead


def simulate(floors, initial_smoke, populations, stair_map, n_teams=2):
    """
    Run smoke spread simulation with rescue teams on multi-floor building.
    
    Args:
        floors: list of 2D grids for each floor
        initial_smoke: starting smoke cell (floor, row, col)
        populations: dict {room_id: population count}
        stair_map: dict {(floor, row, col): stair_type}
        n_teams: number of rescue teams (default: 2)
        
    Returns:
        dict: simulation results with statistics
    """
    # Find rooms
    rooms = find_rooms(floors)
    
    # Create room-to-floor mapping for rescue manager
    room_floors = {}
    for room_id, cells in rooms.items():
        # Get floor from first cell (all cells in a room are on same floor)
        if cells:
            floor_num = next(iter(cells))[0]
            room_floors[room_id] = floor_num
    
    # Count actual rooms (with population > 0) vs corridors
    num_rooms = sum(1 for room_id, pop in populations.items() if pop > 0)
    num_corridors = len(rooms) - num_rooms
    
    print("\n=== Simulation Start ===")
    print(f"Floors: {len(floors)}")
    print(f"Spaces found: {len(rooms)} ({num_rooms} rooms, {num_corridors} corridors)")
    for room_id, cells in rooms.items():
        pop = populations.get(room_id, 0)
        space_type = "Room" if pop > 0 else "Corridor"
        floor_num = room_floors.get(room_id, 0)
        print(f"  {space_type} {room_id} (Floor {floor_num}): {len(cells)} cells, population {pop}")
    print()
    
    # Initialize simulation state
    smoke_cells = {initial_smoke}
    stair_transfers = {}  # Track pending smoke transfers between floors
    time_step = 0
    
    # Initialize rescue manager with room floor mapping
    rescue_mgr = RescueManager(populations, n_teams=n_teams, rescue_capacity=3, t_lethal=3, room_floors=room_floors)
    
    # Initial death check
    update_deaths(smoke_cells, rooms, populations, rescue_mgr, time_step)
    
    # Track if smoke is still spreading
    smoke_spreading = True
    
    # Simulation loop - continue until all rooms are resolved
    all_rooms_resolved = False
    
    while not all_rooms_resolved:
        time_step += 1
        print(f"\n--- Time Step {time_step} ---")
        
        # Spread smoke only if it's still expanding
        if smoke_spreading:
            new_smoke_cells, stair_transfers = spread_smoke(floors, smoke_cells, stair_map, stair_transfers, time_step, depth=1)
            
            # Check if smoke actually spread
            if new_smoke_cells == smoke_cells and len(stair_transfers) == 0:
                smoke_spreading = False
                print("  Smoke has stopped spreading (all reachable areas filled)")
            else:
                smoke_cells = new_smoke_cells
                print(f"  Smoke cells: {len(smoke_cells)}")
                if stair_transfers:
                    print(f"  Pending stair transfers: {len(stair_transfers)}")
        else:
            print("  Smoke stable (no spreading)")
        
        # Update deaths/rescues
        update_deaths(smoke_cells, rooms, populations, rescue_mgr, time_step)
        
        # Check if all rooms with population are either rescued or dead
        all_rooms_resolved = all(
            room_id in rescue_mgr.rescued_rooms or room_id in rescue_mgr.dead_rooms
            for room_id in populations.keys()
        )
        
        if all_rooms_resolved:
            print("\n=== All rooms resolved (rescued or dead) ===")
            break
    
    # Final statistics
    print("\n=== Simulation Complete ===")
    print(f"Total time steps: {time_step}")
    print(f"Final smoke coverage: {len(smoke_cells)} cells")
    
    # Count only actual rooms (with population)
    smoked_rooms = sum(1 for room_id, cells in rooms.items() 
                      if populations.get(room_id, 0) > 0 and cells.issubset(smoke_cells))
    print(f"Rooms fully smoked: {smoked_rooms} / {num_rooms}")
    
    print("\nRescue Statistics:")
    print(f"  People saved: {rescue_mgr.total_saved}")
    print(f"  People dead: {rescue_mgr.total_dead}")
    print(f"  Rooms rescued: {len(rescue_mgr.rescued_rooms)}")
    print(f"  Rooms lost: {len(rescue_mgr.dead_rooms)}")
    
    return {
        "time_steps": time_step,
        "smoke_cells": len(smoke_cells),
        "saved": rescue_mgr.total_saved,
        "dead": rescue_mgr.total_dead
    }


def main():
    """
    Run simulation by loading floor map from a text file.
    """
    import sys
    import random
    
    # Check if filename is provided
    if len(sys.argv) > 1:
        filename = sys.argv[1]
    else:
        filename = "floor_map.txt"  # Default file
    
    # Parse number of rescue teams (optional)
    n_teams = 2  # Default
    if len(sys.argv) > 2:
        try:
            n_teams = int(sys.argv[2])
            if n_teams < 1:
                print(f"Warning: Number of teams must be >= 1, using default (2)")
                n_teams = 2
        except ValueError:
            # Not a number, might be fire position, skip
            pass
    
    # Load floor map
    print(f"Loading floor map from: {filename}")
    floors, population_map, door_map, stair_map = load_floor_map(filename)
    print(f"Floors: {len(floors)}")
    if floors:
        print(f"Floor 0 size: {len(floors[0])} rows x {len(floors[0][0]) if floors[0] else 0} cols")
    print(f"Cells with population: {len(population_map)}")
    print(f"Doors: {len(door_map)}")
    print(f"Stairs: {len(stair_map)}")
    print()
    
    # Find rooms first (needed for random smoke placement)
    rooms = find_rooms(floors)
    
    # Precompute cell-to-room mapping for efficient lookups
    cell_to_room = {}
    for room_id, room_cells in rooms.items():
        for cell in room_cells:
            cell_to_room[cell] = room_id
    
    # Get initial smoke position (3D: floor, row, col)
    # Requires all 3 coordinates: argv[3]=floor, argv[4]=row, argv[5]=col
    initial_smoke = None
    if len(sys.argv) >= 6:
        try:
            floor = int(sys.argv[3])
            row = int(sys.argv[4])
            col = int(sys.argv[5])
            
            # Validate position
            if floor < 0 or floor >= len(floors):
                print(f"Error: Floor {floor} is out of bounds (0-{len(floors)-1})")
                return
            
            grid = floors[floor]
            if row < 0 or row >= len(grid) or col < 0 or col >= len(grid[0]):
                print(f"Error: Position ({row}, {col}) is out of bounds on floor {floor}")
                print(f"Floor {floor} size: {len(grid)} rows x {len(grid[0])} cols")
                return
            
            if grid[row][col] == -1:
                print(f"Error: Cannot start fire in a wall at position ({floor}, {row}, {col})")
                return
            
            if grid[row][col] == -2:
                print(f"Warning: Starting fire in a door at position ({floor}, {row}, {col})")
            
            initial_smoke = (floor, row, col)
        except ValueError:
            print("Error: Invalid smoke position coordinates (must be integers)")
            print("Using random position on Floor 0")
            initial_smoke = None
    
    # If no valid position provided, randomize
    if initial_smoke is None:
        initial_smoke = get_random_fire_position(floors, rooms, populations)
        print(f"Random fire position: Floor {initial_smoke[0]}, ({initial_smoke[1]}, {initial_smoke[2]}) (outside populated rooms)")
    
    print(f"Initial smoke position: Floor {initial_smoke[0]}, ({initial_smoke[1]}, {initial_smoke[2]})")
    print()
    
    # Extract populations
    populations = extract_populations(rooms, population_map)
    
    print("SMOKE SPREAD SIMULATION (MULTI-FLOOR)")
    print("=" * 50)
    print(f"Number of rescue teams: {n_teams}")
    print()
    
    # Run simulation
    results = simulate(floors, initial_smoke, populations, stair_map, n_teams=n_teams)
    
    return results


if __name__ == "__main__":
    main()
