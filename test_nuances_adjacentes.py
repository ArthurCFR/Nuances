#!/usr/bin/env python3
"""
Test de perception des nuances - Couleurs VRAIMENT adjacentes
Trouve les 50 couleurs les plus proches les unes des autres (chaîne de voisins)
"""

import numpy as np
from PIL import Image, ImageDraw, ImageFont
import colorsys
import os

# Configuration identique à palette_crop
RADIUS = 6
GRID_SIZE = RADIUS * 2

# Filtre jaune
JAUNE_FILTER = {
    "hue_ranges": [(0.12, 0.18)],
    "sat_min": 0.18,
    "sat_max": 1.0,
    "val_min": 0.20,
    "val_max": 1.0
}


def load_colors(file_path):
    return np.loadtxt(file_path, delimiter=',', skiprows=1, dtype=np.uint8)


def filter_yellow(all_rgb):
    reduced = (all_rgb // 2) * 2
    _, unique_indices = np.unique(reduced, axis=0, return_index=True)
    p_rgb = all_rgb[unique_indices]

    r_n = p_rgb[:, 0] / 255.0
    g_n = p_rgb[:, 1] / 255.0
    b_n = p_rgb[:, 2] / 255.0
    h, s, v = np.vectorize(colorsys.rgb_to_hsv)(r_n, g_n, b_n)

    cfg = JAUNE_FILTER
    hue_mask = np.zeros(len(h), dtype=bool)
    for hue_min, hue_max in cfg["hue_ranges"]:
        hue_mask |= (h >= hue_min) & (h <= hue_max)
    sat_mask = (s >= cfg["sat_min"]) & (s <= cfg["sat_max"])
    val_mask = (v >= cfg["val_min"]) & (v <= cfg["val_max"])
    mask = hue_mask & sat_mask & val_mask

    return p_rgb[mask], h[mask], s[mask], v[mask]


def find_nearest_neighbor_chain(rgb_array, start_idx, chain_length):
    """
    Trouve une chaîne de couleurs voisines les plus proches.
    Commence à start_idx et trouve successivement le voisin le plus proche.
    """
    n = len(rgb_array)
    used = np.zeros(n, dtype=bool)
    chain_indices = [start_idx]
    used[start_idx] = True

    current_idx = start_idx
    current_rgb = rgb_array[current_idx].astype(float)

    for _ in range(chain_length - 1):
        # Calculer distances à tous les points non utilisés
        min_dist = float('inf')
        nearest_idx = -1

        for i in range(n):
            if not used[i]:
                dist = np.sqrt(np.sum((rgb_array[i].astype(float) - current_rgb)**2))
                if dist < min_dist:
                    min_dist = dist
                    nearest_idx = i

        if nearest_idx == -1:
            break

        chain_indices.append(nearest_idx)
        used[nearest_idx] = True
        current_idx = nearest_idx
        current_rgb = rgb_array[current_idx].astype(float)

    return chain_indices


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_file = os.path.join(script_dir, "COULEURS_EPSON_UNIQUE_1.6M.txt")

    print("Chargement des couleurs...")
    all_rgb = load_colors(data_file)

    print("Filtrage des jaunes...")
    yellow_rgb, yellow_h, yellow_s, yellow_v = filter_yellow(all_rgb)
    print(f"Nuances de jaune: {len(yellow_rgb)}")

    # Prendre un sous-ensemble pour la recherche de voisins (sinon trop long)
    # On prend les jaunes avec une saturation et luminosité moyennes
    mid_mask = (yellow_s > 0.4) & (yellow_s < 0.7) & (yellow_v > 0.6) & (yellow_v < 0.9)
    subset_rgb = yellow_rgb[mid_mask]
    subset_h = yellow_h[mid_mask]
    subset_s = yellow_s[mid_mask]
    subset_v = yellow_v[mid_mask]
    print(f"Sous-ensemble (saturation/luminosité moyennes): {len(subset_rgb)}")

    # Trouver la chaîne de 50 voisins les plus proches
    print("\nRecherche de la chaîne de 50 couleurs voisines les plus proches...")
    start_idx = len(subset_rgb) // 2  # Partir du milieu
    chain_indices = find_nearest_neighbor_chain(subset_rgb, start_idx, 50)

    selected_rgb = subset_rgb[chain_indices]
    selected_h = subset_h[chain_indices]
    selected_s = subset_s[chain_indices]
    selected_v = subset_v[chain_indices]

    print(f"\n50 nuances adjacentes trouvées:")
    print("=" * 80)

    # Calculer les écarts
    deltas = []
    for i in range(len(selected_rgb) - 1):
        delta = np.sqrt(np.sum((selected_rgb[i].astype(float) - selected_rgb[i+1].astype(float))**2))
        deltas.append(delta)

    for i in range(min(10, len(selected_rgb))):
        rgb = selected_rgb[i]
        delta_str = f"Δ={deltas[i]:.1f}" if i < len(deltas) else ""
        print(f"Point {i+1:2d}: RGB({rgb[0]:3d}, {rgb[1]:3d}, {rgb[2]:3d}) | H={selected_h[i]:.4f} S={selected_s[i]:.4f} V={selected_v[i]:.4f} {delta_str}")

    print("...")
    print(f"Point 50: RGB({selected_rgb[-1][0]:3d}, {selected_rgb[-1][1]:3d}, {selected_rgb[-1][2]:3d})")

    print("\n" + "=" * 80)
    print("Écarts RGB entre points ADJACENTS:")
    print(f"Delta min: {min(deltas):.2f}")
    print(f"Delta max: {max(deltas):.2f}")
    print(f"Delta moyen: {np.mean(deltas):.2f}")

    # Créer l'image avec les 50 points
    margin = 50
    spacing = GRID_SIZE + 4  # Un peu plus espacé pour mieux voir
    width = margin * 2 + 50 * spacing
    height = 200

    img = Image.new('RGB', (width, height), (255, 255, 255))
    draw = ImageDraw.Draw(img)

    # Ligne 1 : Points avec espacement normal
    y1 = 60
    for i, rgb in enumerate(selected_rgb):
        x = margin + i * spacing + RADIUS
        color = (int(rgb[0]), int(rgb[1]), int(rgb[2]))
        draw.ellipse([x - RADIUS, y1 - RADIUS, x + RADIUS, y1 + RADIUS], fill=color)

    # Ligne 2 : Points collés (sans espacement)
    y2 = 120
    for i, rgb in enumerate(selected_rgb):
        x = margin + i * (RADIUS * 2) + RADIUS
        color = (int(rgb[0]), int(rgb[1]), int(rgb[2]))
        draw.ellipse([x - RADIUS, y2 - RADIUS, x + RADIUS, y2 + RADIUS], fill=color)

    # Texte
    draw.text((margin, 20), "Espacement normal (12px + 4px)", fill=(100, 100, 100))
    draw.text((margin, 85), "Points collés (diamètre 12px)", fill=(100, 100, 100))
    draw.text((margin, 150), f"Delta RGB moyen entre voisins: {np.mean(deltas):.1f} (min: {min(deltas):.1f}, max: {max(deltas):.1f})", fill=(100, 100, 100))

    output_path = os.path.join(script_dir, "test_50_nuances_adjacentes.png")
    img.save(output_path)
    print(f"\nImage sauvegardée: {output_path}")


if __name__ == "__main__":
    main()
