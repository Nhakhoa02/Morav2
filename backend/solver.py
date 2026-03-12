# solver.py (updated for multi-floor)
import pulp

class MORABuildingOptimizer:
    def __init__(self, num_floors, grid_size, resources, suppression_rates, rescue_rates, squad_costs, inventory,
                 smoke_map, fire_map, population_map, accessibility, min_suppression_required,
                 value_map, total_budget, M, Tset):
        self.num_floors = num_floors
        self.grid_size = grid_size
        self.rows, self.cols = grid_size
        self.cells = list(range(self.num_floors * self.rows * self.cols))
        self.resources = resources
        self.num_resources = len(resources)
        self.suppression_rates = suppression_rates
        self.rescue_rates = rescue_rates
        self.squad_costs = squad_costs
        self.inventory = inventory
        self.smoke_map = smoke_map
        self.fire_map = fire_map
        self.population_map = population_map
        self.accessibility = accessibility
        self.min_suppression_required = min_suppression_required
        self.value_map = value_map
        self.total_budget = total_budget
        self.M = M
        self.Tset = Tset
        self.model = None
        self.pop_val = None
        self.burn_val = None
        self.cost_val = None

    def build_model(self):
        self.model = pulp.LpProblem("MORA_Building", pulp.LpMinimize)

        plane_size = self.rows * self.cols

        self.P = {}
        self.J = {}
        self.V = {}
        self.G = {}
        for f in range(self.num_floors):
            for r in range(self.rows):
                for c in range(self.cols):
                    a = f * plane_size + r * self.cols + c
                    self.P[a] = self.population_map[f][r][c]
                    self.J[a] = self.min_suppression_required[f][r][c]
                    self.V[a] = self.value_map[f][r][c]
                    self.G[a] = self.accessibility[f][r][c]

        self.S = {i: self.suppression_rates[i] for i in range(self.num_resources)}
        self.R = {i: self.rescue_rates[i] for i in range(self.num_resources)}
        self.C = {i: self.squad_costs[i] for i in range(self.num_resources)}
        self.K = {i: {t: self.inventory[i][t] for t in self.Tset} for i in range(self.num_resources)}
        self.H = {a: {t: 0 for t in self.Tset} for a in self.cells}
        self.F = {a: {t: 0 for t in self.Tset} for a in self.cells}
        for f in range(self.num_floors):
            for r in range(self.rows):
                for c in range(self.cols):
                    a = f * plane_size + r * self.cols + c
                    ft = self.fire_map[f][r][c]
                    if ft >= 0 and ft in self.Tset:
                        self.H[a][ft] = 1
                    st = self.smoke_map[f][r][c]
                    if st >= 0 and st in self.Tset:
                        self.F[a][st] = 1

        self.x = pulp.LpVariable.dicts("x", (range(self.num_resources), self.cells, self.Tset), lowBound=0, cat="Integer")
        self.mu = pulp.LpVariable.dicts("mu", (self.cells, self.Tset), cat="Binary")
        self.k = pulp.LpVariable.dicts("k", (self.cells, self.Tset), cat="Binary")
        self.phi = pulp.LpVariable.dicts("phi", (self.cells, self.Tset), cat="Binary")
        self.sigma = pulp.LpVariable.dicts("sigma", (self.cells, self.Tset), cat="Binary")
        self.f = pulp.LpVariable.dicts("f", (self.cells, self.Tset), cat="Binary")
        self.psi = pulp.LpVariable.dicts("psi", (self.cells, self.Tset), cat="Binary")
        self.rho = pulp.LpVariable.dicts("rho", (self.cells, self.Tset), cat="Binary")
        self.z = pulp.LpVariable.dicts("z", (range(self.num_resources), self.cells, self.Tset), cat="Binary")

        O1 = pulp.lpSum(self.P[a] * self.rho[a][t] for a in self.cells for t in self.Tset)
        O2 = pulp.lpSum(self.V[a] * pulp.lpSum(self.k[a][t] for t in self.Tset) for a in self.cells)
        O3 = pulp.lpSum(self.x[i][a][t] * self.C[i] for i in range(self.num_resources) for a in self.cells for t in self.Tset)

        self.model += O1

        # 1. Budget
        self.model += O3 <= self.total_budget

        # 2. Capacity
        for i in range(self.num_resources):
            for t in self.Tset:
                self.model += pulp.lpSum(self.x[i][a][t] for a in self.cells) <= self.K[i][t]

        # 3. Sufficient suppression
        for a in self.cells:
            for t in self.Tset:
                self.model += pulp.lpSum(self.x[i][a][t] * self.S[i] for i in range(self.num_resources)) >= self.phi[a][t] * self.J[a]

        # 4. Sufficient rescue
        for a in self.cells:
            for t in self.Tset:
                self.model += pulp.lpSum(self.x[i][a][t] * self.R[i] for i in range(self.num_resources)) >= self.psi[a][t] * self.P[a]

        # 5. Accessibility
        self.bigM = 5
        self.compatible = {}
        for i in range(self.num_resources):
            m = self.M[i]
            for a in self.cells:
                g = self.G[a]
                if g == -1:
                    self.compatible[(i, a)] = 0
                elif m == 0:  # land
                    self.compatible[(i, a)] = 1 if g in [0, 2] else 0
                elif m == 1:  # air
                    self.compatible[(i, a)] = 1 if g in [1, 2] else 0
                elif m == 2:  # both
                    self.compatible[(i, a)] = 1 if g in [0, 1, 2] else 0
                else:
                    self.compatible[(i, a)] = 0
        for i in range(self.num_resources):
            for a in self.cells:
                for t in self.Tset:
                    self.model += self.z[i][a][t] <= self.compatible[(i, a)]
                    self.model += self.x[i][a][t] <= self.bigM * self.z[i][a][t]

        # 6. Only treat high-risk
        for a in self.cells:
            for t in self.Tset:
                self.model += self.phi[a][t] <= self.mu[a][t]
                self.model += self.psi[a][t] <= self.sigma[a][t]

        # 7. Burn if high-risk and not treated
        for a in self.cells:
            for t in self.Tset:
                self.model += self.k[a][t] <= self.mu[a][t] - self.phi[a][t]
                self.model += self.f[a][t] <= self.sigma[a][t] - self.psi[a][t]

        # 8. At most once
        for a in self.cells:
            self.model += pulp.lpSum(self.mu[a][t] for t in self.Tset) <= 1
            self.model += pulp.lpSum(self.sigma[a][t] for t in self.Tset) <= 1
            self.model += pulp.lpSum(self.k[a][t] for t in self.Tset) <= 1
            self.model += pulp.lpSum(self.f[a][t] for t in self.Tset) <= 1
            self.model += pulp.lpSum(self.phi[a][t] for t in self.Tset) <= 1
            self.model += pulp.lpSum(self.psi[a][t] for t in self.Tset) <= 1

        # 9. Burnt/treated requires high-risk
        for a in self.cells:
            self.model += pulp.lpSum(self.k[a][t] for t in self.Tset) <= pulp.lpSum(self.mu[a][t] for t in self.Tset)
            self.model += pulp.lpSum(self.phi[a][t] for t in self.Tset) <= pulp.lpSum(self.mu[a][t] for t in self.Tset)
            self.model += pulp.lpSum(self.f[a][t] for t in self.Tset) <= pulp.lpSum(self.sigma[a][t] for t in self.Tset)
            self.model += pulp.lpSum(self.psi[a][t] for t in self.Tset) <= pulp.lpSum(self.sigma[a][t] for t in self.Tset)

        # 10. Not both
        for a in self.cells:
            self.model += pulp.lpSum(self.k[a][t] for t in self.Tset) + pulp.lpSum(self.phi[a][t] for t in self.Tset) <= 1
            self.model += pulp.lpSum(self.f[a][t] for t in self.Tset) + pulp.lpSum(self.psi[a][t] for t in self.Tset) <= 1

        # 11. Each high-risk must become treated or burnt
        self.model += (
            pulp.lpSum(self.phi[a][t] for a in self.cells for t in self.Tset) +
            pulp.lpSum(self.k[a][t] for a in self.cells for t in self.Tset) >=
            pulp.lpSum(self.mu[a][t] for a in self.cells for t in self.Tset)
        )
        self.model += (
            pulp.lpSum(self.psi[a][t] for a in self.cells for t in self.Tset) +
            pulp.lpSum(self.f[a][t] for a in self.cells for t in self.Tset) >=
            pulp.lpSum(self.sigma[a][t] for a in self.cells for t in self.Tset)
        )

        # Initial high-risk
        for a in self.cells:
            self.model += self.mu[a][0] == self.H[a][0]
            self.model += self.sigma[a][0] == self.F[a][0]

        # 12. Spread condition
        for a in self.cells:
            for t in range(1, len(self.Tset)):
                plane_size = self.rows * self.cols
                f = a // plane_size
                a_in_floor = a % plane_size
                r, c = divmod(a_in_floor, self.cols)
                neigh_idx = []
                for dr in [-1, 0, 1]:
                    for dc in [-1, 0, 1]:
                        if dr == 0 and dc == 0:
                            continue
                        nr = r + dr
                        nc = c + dc
                        if 0 <= nr < self.rows and 0 <= nc < self.cols:
                            na = f * plane_size + nr * self.cols + nc
                            neigh_idx.append(na)
                s = pulp.lpSum(self.k[n][t - 1] for n in neigh_idx)
                ff = pulp.lpSum(self.f[n][t - 1] for n in neigh_idx)
                self.model += self.H[a][t] * s <= 10 * self.mu[a][t]
                self.model += self.H[a][t] * ff <= 10 * self.mu[a][t]
                self.model += 10 * (1 - self.mu[a][t]) >= 1 - (self.H[a][t] * s)
                self.model += 10 * (1 - self.mu[a][t]) >= 1 - (self.H[a][t] * ff)
                self.model += self.F[a][t] * s <= 10 * self.sigma[a][t]
                self.model += self.F[a][t] * ff <= 10 * self.sigma[a][t]
                self.model += 10 * (1 - self.sigma[a][t]) >= 1 - (self.F[a][t] * s)
                self.model += 10 * (1 - self.sigma[a][t]) >= 1 - (self.F[a][t] * ff)

        # 13. People at risk
        for a in self.cells:
            for t in self.Tset:
                self.model += self.rho[a][t] >= self.mu[a][t] - self.phi[a][t]
                self.model += self.rho[a][t] >= self.sigma[a][t] - self.psi[a][t]

    def solve(self):
        if self.model is None:
            self.build_model()
        solver = pulp.PULP_CBC_CMD(msg=0, timeLimit=60)
        self.model.solve(solver)
        self.pop_val = pulp.value(self.model.objective)
        self.model += self.model.objective == self.pop_val
        self.model.objective = pulp.lpSum(self.V[a] * pulp.lpSum(self.k[a][t] for t in self.Tset) for a in self.cells)
        self.model.solve(solver)
        self.burn_val = pulp.value(self.model.objective)
        self.model += self.model.objective == self.burn_val
        self.model.objective = pulp.lpSum(self.x[i][a][t] * self.C[i] for i in range(self.num_resources) for a in self.cells for t in self.Tset)
        self.model.solve(solver)
        self.cost_val = pulp.value(self.model.objective)

    def get_results(self):
        if self.cost_val is None:
            self.solve()
        results = {
            'O1': self.pop_val,
            'O2': self.burn_val,
            'O3': self.cost_val,
            'times': {}
        }
        plane_size = self.rows * self.cols
        for t in self.Tset:
            time_res = {
                'mu': [[[0 for _ in range(self.cols)] for _ in range(self.rows)] for _ in range(self.num_floors)],
                'k': [[[0 for _ in range(self.cols)] for _ in range(self.rows)] for _ in range(self.num_floors)],
                'phi': [[[0 for _ in range(self.cols)] for _ in range(self.rows)] for _ in range(self.num_floors)],
                'sigma': [[[0 for _ in range(self.cols)] for _ in range(self.rows)] for _ in range(self.num_floors)],
                'f': [[[0 for _ in range(self.cols)] for _ in range(self.rows)] for _ in range(self.num_floors)],
                'psi': [[[0 for _ in range(self.cols)] for _ in range(self.rows)] for _ in range(self.num_floors)],
                'allocation': {res: [[[0 for _ in range(self.cols)] for _ in range(self.rows)] for _ in range(self.num_floors)] for res in self.resources}
            }
            for f in range(self.num_floors):
                for r in range(self.rows):
                    for c in range(self.cols):
                        a = f * plane_size + r * self.cols + c
                        time_res['mu'][f][r][c] = int(pulp.value(self.mu[a][t]))
                        time_res['k'][f][r][c] = int(pulp.value(self.k[a][t]))
                        time_res['phi'][f][r][c] = int(pulp.value(self.phi[a][t]))
                        time_res['sigma'][f][r][c] = int(pulp.value(self.sigma[a][t]))
                        time_res['f'][f][r][c] = int(pulp.value(self.f[a][t]))
                        time_res['psi'][f][r][c] = int(pulp.value(self.psi[a][t]))
                        for ri, res in enumerate(self.resources):
                            time_res['allocation'][res][f][r][c] = int(pulp.value(self.x[ri][a][t]))
            results['times'][t] = time_res
        return results

    def print_results(self):
        # Updated print to handle multi-floor, but omitted for brevity as we use get_results for API
        pass

    def run(self):
        self.build_model()
        self.solve()
        self.print_results()

if __name__ == "__main__":
    # Sample data for testing (adjusted to 3D for num_floors=1)
    num_floors = 1
    grid_size = (5, 5)
    resources = ['A', 'B', 'C', 'D', 'E', 'F']
    suppression_rates = [2, 5, 10, 0, 0, 0]
    rescue_rates = [0, 0, 0, 2, 5, 10]
    squad_costs = [5, 15, 20, 5, 15, 20]
    inventory = [[4,4,4], [3,2,4], [0,0,1], [4,4,4], [3,2,4], [0,0,1]]

    # Wrap 2D maps in list for 3D
    smoke_map = [smoke_map]  # the original smoke_map from previous
    fire_map = [fire_map]
    population_map = [population_map]
    accessibility = [accessibility]
    min_suppression_required = [min_suppression_required]
    value_map = [value_map]

    total_budget = 300
    Tset = list(range(3))
    M = [0, 0, 0, 0, 0, 0]

    optimizer = MORABuildingOptimizer(
        num_floors, grid_size, resources, suppression_rates, rescue_rates, squad_costs, inventory,
        smoke_map, fire_map, population_map, accessibility, min_suppression_required,
        value_map, total_budget, M, Tset
    )
    optimizer.run()