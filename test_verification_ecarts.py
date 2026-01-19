#!/usr/bin/env python3
"""
Vérification des écarts réels dans la base de couleurs après réduction
"""

import numpy as np
import colorsys

def load_colors(file_path):
    return np.loadtxt(file_path, delimiter=',', skiprows=1, dtype=np.uint8)

# Charger les couleurs
print("Chargement...")
all_rgb = load_colors("COULEURS_EPSON_UNIQUE_1.6M.txt")
print(f"Total: {len(all_rgb)} couleurs")

# Appliquer la MÊME réduction que palette_crop
print("\nApplication de la réduction (all_rgb // 2) * 2...")
reduced = (all_rgb // 2) * 2
_, unique_indices = np.unique(reduced, axis=0, return_index=True)
p_rgb = all_rgb[unique_indices]
print(f"Après réduction: {len(p_rgb)} couleurs uniques")

# Calculer les écarts entre TOUTES les paires voisines (échantillon)
print("\nRecherche des couleurs les plus proches dans la base réduite...")

# Prendre un échantillon pour la recherche (trop long sinon)
sample_size = 10000
np.random.seed(42)
sample_indices = np.random.choice(len(p_rgb), min(sample_size, len(p_rgb)), replace=False)
sample = p_rgb[sample_indices].astype(float)

# Trouver les paires les plus proches
min_deltas = []
min_delta_examples = []

for i in range(min(1000, len(sample))):
    # Distance à tous les autres points
    diffs = sample - sample[i]
    distances = np.sqrt(np.sum(diffs**2, axis=1))
    distances[i] = float('inf')  # Ignorer soi-même

    min_idx = np.argmin(distances)
    min_dist = distances[min_idx]
    min_deltas.append(min_dist)

    if min_dist < 2.0:  # Exemple de couleurs très proches
        min_delta_examples.append((sample[i], sample[min_idx], min_dist))

print(f"\nStatistiques sur {len(min_deltas)} points:")
print(f"  Delta minimum trouvé: {min(min_deltas):.2f}")
print(f"  Delta maximum: {max(min_deltas):.2f}")
print(f"  Delta moyen: {np.mean(min_deltas):.2f}")

print(f"\nExemples de paires avec delta < 2.0: {len(min_delta_examples)}")
for ex in min_delta_examples[:10]:
    c1, c2, d = ex
    print(f"  RGB({int(c1[0]):3d},{int(c1[1]):3d},{int(c1[2]):3d}) ↔ RGB({int(c2[0]):3d},{int(c2[1]):3d},{int(c2[2]):3d}) = Δ{d:.2f}")

# Vérifier si ces paires ont bien des réductions différentes
print("\nVérification des réductions pour ces paires:")
for ex in min_delta_examples[:5]:
    c1, c2, d = ex
    r1 = (c1.astype(int) // 2) * 2
    r2 = (c2.astype(int) // 2) * 2
    print(f"  Original: ({int(c1[0])},{int(c1[1])},{int(c1[2])}) → Réduit: ({r1[0]},{r1[1]},{r1[2]})")
    print(f"  Original: ({int(c2[0])},{int(c2[1])},{int(c2[2])}) → Réduit: ({r2[0]},{r2[1]},{r2[2]})")
    print(f"  Réductions différentes? {not np.array_equal(r1, r2)}")
    print()
