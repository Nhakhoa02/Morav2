"""
Pygame GUI for 2D Smoke Spread Simulation

Controls:
- SPACE: Start/Pause simulation
- R: Reset simulation
- RIGHT ARROW: Step forward one time step (when paused)
- +/-: Increase/Decrease simulation speed
- ESC: Quit
"""

import pygame
import sys
import random
from smoke_simulation_cli import (find_rooms, spread_smoke, update_deaths, 
                              load_floor_map, extract_populations, get_random_fire_position)
from rescue_manager import RescueManager


# Colors
COLOR_WALL = (50, 50, 50)           # Dark gray
COLOR_EMPTY = (240, 240, 240)       # Light gray
COLOR_SMOKE = (80, 80, 80)          # Medium gray (smoke)
COLOR_TEXT = (0, 0, 0)              # Black
COLOR_GRID_LINE = (200, 200, 200)   # Light grid lines
COLOR_INITIAL_SMOKE = (255, 100, 100)  # Red for initial smoke position
COLOR_DOOR = (150, 200, 150)        # Light green for doors
COLOR_RESCUED = (100, 200, 255)     # Light blue for rescued rooms


class SmokeSimulationGUI:
    def __init__(self, floors, initial_smoke, populations, population_map_3d, door_map_3d, stair_map, cell_size=40, n_teams=2):
        """
        Initialize the smoke simulation GUI.
        
        Args:
            floors: list of 2D grids for all floors
            initial_smoke: tuple (floor, row, col) of initial smoke position
            populations: dict {room_id: population count}
            population_map_3d: dict {(floor, row, col): population}
            door_map_3d: set of (floor, row, col) for door cells
            stair_map: dict {(floor, row, col): stair_type}
            cell_size: size of each cell in pixels
            n_teams: number of rescue teams (default: 2)
        """
        pygame.init()
        
        self.floors = floors
        self.num_floors = len(floors)
        self.current_floor = initial_smoke[0] if initial_smoke else 0
        self.initial_smoke = initial_smoke
        self.populations = populations
        self.population_map_3d = population_map_3d
        self.door_map_3d = door_map_3d
        self.stair_map = stair_map
        self.cell_size = cell_size
        self.n_teams = n_teams
        
        # Use first floor for window sizing
        grid = floors[0] if floors else []
        self.rows = len(grid)
        self.cols = len(grid[0]) if self.rows > 0 else 0
        
        # Calculate window size
        self.grid_width = self.cols * cell_size
        self.grid_height = self.rows * cell_size
        self.info_panel_height = 200
        self.window_width = self.grid_width
        self.window_height = self.grid_height + self.info_panel_height
        
        # Create window
        self.screen = pygame.display.set_mode((self.window_width, self.window_height))
        pygame.display.set_caption("Smoke Spread Simulation (Multi-Floor)")
        
        # Fonts
        self.font_large = pygame.font.Font(None, 32)
        self.font_medium = pygame.font.Font(None, 24)
        self.font_small = pygame.font.Font(None, 20)
        
        # Simulation state - find all rooms across all floors (3D coords)
        self.rooms_3d = find_rooms(floors)
        
        # Precompute cell-to-room mapping for efficient lookups (3D)
        self.cell_to_room_3d = {}
        for room_id, room_cells in self.rooms_3d.items():
            for cell in room_cells:
                self.cell_to_room_3d[cell] = room_id
        
        self.reset_simulation()
        
        # Animation control
        self.running = True
        self.paused = True
        self.fps = 60
        self.clock = pygame.time.Clock()
        self.steps_per_second = 1  # Speed of simulation
        self.frame_counter = 0
        
    def randomize_initial_smoke(self):
        """Randomize the initial smoke position outside populated rooms on any floor."""
        self.initial_smoke = get_random_fire_position(self.floors, self.rooms_3d, self.populations)
        print(f"Fire spawned at Floor {self.initial_smoke[0]}, ({self.initial_smoke[1]}, {self.initial_smoke[2]}) (outside populated rooms)")
    
    def reset_simulation(self, randomize_fire=True):
        """Reset simulation to initial state.
        
        Args:
            randomize_fire: if True, pick new random fire position; if False, keep current position
        """
        if randomize_fire:
            self.randomize_initial_smoke()
        self.current_floor = self.initial_smoke[0]  # Set view to initial smoke floor
        self.smoke_cells = {self.initial_smoke}
        self.stair_transfers = {}
        self.time_step = 0
        self.simulation_ended = False
        
        # Create room-to-floor mapping for rescue manager
        room_floors = {}
        for room_id, cells in self.rooms_3d.items():
            if cells:
                floor_num = next(iter(cells))[0]
                room_floors[room_id] = floor_num
        
        # Initialize rescue manager with floor info
        self.rescue_mgr = RescueManager(self.populations, n_teams=self.n_teams, rescue_capacity=3, t_lethal=3, room_floors=room_floors)
        
        # Initial rescue step
        update_deaths(self.smoke_cells, self.rooms_3d, self.populations, self.rescue_mgr, self.time_step)
    
    def update_deaths(self):
        """Update death statistics using rescue manager."""
        # Use centralized update_deaths function
        update_deaths(self.smoke_cells, self.rooms_3d, self.populations, self.rescue_mgr, self.time_step)
    
    def step_simulation(self):
        """Advance simulation by one time step."""
        if self.simulation_ended:
            return
        
        # Increment time FIRST (match CLI logic)
        self.time_step += 1
        
        # Then spread smoke at the new timestep
        self.smoke_cells, self.stair_transfers = spread_smoke(
            self.floors, self.smoke_cells, self.stair_map, 
            self.stair_transfers, self.time_step, depth=1
        )
        
        # ALWAYS update deaths immediately after smoke spreads
        self.update_deaths()
        
        # Check if all rooms with population are either rescued or dead
        all_rooms_resolved = all(
            room_id in self.rescue_mgr.rescued_rooms or room_id in self.rescue_mgr.dead_rooms
            for room_id in self.populations.keys()
        )
        
        if all_rooms_resolved:
            self.simulation_ended = True
    
    def draw_grid(self):
        """Draw the grid with walls, empty cells, doors, smoke, and rescued rooms."""
        # Get current floor's grid
        if self.current_floor >= len(self.floors):
            return
        
        grid = self.floors[self.current_floor]
        rows = len(grid)
        cols = len(grid[0]) if rows > 0 else 0
        
        # Get smoke cells on current floor
        floor_smoke = {(r, c) for (f, r, c) in self.smoke_cells if f == self.current_floor}
        
        for r in range(rows):
            for c in range(cols):
                x = c * self.cell_size
                y = r * self.cell_size
                
                # Check if cell is in a rescued room (only show rescue for rooms with population)
                room_id = self.cell_to_room_3d.get((self.current_floor, r, c))
                is_rescued = (room_id is not None and 
                             room_id in self.rescue_mgr.rescued_rooms and 
                             room_id in self.populations and 
                             self.populations[room_id] > 0)
                
                # Determine cell color
                if grid[r][c] == -1:
                    # Wall
                    color = COLOR_WALL
                elif grid[r][c] == -2:
                    # Door (light green)
                    if (r, c) in floor_smoke:
                        color = COLOR_SMOKE
                    else:
                        color = COLOR_DOOR
                elif grid[r][c] == -3:
                    # Upstair (purple)
                    if (r, c) in floor_smoke:
                        color = COLOR_SMOKE
                    else:
                        color = (180, 140, 255)  # Light purple
                elif grid[r][c] == -4:
                    # Downstair (blue)
                    if (r, c) in floor_smoke:
                        color = COLOR_SMOKE
                    else:
                        color = (140, 180, 255)  # Light blue
                elif is_rescued:
                    # Rescued room (light blue overlay)
                    color = COLOR_RESCUED
                elif (r, c) in floor_smoke:
                    # Show initial smoke position in different color at t=0
                    if self.time_step == 0 and (self.current_floor, r, c) == self.initial_smoke:
                        color = COLOR_INITIAL_SMOKE
                    else:
                        color = COLOR_SMOKE
                else:
                    color = COLOR_EMPTY
                
                # Draw cell
                pygame.draw.rect(self.screen, color, (x, y, self.cell_size, self.cell_size))
                
                # Draw grid lines
                pygame.draw.rect(self.screen, COLOR_GRID_LINE, 
                               (x, y, self.cell_size, self.cell_size), 1)
    
    def draw_info_panel(self):
        """Draw the information panel with statistics."""
        panel_y = self.grid_height
        
        # Background
        pygame.draw.rect(self.screen, (255, 255, 255), 
                        (0, panel_y, self.window_width, self.info_panel_height))
        pygame.draw.line(self.screen, (0, 0, 0), 
                        (0, panel_y), (self.window_width, panel_y), 2)
        
        # Time step and floor
        time_text = self.font_large.render(f"Time: {self.time_step}  |  Floor: {self.current_floor}/{self.num_floors-1}", True, COLOR_TEXT)
        self.screen.blit(time_text, (20, panel_y + 10))
        
        # Statistics (left column)
        stats_y = panel_y + 50
        smoke_text = self.font_medium.render(f"Smoke cells: {len(self.smoke_cells)}", 
                                             True, COLOR_TEXT)
        self.screen.blit(smoke_text, (20, stats_y))
        
        num_rooms = sum(1 for room_id in self.rooms_3d if self.populations.get(room_id, 0) > 0)
        # Count rooms where ALL cells are smoked (match CLI logic)
        fully_smoked_rooms = sum(
            1 for room_id, room_cells in self.rooms_3d.items() 
            if self.populations.get(room_id, 0) > 0 and all(cell in self.smoke_cells for cell in room_cells)
        )
        rooms_text = self.font_medium.render(
            f"Rooms fully smoked: {fully_smoked_rooms} / {num_rooms}", 
            True, COLOR_TEXT)
        self.screen.blit(rooms_text, (20, stats_y + 30))
        
        # Rescue statistics
        saved_text = self.font_medium.render(
            f"Saved: {self.rescue_mgr.total_saved}", 
            True, (0, 150, 0))
        self.screen.blit(saved_text, (20, stats_y + 60))
        
        deaths_text = self.font_medium.render(
            f"Deaths: {self.rescue_mgr.total_dead}", 
            True, (200, 0, 0))
        self.screen.blit(deaths_text, (20, stats_y + 90))
        
        rescued_text = self.font_small.render(
            f"Rescued: {len(self.rescue_mgr.rescued_rooms)}", 
            True, COLOR_TEXT)
        self.screen.blit(rescued_text, (20, stats_y + 120))
        
        # Status (right column)
        status_x = self.window_width - 250
        if self.simulation_ended:
            status_text = self.font_medium.render("ENDED", True, (255, 0, 0))
        elif self.paused:
            status_text = self.font_medium.render("PAUSED", True, (200, 100, 0))
        else:
            status_text = self.font_medium.render("RUNNING", True, (0, 150, 0))
        self.screen.blit(status_text, (status_x, panel_y + 10))
        
        # Speed
        speed_text = self.font_small.render(f"Speed: {self.steps_per_second} step/s", 
                                           True, COLOR_TEXT)
        self.screen.blit(speed_text, (status_x, panel_y + 45))
        
        # Rescue teams
        teams_text = self.font_small.render(f"Teams: {self.n_teams}", 
                                           True, COLOR_TEXT)
        self.screen.blit(teams_text, (status_x, panel_y + 65))
        
        # Controls
        controls = [
            "SPACE: Play/Pause",
            "→: Step forward",
            "↑/↓: Change floor",
            "R: Reset",
            "+/-: Speed",
            "T/Shift+T: Teams",
        ]
        ctrl_x = status_x
        ctrl_y = panel_y + 90
        for i, ctrl in enumerate(controls):
            ctrl_text = self.font_small.render(ctrl, True, (100, 100, 100))
            self.screen.blit(ctrl_text, (ctrl_x, ctrl_y + i * 20))
    
    def handle_events(self):
        """Handle user input events."""
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
            
            elif event.type == pygame.KEYDOWN:
                # Quit
                if event.key == pygame.K_ESCAPE:
                    self.running = False
                
                # Play/Pause
                elif event.key == pygame.K_SPACE:
                    self.paused = not self.paused
                
                # Reset
                elif event.key == pygame.K_r:
                    self.reset_simulation()
                    self.paused = True
                
                # Step forward (when paused)
                elif event.key == pygame.K_RIGHT and self.paused:
                    self.step_simulation()
                
                # Increase speed
                elif event.key == pygame.K_PLUS or event.key == pygame.K_EQUALS:
                    self.steps_per_second = min(10, self.steps_per_second + 1)
                
                # Decrease speed
                elif event.key == pygame.K_MINUS:
                    self.steps_per_second = max(1, self.steps_per_second - 1)
                
                # Floor navigation
                elif event.key == pygame.K_UP:
                    self.current_floor = min(self.num_floors - 1, self.current_floor + 1)
                    print(f"Viewing Floor {self.current_floor}")
                
                elif event.key == pygame.K_DOWN:
                    self.current_floor = max(0, self.current_floor - 1)
                    print(f"Viewing Floor {self.current_floor}")
                
                # Adjust rescue teams
                elif event.key == pygame.K_t:
                    # Check if Shift is pressed
                    mods = pygame.key.get_mods()
                    if mods & pygame.KMOD_SHIFT:
                        # Shift+T: Decrease teams
                        self.n_teams = max(1, self.n_teams - 1)
                        print(f"Rescue teams decreased to {self.n_teams}")
                    else:
                        # T: Increase teams
                        self.n_teams = min(10, self.n_teams + 1)
                        print(f"Rescue teams increased to {self.n_teams}")
                    # Reset simulation with new team count (keep same fire position)
                    self.reset_simulation(randomize_fire=False)
                    self.paused = True
    
    def run(self):
        """Main game loop."""
        while self.running:
            self.handle_events()
            
            # Update simulation (if not paused)
            if not self.paused and not self.simulation_ended:
                frames_per_step = self.fps // self.steps_per_second
                if self.frame_counter >= frames_per_step:
                    self.step_simulation()
                    self.frame_counter = 0
                self.frame_counter += 1
            
            # Draw everything
            self.screen.fill((255, 255, 255))
            self.draw_grid()
            self.draw_info_panel()
            
            pygame.display.flip()
            self.clock.tick(self.fps)
        
        pygame.quit()


def main():
    """Run the GUI with floor map loaded from a file."""
    print("Multi-Floor Smoke Simulation GUI")
    print("Use UP/DOWN arrow keys to navigate between floors")
    print()
    
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
    
    # Load floor map (multi-floor format)
    print(f"Loading floor map from: {filename}")
    floors, population_map_3d, door_map_3d, stair_map = load_floor_map(filename)
    
    print(f"Floors: {len(floors)}")
    if floors:
        print(f"Floor 0 size: {len(floors[0])} rows x {len(floors[0][0]) if floors[0] else 0} cols")
    print(f"Cells with population: {len(population_map_3d)}")
    print(f"Doors: {len(door_map_3d)}")
    print(f"Stairs: {len(stair_map)}")
    print()
    
    # Get initial smoke position (3D: floor, row, col)
    # Requires all 3 coordinates: argv[3]=floor, argv[4]=row, argv[5]=col
    initial_smoke = None
    if len(sys.argv) >= 6:
        try:
            initial_floor = int(sys.argv[3])
            initial_row = int(sys.argv[4])
            initial_col = int(sys.argv[5])
            initial_smoke = (initial_floor, initial_row, initial_col)
            print(f"Initial smoke position specified: Floor {initial_floor}, ({initial_row}, {initial_col})")
        except ValueError:
            print("Invalid smoke position coordinates, will use random position")
            initial_smoke = None
    
    # If no position specified, will be randomized
    if initial_smoke is None:
        initial_smoke = (0, 0, 0)  # Temporary placeholder, will be randomized in reset_simulation
        print("Initial smoke position will be randomized")
    print()
    
    # Find rooms and extract populations (all floors, 3D)
    rooms = find_rooms(floors)
    populations = extract_populations(rooms, population_map_3d)
    
    # Determine cell size based on grid dimensions
    max_width = 800
    max_height = 600
    grid = floors[0] if floors else []
    cell_size = min(max_width // len(grid[0]), max_height // len(grid)) if grid else 40
    cell_size = max(15, min(50, cell_size))  # Clamp between 15 and 50
    
    print(f"Starting GUI with cell size: {cell_size}px")
    print(f"Number of rescue teams: {n_teams}")
    print()
    
    # Create and run GUI
    gui = SmokeSimulationGUI(floors, initial_smoke, populations, population_map_3d, door_map_3d, stair_map, cell_size=cell_size, n_teams=n_teams)
    gui.run()


if __name__ == "__main__":
    main()
