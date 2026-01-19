#!/usr/bin/env python3
"""
ColorPaps - Palette Crop
Génère des rencontres de couleurs qui débordent jusqu'aux bords
Les nuages sont plus étalés et les points hors cadre sont clampés aux bords
"""

import numpy as np
from PIL import Image, ImageDraw
import colorsys
import sys
import json
import os
import gc

# Configuration
SIZE_FULL = 11811  # 1m x 1m @ 300 DPI
SIZE_PREVIEW = 800  # Pour l'aperçu
DPI = (300, 300)

RADIUS = 6

# Filtres de couleur (identiques à generate_palette.py)
COLOR_FILTERS = {
    "bleu": {
        "hue_ranges": [(0.50, 0.72)],
        "sat_min": 0.12,
        "sat_max": 1.0,
        "val_min": 0.08,
        "val_max": 1.0
    },
    "rouge": {
        "hue_ranges": [(0.95, 1.0), (0.0, 0.02)],
        "sat_min": 0.22,
        "sat_max": 1.0,
        "val_min": 0.12,
        "val_max": 1.0
    },
    "vert": {
        "hue_ranges": [(0.18, 0.50)],
        "sat_min": 0.12,
        "sat_max": 1.0,
        "val_min": 0.08,
        "val_max": 1.0
    },
    "jaune": {
        "hue_ranges": [(0.12, 0.18)],
        "sat_min": 0.18,
        "sat_max": 1.0,
        "val_min": 0.20,
        "val_max": 1.0
    },
    "orange": {
        "hue_ranges": [(0.02, 0.12)],
        "sat_min": 0.25,
        "sat_max": 1.0,
        "val_min": 0.48,
        "val_max": 1.0
    },
    "marron": {
        "hue_ranges": [(0.0, 0.09)],
        "sat_min": 0.20,
        "sat_max": 0.65,
        "val_min": 0.12,
        "val_max": 0.48
    },
    "gris": {
        "hue_ranges": [(0.0, 1.0)],
        "sat_min": 0.0,
        "sat_max": 0.18,
        "val_min": 0.08,
        "val_max": 0.92
    },
    "violet": {
        "hue_ranges": [(0.72, 0.95)],
        "sat_min": 0.12,
        "sat_max": 1.0,
        "val_min": 0.08,
        "val_max": 1.0
    }
}

# Positions pour compositions multi-couleurs (version crop - plus espacées et décalées)
def get_positions(num_colors):
    """Retourne les positions optimales selon le nombre de couleurs - version crop"""
    if num_colors == 1:
        return [(0.5, 0.5)]
    elif num_colors == 2:
        return [(0.32, 0.42), (0.68, 0.58)]
    elif num_colors == 3:
        return [(0.5, 0.3), (0.3, 0.7), (0.7, 0.7)]
    elif num_colors == 4:
        return [(0.3, 0.3), (0.7, 0.3), (0.3, 0.7), (0.7, 0.7)]
    elif num_colors == 5:
        return [(0.5, 0.25), (0.25, 0.5), (0.75, 0.5), (0.35, 0.8), (0.65, 0.8)]
    elif num_colors == 6:
        return [(0.3, 0.25), (0.7, 0.25), (0.2, 0.55), (0.8, 0.55), (0.35, 0.82), (0.65, 0.82)]
    elif num_colors == 7:
        return [(0.5, 0.18), (0.25, 0.4), (0.75, 0.4), (0.5, 0.55), (0.2, 0.78), (0.5, 0.85), (0.8, 0.78)]
    else:  # 8
        return [
            (0.5, 0.15), (0.2, 0.35), (0.8, 0.35), (0.35, 0.55),
            (0.65, 0.55), (0.2, 0.78), (0.5, 0.85), (0.8, 0.78)
        ]


def load_colors(file_path):
    """Charge le fichier texte des couleurs (format CSV: R, G, B)"""
    return np.loadtxt(file_path, delimiter=',', skiprows=1, dtype=np.uint8)


def filter_colors_for_palette(all_rgb, color_names):
    """
    Filtre les couleurs pour plusieurs palettes.
    Assure l'unicité des couleurs entre les palettes.
    """
    # Réduction pour nuances discriminables
    reduced = (all_rgb // 2) * 2
    _, unique_indices = np.unique(reduced, axis=0, return_index=True)
    p_rgb = all_rgb[unique_indices]

    # Conversion RGB -> HSV
    r_n = p_rgb[:, 0] / 255.0
    g_n = p_rgb[:, 1] / 255.0
    b_n = p_rgb[:, 2] / 255.0
    h, s, v = np.vectorize(colorsys.rgb_to_hsv)(r_n, g_n, b_n)

    assigned = np.zeros(len(p_rgb), dtype=bool)
    results = {}

    # Ordre de priorité pour éviter les chevauchements
    priority_order = ["gris", "marron", "rouge", "orange", "jaune", "vert", "bleu", "violet"]

    for color_name in priority_order:
        if color_name not in color_names:
            continue

        cfg = COLOR_FILTERS[color_name]

        hue_mask = np.zeros(len(h), dtype=bool)
        for hue_min, hue_max in cfg["hue_ranges"]:
            hue_mask |= (h >= hue_min) & (h <= hue_max)

        sat_mask = (s >= cfg["sat_min"]) & (s <= cfg["sat_max"])
        val_mask = (v >= cfg["val_min"]) & (v <= cfg["val_max"])

        mask = hue_mask & sat_mask & val_mask & ~assigned

        results[color_name] = (p_rgb[mask], s[mask], v[mask])
        assigned |= mask

    del r_n, g_n, b_n, h, s, v
    gc.collect()

    return results


def reflect_coord(coord, min_val, max_val):
    """Réfléchit une coordonnée dans les limites [min_val, max_val]"""
    result = coord.copy()
    for _ in range(10):
        below_min = result < min_val
        result[below_min] = 2 * min_val - result[below_min]
        above_max = result > max_val
        result[above_max] = 2 * max_val - result[above_max]
        if np.all((result >= min_val) & (result <= max_val)):
            break
    return np.clip(result, min_val, max_val)


def generate_full_image_crop(color_data, color_names, size, radius):
    """
    Génère l'image haute résolution pour le téléchargement - VERSION CROP
    - Pas de marge : les nuages peuvent atteindre les bords
    - Sigma plus grand : les nuages s'étalent davantage
    - Clamp des coordonnées : les points hors cadre sont ramenés aux bords
    """
    positions = get_positions(len(color_names))
    img = Image.new('RGB', (size, size), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    occupied = set()
    grid_size = radius * 2
    total_placed = 0

    counts = {name: len(data[0]) for name, data in color_data.items()}
    max_count = max(counts.values()) if counts else 1
    total_available = sum(counts.values())

    for idx, color_name in enumerate(color_names):
        if color_name not in color_data:
            continue

        p_rgb, p_s, p_v = color_data[color_name]
        num = len(p_rgb)

        if num == 0:
            continue

        cx_norm, cy_norm = positions[idx]

        # VERSION CROP : pas de marge, les centres sont directement sur la grille normalisée
        cx = cx_norm * size
        cy = cy_norm * size

        # VERSION CROP : sigma beaucoup plus grand pour déborder
        base_sigma = size / (4 + len(color_names))  # Diviseur plus petit = sigma plus grand
        density_factor = np.sqrt(num / max_count)
        sigma = base_sigma * (0.7 + 0.5 * density_factor)  # Facteur de base plus élevé

        np.random.seed(hash(color_name) % (2**32))
        x_raw = np.random.normal(cx, sigma, num)
        y_raw = np.random.normal(cy, sigma, num)

        x_reflected = reflect_coord(x_raw, radius, size - radius - 1)
        y_reflected = reflect_coord(y_raw, radius, size - radius - 1)

        r_raw = np.sqrt((x_raw - cx) ** 2 + (y_raw - cy) ** 2)

        s_pos = (y_reflected * 10.0) + (r_raw * 1.0)
        idx_pos = np.argsort(s_pos)
        s_col = (-p_v * 10.0) + ((1.0 - p_s) * 1.0)
        idx_col = np.argsort(s_col)

        final_x = x_reflected[idx_pos]
        final_y = y_reflected[idx_pos]
        final_rgb = p_rgb[idx_col]

        for i in range(num):
            px, py = final_x[i], final_y[i]
            qx = int(px // grid_size) * grid_size
            qy = int(py // grid_size) * grid_size

            if (qx, qy) not in occupied:
                c = final_rgb[i]
                draw.ellipse(
                    [px - radius, py - radius, px + radius, py + radius],
                    fill=(int(c[0]), int(c[1]), int(c[2]))
                )
                occupied.add((qx, qy))
                total_placed += 1

    return img, total_placed, total_available


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python generate_palette_crop.py <color1,color2,...>"}))
        sys.exit(1)

    colors_arg = sys.argv[1].lower()
    color_names = [c.strip() for c in colors_arg.split(',')]

    # Validation
    valid_colors = list(COLOR_FILTERS.keys())
    for c in color_names:
        if c not in valid_colors:
            print(json.dumps({"error": f"Couleur inconnue: {c}. Choix: {valid_colors}"}))
            sys.exit(1)

    if len(color_names) < 1 or len(color_names) > 8:
        print(json.dumps({"error": "Nombre de couleurs doit être entre 1 et 8"}))
        sys.exit(1)

    # Chemins
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_file = os.path.join(script_dir, "COULEURS_EPSON_P9000_UNIQUE.txt")
    output_dir = os.path.join(script_dir, "public", "generated")
    os.makedirs(output_dir, exist_ok=True)

    # Chargement et filtrage
    print("Chargement des couleurs...", file=sys.stderr)
    all_rgb = load_colors(data_file)

    print(f"Filtrage pour {color_names}...", file=sys.stderr)
    color_data = filter_colors_for_palette(all_rgb, color_names)

    del all_rgb
    gc.collect()

    # Génération image haute résolution - VERSION CROP
    print("Génération haute résolution (crop)...", file=sys.stderr)
    img_full, total_placed, total_available = generate_full_image_crop(color_data, color_names, SIZE_FULL, RADIUS)

    palette_name = "_".join(color_names)
    full_filename = f"{total_placed}_palette_crop_{palette_name}_HQ.png"
    full_path = os.path.join(output_dir, full_filename)

    # Sauvegarder l'image HD
    img_full.save(full_path, dpi=DPI)
    print(f"Image HD sauvegardée: {full_path}", file=sys.stderr)

    # Aperçu par redimensionnement
    img_preview = img_full.resize((SIZE_PREVIEW, SIZE_PREVIEW), Image.LANCZOS)
    preview_filename = f"palette_crop_{palette_name}_preview.png"
    preview_path = os.path.join(output_dir, preview_filename)
    img_preview.save(preview_path)

    result = {
        "success": True,
        "count": total_placed,
        "total_available": total_available,
        "colors": color_names,
        "preview": f"/generated/{preview_filename}",
        "full": f"/generated/{full_filename}"
    }

    print(json.dumps(result))


if __name__ == "__main__":
    main()
