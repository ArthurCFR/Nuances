#!/usr/bin/env python3
"""
Test de perception des nuances - 50 points jaunes successifs
But: vérifier si l'œil distingue les nuances adjacentes
"""

import numpy as np
from PIL import Image, ImageDraw
import colorsys
import os

# Configuration identique à palette_crop
RADIUS = 6
GRID_SIZE = RADIUS * 2  # 12px entre chaque point

# Filtre jaune identique à generate_palette_crop.py
JAUNE_FILTER = {
    "hue_ranges": [(0.12, 0.18)],
    "sat_min": 0.18,
    "sat_max": 1.0,
    "val_min": 0.20,
    "val_max": 1.0
}


def load_colors(file_path):
    """Charge le fichier texte des couleurs (format CSV: R, G, B)"""
    return np.loadtxt(file_path, delimiter=',', skiprows=1, dtype=np.uint8)


def filter_yellow(all_rgb):
    """Filtre les couleurs jaunes avec la même logique que palette_crop"""
    # Réduction pour nuances discriminables (seuil 2-bits) - identique au script
    reduced = (all_rgb // 2) * 2
    _, unique_indices = np.unique(reduced, axis=0, return_index=True)
    p_rgb = all_rgb[unique_indices]

    # Conversion RGB -> HSV
    r_n = p_rgb[:, 0] / 255.0
    g_n = p_rgb[:, 1] / 255.0
    b_n = p_rgb[:, 2] / 255.0
    h, s, v = np.vectorize(colorsys.rgb_to_hsv)(r_n, g_n, b_n)

    cfg = JAUNE_FILTER

    # Filtre hue
    hue_mask = np.zeros(len(h), dtype=bool)
    for hue_min, hue_max in cfg["hue_ranges"]:
        hue_mask |= (h >= hue_min) & (h <= hue_max)

    sat_mask = (s >= cfg["sat_min"]) & (s <= cfg["sat_max"])
    val_mask = (v >= cfg["val_min"]) & (v <= cfg["val_max"])

    mask = hue_mask & sat_mask & val_mask

    filtered_rgb = p_rgb[mask]
    filtered_h = h[mask]
    filtered_s = s[mask]
    filtered_v = v[mask]

    return filtered_rgb, filtered_h, filtered_s, filtered_v


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_file = os.path.join(script_dir, "COULEURS_EPSON_UNIQUE_1.6M.txt")

    print("Chargement des couleurs...")
    all_rgb = load_colors(data_file)
    print(f"Total couleurs chargées: {len(all_rgb)}")

    print("Filtrage des jaunes...")
    yellow_rgb, yellow_h, yellow_s, yellow_v = filter_yellow(all_rgb)
    print(f"Nuances de jaune trouvées: {len(yellow_rgb)}")

    # Trier par luminosité (V) puis saturation (S) pour avoir des nuances adjacentes
    # C'est ainsi qu'elles sont ordonnées dans le nuage
    sort_key = (-yellow_v * 100) + (yellow_s * 10) + (yellow_h * 1)
    sorted_indices = np.argsort(sort_key)

    # Prendre 50 couleurs successives à partir du milieu du spectre
    start_idx = len(sorted_indices) // 2
    selected_indices = sorted_indices[start_idx:start_idx + 50]
    selected_rgb = yellow_rgb[selected_indices]
    selected_h = yellow_h[selected_indices]
    selected_s = yellow_s[selected_indices]
    selected_v = yellow_v[selected_indices]

    print(f"\n50 nuances sélectionnées (indices {start_idx} à {start_idx + 50}):")
    print("=" * 80)

    # Créer l'image : 50 points en ligne + marge
    margin = 40
    spacing = GRID_SIZE  # Espacement identique au script (12px)
    width = margin * 2 + 50 * spacing
    height = margin * 2 + RADIUS * 4  # Hauteur pour 2 lignes

    img = Image.new('RGB', (width, height), (255, 255, 255))
    draw = ImageDraw.Draw(img)

    # Dessiner les 50 points en ligne
    y = margin + RADIUS

    for i, (rgb, h, s, v) in enumerate(zip(selected_rgb, selected_h, selected_s, selected_v)):
        x = margin + i * spacing + RADIUS

        color = (int(rgb[0]), int(rgb[1]), int(rgb[2]))
        draw.ellipse(
            [x - RADIUS, y - RADIUS, x + RADIUS, y + RADIUS],
            fill=color
        )

        # Afficher les valeurs pour les 10 premiers
        if i < 10:
            print(f"Point {i+1}: RGB({rgb[0]:3d}, {rgb[1]:3d}, {rgb[2]:3d}) | H={h:.4f} S={s:.4f} V={v:.4f}")

    print("...")
    print(f"Point 50: RGB({selected_rgb[-1][0]:3d}, {selected_rgb[-1][1]:3d}, {selected_rgb[-1][2]:3d})")

    # Calculer les écarts entre points adjacents
    print("\n" + "=" * 80)
    print("Écarts RGB entre points adjacents (Delta):")
    deltas = []
    for i in range(len(selected_rgb) - 1):
        delta = np.sqrt(np.sum((selected_rgb[i].astype(float) - selected_rgb[i+1].astype(float))**2))
        deltas.append(delta)

    print(f"Delta min: {min(deltas):.2f}")
    print(f"Delta max: {max(deltas):.2f}")
    print(f"Delta moyen: {np.mean(deltas):.2f}")

    # Sauvegarder
    output_path = os.path.join(script_dir, "test_50_nuances_jaune.png")
    img.save(output_path)
    print(f"\nImage sauvegardée: {output_path}")
    print(f"Dimensions: {width}x{height}px")
    print(f"Rayon des points: {RADIUS}px (diamètre: {RADIUS*2}px)")
    print(f"Espacement: {spacing}px (identique à palette_crop)")


if __name__ == "__main__":
    main()
