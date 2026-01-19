#!/usr/bin/env python3
"""
ColorPaps - Générateur de nuages de couleurs
Adapté pour 8 palettes : bleu, rouge, vert, jaune, orange, marron, gris, violet
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
SIZE_PREVIEW = 1000
DPI = (300, 300)

# RADIUS : taille des cercles de couleur
# - RADIUS = 4 : version originale (cercles plus petits, peuvent ressembler à des étoiles)
# - RADIUS = 6 : version avec cercles bien ronds et visibles (actuelle)
# Pour revenir à l'ancienne version, changer 6 → 4
RADIUS = 6

# Définition des filtres de couleur (hue ranges)
COLOR_FILTERS = {
    "bleu": {
        "hue_ranges": [(0.55, 0.70)],
        "sat_min": 0.15,
        "sat_max": 1.0,
        "val_min": 0.08,
        "val_max": 1.0
    },
    "rouge": {
        "hue_ranges": [(0.95, 1.0), (0.0, 0.05)],
        "sat_min": 0.20,
        "sat_max": 1.0,
        "val_min": 0.10,
        "val_max": 1.0
    },
    "vert": {
        "hue_ranges": [(0.25, 0.45)],
        "sat_min": 0.15,
        "sat_max": 1.0,
        "val_min": 0.08,
        "val_max": 1.0
    },
    "jaune": {
        "hue_ranges": [(0.12, 0.20)],
        "sat_min": 0.20,
        "sat_max": 1.0,
        "val_min": 0.15,
        "val_max": 1.0
    },
    "orange": {
        "hue_ranges": [(0.05, 0.12)],
        "sat_min": 0.25,
        "sat_max": 1.0,
        "val_min": 0.15,
        "val_max": 1.0
    },
    "marron": {
        "hue_ranges": [(0.02, 0.10)],
        "sat_min": 0.20,
        "sat_max": 0.70,
        "val_min": 0.10,
        "val_max": 0.55
    },
    "gris": {
        "hue_ranges": [(0.0, 1.0)],  # Toutes les teintes
        "sat_min": 0.0,
        "sat_max": 0.25,  # Faible saturation = couleurs grisées
        "val_min": 0.05,
        "val_max": 0.95
    },
    "violet": {
        "hue_ranges": [(0.70, 0.85)],
        "sat_min": 0.15,
        "sat_max": 1.0,
        "val_min": 0.08,
        "val_max": 1.0
    }
}


def load_colors(file_path):
    """Charge le fichier texte des couleurs (format CSV: R, G, B)"""
    return np.loadtxt(file_path, delimiter=',', skiprows=1, dtype=np.uint8)


def filter_colors(all_rgb, color_name):
    """Filtre les couleurs selon la palette choisie"""
    if color_name not in COLOR_FILTERS:
        raise ValueError(f"Couleur inconnue: {color_name}")

    cfg = COLOR_FILTERS[color_name]

    # Réduction pour isolation des nuances discriminables (seuil 2-bits)
    reduced = (all_rgb // 2) * 2
    _, unique_indices = np.unique(reduced, axis=0, return_index=True)
    p_rgb = all_rgb[unique_indices]

    # Conversion RGB -> HSV
    r_n, g_n, b_n = p_rgb[:, 0] / 255.0, p_rgb[:, 1] / 255.0, p_rgb[:, 2] / 255.0
    h, s, v = np.vectorize(colorsys.rgb_to_hsv)(r_n, g_n, b_n)

    # Filtre selon la configuration de couleur
    hue_mask = np.zeros(len(h), dtype=bool)
    for hue_min, hue_max in cfg["hue_ranges"]:
        hue_mask |= (h >= hue_min) & (h <= hue_max)

    sat_mask = (s >= cfg["sat_min"]) & (s <= cfg["sat_max"])
    val_mask = (v >= cfg["val_min"]) & (v <= cfg["val_max"])

    mask = hue_mask & sat_mask & val_mask

    filtered_rgb = p_rgb[mask]
    filtered_s = s[mask]
    filtered_v = v[mask]

    del r_n, g_n, b_n, h, s, v
    gc.collect()

    return filtered_rgb, filtered_s, filtered_v


def generate_cloud(p_rgb, p_s, p_v, size, radius):
    """Génère le nuage de points colorés"""
    center = size // 2
    num = len(p_rgb)
    sigma = size / 6.8

    # Distribution gaussienne
    np.random.seed(42)  # Pour reproductibilité
    x_raw = np.random.normal(center, sigma, num)
    y_raw = np.random.normal(center, sigma, num)
    r_raw = np.sqrt((x_raw - center) ** 2 + (y_raw - center) ** 2)

    # Tri topographique (clair en haut, sombre au centre)
    s_pos = (y_raw * 10.0) + (r_raw * 1.0)
    idx_pos = np.argsort(s_pos)
    s_col = (-p_v * 10.0) + ((1.0 - p_s) * 1.0)
    idx_col = np.argsort(s_col)

    final_x = x_raw[idx_pos]
    final_y = y_raw[idx_pos]
    final_rgb = p_rgb[idx_col]

    del x_raw, y_raw, r_raw, s_pos, s_col, idx_pos, idx_col
    gc.collect()

    # Dessin
    img = Image.new('RGB', (size, size), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    occupied = set()
    placed = 0

    grid_size = max(1, int(radius * 1.5))

    for i in range(num):
        px, py = final_x[i], final_y[i]
        qx, qy = int(px // grid_size) * grid_size, int(py // grid_size) * grid_size

        if (qx, qy) not in occupied and radius <= qx < size - radius and radius <= qy < size - radius:
            c = final_rgb[i]
            draw.ellipse(
                [px - radius, py - radius, px + radius, py + radius],
                fill=(int(c[0]), int(c[1]), int(c[2]))
            )
            occupied.add((qx, qy))
            placed += 1

    return img, placed


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python generate_cloud.py <color>"}))
        sys.exit(1)

    color_name = sys.argv[1].lower()

    if color_name not in COLOR_FILTERS:
        print(json.dumps({"error": f"Couleur inconnue: {color_name}. Choix: {list(COLOR_FILTERS.keys())}"}))
        sys.exit(1)

    # Chemins
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_file = os.path.join(script_dir, "COULEURS_EPSON_P9000_UNIQUE.txt")
    output_dir = os.path.join(script_dir, "public", "generated")

    os.makedirs(output_dir, exist_ok=True)

    # Chargement et filtrage
    print(f"Chargement des couleurs...", file=sys.stderr)
    all_rgb = load_colors(data_file)

    print(f"Filtrage pour '{color_name}'...", file=sys.stderr)
    p_rgb, p_s, p_v = filter_colors(all_rgb, color_name)

    print(f"{len(p_rgb)} nuances candidates trouvées", file=sys.stderr)

    if len(p_rgb) == 0:
        print(json.dumps({"error": "Aucune couleur trouvée pour ce filtre"}))
        sys.exit(1)

    # Génération haute résolution uniquement
    print(f"Génération haute résolution...", file=sys.stderr)
    img_full, placed_full = generate_cloud(p_rgb, p_s, p_v, SIZE_FULL, RADIUS)
    full_filename = f"{placed_full}_{color_name}_ColorPaps_HQ.png"
    full_path = os.path.join(output_dir, full_filename)
    img_full.save(full_path, dpi=DPI)

    # Aperçu par redimensionnement de la HD (fidélité garantie)
    print(f"Création de l'aperçu par redimensionnement...", file=sys.stderr)
    img_preview = img_full.resize((SIZE_PREVIEW, SIZE_PREVIEW), Image.LANCZOS)
    preview_filename = f"{color_name}_preview.png"
    preview_path = os.path.join(output_dir, preview_filename)
    img_preview.save(preview_path)

    del img_full, img_preview
    gc.collect()

    # Résultat JSON
    result = {
        "success": True,
        "color": color_name,
        "count": placed_full,
        "preview": f"/generated/{preview_filename}",
        "full": f"/generated/{full_filename}"
    }

    print(json.dumps(result))


if __name__ == "__main__":
    main()
