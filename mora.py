import pulp

# ================== DATA ==================
grid_size = (5, 5)
rows, cols = grid_size
cells = list(range(rows * cols))

resources = ['A', 'B', 'C']
suppression_rates = [2, 5, 10]
squad_costs = [5, 15, 20]

inventory = [[4,4,4], [3,2,4], [0,0,1]]

fire_map = [
    [-1,-1,-1,1,2],
    [-1, 0, 0,1,2],
    [-1, 0, 0,1,2],
    [-1, 1, 1,1,2],
    [-1, 2, 2,2,2]
]

population_map = [
    [0,0,0,2,3],
    [0,0,0,4,5],
    [0,0,2,3,6],
    [0,2,3,4,7],
    [0,2,4,7,7]
]

accessibility = [
    [0,0,0,1,1],
    [0,1,1,1,1],
    [0,1,1,1,1],
    [0,1,1,1,1],
    [0,1,1,1,1]
]

total_budget = 150
min_suppression_required = 10
Tset = range(3)
M = [0, 0, 0]  # accessibility requirement per resource

# ================== MODEL ==================
model = pulp.LpProblem("MORA_Wildfire", pulp.LpMinimize)

P = {a: population_map[a//cols][a%cols] for a in cells}
V = {a: 1 for a in cells}
S = {i: suppression_rates[i] for i in range(3)}
C = {i: squad_costs[i] for i in range(3)}
K = {i: {t: inventory[i][t] for t in Tset} for i in range(3)}

H = {a: {t: 0 for t in Tset} for a in cells}
for r in range(rows):
    for c in range(cols):
        ft = fire_map[r][c]
        if ft in Tset:
            H[r*cols + c][ft] = 1

G = {a: accessibility[a//cols][a%cols] for a in cells}

x   = pulp.LpVariable.dicts("x",   (range(3), cells, Tset), lowBound=0, cat="Integer")
mu  = pulp.LpVariable.dicts("mu",  (cells, Tset), cat="Binary")
k   = pulp.LpVariable.dicts("k",   (cells, Tset), cat="Binary")
phi = pulp.LpVariable.dicts("phi", (cells, Tset), cat="Binary")
z   = pulp.LpVariable.dicts("z",   (range(3), cells, Tset), cat="Binary")

O1 = pulp.lpSum(P[a] * mu[a][t] for a in cells for t in Tset)
O2 = pulp.lpSum(V[a] * pulp.lpSum(k[a][t] for t in Tset) for a in cells)
O3 = pulp.lpSum(x[i][a][t] * C[i] for i in range(3) for a in cells for t in Tset)

model += O1

# 1. Budget (5)
model += O3 <= total_budget

# 2. Capacity (6)
for i in range(3):
    for t in Tset:
        model += pulp.lpSum(x[i][a][t] for a in cells) <= K[i][t]

# 3. Sufficient resources (7)
for a in cells:
    for t in Tset:
        model += pulp.lpSum(x[i][a][t] * S[i] for i in range(3)) >= phi[a][t] * min_suppression_required

# 4. Accessibility (8) + link x-z
bigM = 5
for i in range(3):
    for a in cells:
        for t in Tset:
            model += z[i][a][t] <= G[a] + (1 - M[i])
            model += x[i][a][t] <= bigM * z[i][a][t]

# 5. Only treat high-risk (9)
for a in cells:
    for t in Tset:
        model += phi[a][t] <= mu[a][t]

# 6. Burn if high-risk and not treated (same period - required for correct spread)
for a in cells:
    for t in Tset:
        model += k[a][t] <= mu[a][t] - phi[a][t]

# 7. At most once (11-13)
for a in cells:
    model += pulp.lpSum(mu[a][t] for t in Tset) <= 1
    model += pulp.lpSum(k[a][t] for t in Tset) <= 1
    model += pulp.lpSum(phi[a][t] for t in Tset) <= 1

# 8. Burnt/treated requires high-risk (14-15)
for a in cells:
    model += pulp.lpSum(k[a][t] for t in Tset) <= pulp.lpSum(mu[a][t] for t in Tset)
    model += pulp.lpSum(phi[a][t] for t in Tset) <= pulp.lpSum(mu[a][t] for t in Tset)

# 9. Not both (16)
for a in cells:
    model += pulp.lpSum(k[a][t] for t in Tset) + pulp.lpSum(phi[a][t] for t in Tset) <= 1

# 10. Each high-risk must become treated or burnt (>=) (17)
model += (pulp.lpSum(phi[a][t] for a in cells for t in Tset) +
          pulp.lpSum(k[a][t] for a in cells for t in Tset) >=
          pulp.lpSum(mu[a][t] for a in cells for t in Tset))

# Initial high-risk
for a in cells:
    model += mu[a][0] == H[a][0]

# 11. Spread condition (18-19)
for a in cells:
    for t in list(Tset)[1:]:
        r, c = divmod(a, cols)
        neigh_idx = [(r+dr)*cols + (c+dc) for dr in [-1,0,1] for dc in [-1,0,1]
                     if not (dr==0 and dc==0) and 0 <= r+dr < rows and 0 <= c+dc < cols]
        s = pulp.lpSum(k[n][t-1] for n in neigh_idx)
        model += H[a][t] * s <= 10 * mu[a][t]
        model += 10 * (1 - mu[a][t]) >= 1 - (H[a][t] * s)

# Lexicographic solve
solver = pulp.PULP_CBC_CMD(msg=0, timeLimit=60)

model.solve(solver)
pop_val = pulp.value(O1)
model += O1 == pop_val

model.objective = O2
model.solve(solver)
burn_val = pulp.value(O2)
model += O2 == burn_val

model.objective = O3
model.solve(solver)

print("=== OPTIMAL SOLUTION ===")
print("O1 (people at risk):", pop_val)
print("O2 (burnt cells):", burn_val)
print("O3 (total cost):", pulp.value(O3))

for t in Tset:
    print(f"\n┌──────────── Time {t} ────────────┐")
    print("High-risk (mu):")
    for r in range(rows):
        row = [int(pulp.value(mu[r*cols+c][t])) for c in range(cols)]
        print("  ", row)

    print("Burnt (k):")
    for r in range(rows):
        row = [int(pulp.value(k[r*cols+c][t])) for c in range(cols)]
        print("  ", row)

    print("Treated (phi):")
    for r in range(rows):
        row = [int(pulp.value(phi[r*cols+c][t])) for c in range(cols)]
        print("  ", row)

    print("Allocation:")
    for ri, res in enumerate(resources):
        print(f"  {res}:")
        for r in range(rows):
            print("   ", [int(pulp.value(x[ri][r*cols+c][t])) for c in range(cols)])
    print("└────────────────────────────────────┘")