"""
Rescue Team Management for Smoke Simulation

Manages rescue team allocation and room rescue operations using
Earliest-Deadline-First heuristic.
"""

import math


class RescueManager:
    """
    Manages rescue team allocation and room rescue operations.
    
    Uses Earliest-Deadline-First heuristic to assign rescue teams to rooms.
    """
    
    def __init__(self, populations, n_teams=2, rescue_capacity=3, t_lethal=3, room_floors=None):
        """
        Initialize rescue manager.
        
        Args:
            populations: dict {room_id: population count}
            n_teams: number of rescue teams available
            rescue_capacity: people rescued per team per timestep
            t_lethal: time steps after full smoke before death occurs
            room_floors: dict {room_id: floor_number} mapping rooms to floors
        """
        self.populations = populations
        self.n_teams = n_teams
        self.rescue_capacity = rescue_capacity
        self.t_lethal = t_lethal
        self.room_floors = room_floors if room_floors else {}
        
        # Team state: list of {busy_until: int, target_room: room_id or None, floor: int}
        # All teams start at floor 0
        self.teams = [{"busy_until": 0, "target_room": None, "floor": 0} for _ in range(n_teams)]
        
        # Tracking
        self.room_smoke_time = {}  # {room_id: time when fully smoked}
        self.room_death_time = {}  # {room_id: time when death occurs}
        self.rescued_rooms = set()  # rooms that have been rescued
        self.dead_rooms = {}       # {room_id: time_of_death}
        
        # Statistics
        self.total_saved = 0
        self.total_dead = 0
    
    def update_smoke_status(self, rooms, smoke_cells, current_time):
        """
        Update which rooms are fully smoked and calculate death times.
        
        Args:
            rooms: dict {room_id: set of cells}
            smoke_cells: set of smoked cells
            current_time: current simulation time
        """
        for room_id, room_cells in rooms.items():
            # Only track rooms with population (ignore corridors/empty spaces)
            if room_id not in self.populations or self.populations[room_id] == 0:
                continue
            
            # Skip if already processed
            if room_id in self.room_smoke_time:
                continue
            
            # Check if room is fully smoked
            if room_cells.issubset(smoke_cells):
                self.room_smoke_time[room_id] = current_time
                self.room_death_time[room_id] = current_time + self.t_lethal
    
    def get_candidate_rooms(self, current_time):
        """
        Get rooms that need rescue, sorted by earliest deadline.
        
        Returns:
            list of (room_id, deadline) sorted by deadline
        """
        candidates = []
        
        for room_id, death_time in self.room_death_time.items():
            # Skip if already rescued or dead
            if room_id in self.rescued_rooms or room_id in self.dead_rooms:
                continue
            
            # Skip if already past deadline
            if current_time >= death_time:
                continue
            
            # Skip if already being rescued
            if any(team["target_room"] == room_id for team in self.teams):
                continue
            
            candidates.append((room_id, death_time))
        
        # Sort by earliest deadline first
        candidates.sort(key=lambda x: x[1])
        return candidates
    
    def assign_rescue_teams(self, current_time):
        """
        Assign free teams to rooms using Earliest-Deadline-First heuristic.
        Only assigns if rescue is feasible (can complete before deadline).
        Accounts for travel time between floors.
        
        Args:
            current_time: current simulation time
        """
        candidates = self.get_candidate_rooms(current_time)
        
        for team in self.teams:
            # Check if team is free
            if current_time >= team["busy_until"] and team["target_room"] is None:
                # Try candidates in EDF order until finding a feasible one
                assigned = False
                while candidates and not assigned:
                    # Check feasibility: can we complete rescue before deadline?
                    room_id, deadline = candidates[0]
                    
                    # Calculate rescue time based on population and team capacity
                    population = self.populations.get(room_id, 0)
                    rescue_time = math.ceil(population / self.rescue_capacity) if population > 0 else 1
                    
                    # Calculate travel time to room's floor (1 timestep per floor, up or down)
                    room_floor = self.room_floors.get(room_id, 0)
                    team_floor = team["floor"]
                    travel_time = abs(room_floor - team_floor)  # 1 timestep per floor
                    
                    # Total time = travel time + rescue time
                    total_time = travel_time + rescue_time
                    rescue_completion_time = current_time + total_time
                    
                    if rescue_completion_time <= deadline:
                        # Feasible - assign team
                        candidates.pop(0)
                        team["busy_until"] = rescue_completion_time
                        team["target_room"] = room_id
                        team["floor"] = room_floor  # Team will be on this floor after rescue
                        assigned = True
                        if travel_time > 0:
                            print(f"  >> Team assigned to rescue Room {room_id} on Floor {room_floor} (pop: {population}, rescue: {rescue_time}t, travel: {travel_time}t, deadline: t={deadline}, completion: t={rescue_completion_time})")
                        else:
                            print(f"  >> Team assigned to rescue Room {room_id} (pop: {population}, rescue: {rescue_time}t, deadline: t={deadline}, completion: t={rescue_completion_time})")
                    else:
                        # Not feasible - skip this room and try next candidate
                        print(f"  >> Room {room_id} cannot be saved (deadline: t={deadline}, earliest completion: t={rescue_completion_time})")
                        candidates.pop(0)
    
    def complete_rescues(self, populations, current_time):
        """
        Complete rescues for teams that have finished.
        
        Args:
            populations: dict {room_id: population}
            current_time: current simulation time
        """
        for team in self.teams:
            if current_time >= team["busy_until"] and team["target_room"] is not None:
                room_id = team["target_room"]
                
                # Mark room as rescued
                self.rescued_rooms.add(room_id)
                pop = populations.get(room_id, 0)
                self.total_saved += pop
                
                print(f"  >> Room {room_id} rescued! {pop} people saved")
                
                # Clear team assignment
                team["target_room"] = None
    
    def process_deaths(self, populations, current_time):
        """
        Process deaths for rooms that have exceeded their death time.
        
        Args:
            populations: dict {room_id: population}
            current_time: current simulation time
        """
        for room_id, death_time in self.room_death_time.items():
            # Skip if already dead or rescued
            if room_id in self.dead_rooms or room_id in self.rescued_rooms:
                continue
            
            # Check if death time has been reached
            if current_time >= death_time:
                self.dead_rooms[room_id] = current_time
                pop = populations.get(room_id, 0)
                self.total_dead += pop
                
                if pop > 0:
                    print(f"  >> Room {room_id} death: {pop} casualties (t={death_time})")
    
    def step(self, rooms, smoke_cells, populations, current_time):
        """
        Execute one time step of rescue operations.
        
        Args:
            rooms: dict {room_id: set of cells}
            smoke_cells: set of smoked cells
            populations: dict {room_id: population}
            current_time: current simulation time
        """
        # Update which rooms are fully smoked
        self.update_smoke_status(rooms, smoke_cells, current_time)
        
        # Complete any finished rescues
        self.complete_rescues(populations, current_time)
        
        # Process deaths
        self.process_deaths(populations, current_time)
        
        # Assign free teams to new rooms
        self.assign_rescue_teams(current_time)
