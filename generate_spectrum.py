#!/usr/bin/env python3
"""
ColorPaps - Spectrum
Génère un tableau unique avec les 8 sphères de couleur
Chaque pixel RGB n'appartient qu'à une seule sphère (plages HSV disjointes)
"""

import numpy as np
from PIL import Image, ImageDraw
import colorsys
import sys
import json
import os
import gc
import random

# Configuration
SIZE_FULL = 11811  # 1m x 1m @ 300 DPI
SIZE_PREVIEW = 1000
DPI = (300, 300)
RADIUS = 2

# Positions organiques des 8 sphères (normalisées 0-1)
# Disposition libre - vert au centre (le plus massif)
# Positions légèrement écartées
SPHERE_POSITIONS = {
    "vert": (0.50, 0.50),      # Centre (le plus massif)
    "bleu": (0.18, 0.25),      # Haut gauche
    "violet": (0.82, 0.78),    # Bas droite
    "rouge": (0.82, 0.22),     # Haut droite
    "jaune": (0.22, 0.80),     # Bas gauche
    "orange": (0.50, 0.15),    # Haut centre
    "marron": (0.50, 0.85),    # Bas centre
    "gris": (0.18, 0.52),      # Milieu gauche
}


def load_colors(file_path):
    """Charge le fichier texte des couleurs (format CSV: R, G, B)"""
    return np.loadtxt(file_path, delimiter=',', skiprows=1, dtype=np.uint8)


def classify_colors(all_rgb):
    """
    Classifie chaque couleur dans exactement UNE catégorie.
    Plages HSV strictement disjointes.
    Retourne un dict {color_name: (rgb_array, s_array, v_array)}
    """
    # Réduction pour nuances discriminables (seuil 2-bits)
    reduced = (all_rgb // 2) * 2
    _, unique_indices = np.unique(reduced, axis=0, return_index=True)
    p_rgb = all_rgb[unique_indices]

    # Conversion RGB -> HSV
    r_n = p_rgb[:, 0] / 255.0
    g_n = p_rgb[:, 1] / 255.0
    b_n = p_rgb[:, 2] / 255.0
    h, s, v = np.vectorize(colorsys.rgb_to_hsv)(r_n, g_n, b_n)

    # Masque pour tracker les pixels déjà attribués
    assigned = np.zeros(len(p_rgb), dtype=bool)

    results = {}

    # 1. GRIS - Priorité : faible saturation (toutes teintes)
    mask_gris = (s < 0.18) & (v > 0.08) & (v < 0.92)
    results["gris"] = _extract(p_rgb, s, v, mask_gris & ~assigned)
    assigned |= mask_gris

    # 2. MARRON - Zone orange/rouge avec sat/val moyennes
    mask_marron = (
        ((h >= 0.0) & (h <= 0.09)) &
        (s >= 0.20) & (s <= 0.65) &
        (v >= 0.12) & (v <= 0.48)
    )
    results["marron"] = _extract(p_rgb, s, v, mask_marron & ~assigned)
    assigned |= mask_marron

    # 3. ROUGE - Extrémités du cercle chromatique
    mask_rouge = (
        ((h >= 0.95) | (h <= 0.02)) &
        (s >= 0.22) & (v >= 0.12)
    )
    results["rouge"] = _extract(p_rgb, s, v, mask_rouge & ~assigned)
    assigned |= mask_rouge

    # 4. ORANGE - Plage étendue pour récupérer les jaunes orangés
    mask_orange = (
        (h > 0.02) & (h <= 0.12) &
        (s >= 0.25) & (v > 0.48)
    )
    results["orange"] = _extract(p_rgb, s, v, mask_orange & ~assigned)
    assigned |= mask_orange

    # 5. JAUNE - Plage réduite (jaunes purs uniquement)
    mask_jaune = (
        (h > 0.12) & (h <= 0.18) &
        (s >= 0.18) & (v >= 0.20)
    )
    results["jaune"] = _extract(p_rgb, s, v, mask_jaune & ~assigned)
    assigned |= mask_jaune

    # 6. VERT (inclut cyan-vert jusqu'à 0.50)
    mask_vert = (
        (h > 0.18) & (h <= 0.50) &
        (s >= 0.12) & (v >= 0.08)
    )
    results["vert"] = _extract(p_rgb, s, v, mask_vert & ~assigned)
    assigned |= mask_vert

    # 7. BLEU (inclut cyan-bleu à partir de 0.50)
    mask_bleu = (
        (h > 0.50) & (h <= 0.72) &
        (s >= 0.12) & (v >= 0.08)
    )
    results["bleu"] = _extract(p_rgb, s, v, mask_bleu & ~assigned)
    assigned |= mask_bleu

    # 8. VIOLET
    mask_violet = (
        (h > 0.72) & (h < 0.95) &
        (s >= 0.12) & (v >= 0.08)
    )
    results["violet"] = _extract(p_rgb, s, v, mask_violet & ~assigned)
    assigned |= mask_violet

    del r_n, g_n, b_n, h, s, v
    gc.collect()

    return results


def _extract(p_rgb, s, v, mask):
    """Extrait les données pour un masque donné"""
    return (p_rgb[mask], s[mask], v[mask])


def generate_spectrum_cloud(color_data, size, radius):
    """
    Génère le nuage avec les 8 sphères.
    color_data: dict {color_name: (rgb_array, s_array, v_array)}
    """
    img = Image.new('RGB', (size, size), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    occupied = set()  # Global pour éviter superposition
    total_placed = 0
    stats = {}

    # Calculer les tailles relatives (sigma) basées sur le nombre de points
    counts = {name: len(data[0]) for name, data in color_data.items()}
    max_count = max(counts.values()) if counts else 1

    # Mélanger l'ordre des couleurs (aléatoire)
    color_names = list(color_data.keys())
    random.seed(42)
    random.shuffle(color_names)

    # Grid size = diamètre (2*radius) pour garantir aucun chevauchement de points
    grid_size = radius * 2

    for color_name in color_names:
        p_rgb, p_s, p_v = color_data[color_name]
        num = len(p_rgb)

        if num == 0:
            stats[color_name] = 0
            continue

        # Position du centre de la sphère
        cx_norm, cy_norm = SPHERE_POSITIONS[color_name]
        # Marge pour ne pas toucher les bords
        margin = 0.15
        cx = int((margin + cx_norm * (1 - 2 * margin)) * size)
        cy = int((margin + cy_norm * (1 - 2 * margin)) * size)

        # Sigma proportionnel à sqrt(count) pour surface proportionnelle
        base_sigma = size / 14
        density_factor = np.sqrt(num / max_count)
        sigma = base_sigma * (0.5 + 0.5 * density_factor)

        # Distribution gaussienne centrée sur la position de la sphère
        np.random.seed(hash(color_name) % (2**32))
        x_raw = np.random.normal(cx, sigma, num)
        y_raw = np.random.normal(cy, sigma, num)
        r_raw = np.sqrt((x_raw - cx) ** 2 + (y_raw - cy) ** 2)

        # Tri topographique local
        s_pos = (y_raw * 10.0) + (r_raw * 1.0)
        idx_pos = np.argsort(s_pos)
        s_col = (-p_v * 10.0) + ((1.0 - p_s) * 1.0)
        idx_col = np.argsort(s_col)

        final_x = x_raw[idx_pos]
        final_y = y_raw[idx_pos]
        final_rgb = p_rgb[idx_col]

        placed = 0
        for i in range(num):
            px, py = final_x[i], final_y[i]
            qx = int(px // grid_size) * grid_size
            qy = int(py // grid_size) * grid_size

            # Vérifier que le point est dans l'image et pas déjà occupé
            if (qx, qy) not in occupied and radius <= qx < size - radius and radius <= qy < size - radius:
                c = final_rgb[i]
                draw.ellipse(
                    [px - radius, py - radius, px + radius, py + radius],
                    fill=(int(c[0]), int(c[1]), int(c[2]))
                )
                occupied.add((qx, qy))
                placed += 1

        stats[color_name] = placed
        total_placed += placed

        del x_raw, y_raw, r_raw, final_x, final_y, final_rgb
        gc.collect()

    return img, total_placed, stats


def main():
    # Chemins
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_file = os.path.join(script_dir, "COULEURS_EPSON_P9000_UNIQUE.txt")
    output_dir = os.path.join(script_dir, "public", "generated")

    os.makedirs(output_dir, exist_ok=True)

    # Chargement
    print("Chargement des couleurs...", file=sys.stderr)
    all_rgb = load_colors(data_file)

    # Classification en 8 catégories disjointes
    print("Classification en 8 catégories...", file=sys.stderr)
    color_data = classify_colors(all_rgb)

    for name, (rgb, _, _) in color_data.items():
        print(f"  {name}: {len(rgb)} nuances", file=sys.stderr)

    del all_rgb
    gc.collect()

    # Génération haute résolution
    print("Génération haute résolution...", file=sys.stderr)
    img_full, total_placed, stats = generate_spectrum_cloud(color_data, SIZE_FULL, RADIUS)

    full_filename = f"{total_placed}_Spectrum_ColorPaps_HQ.png"
    full_path = os.path.join(output_dir, full_filename)
    img_full.save(full_path, dpi=DPI)

    # Aperçu par redimensionnement
    print("Création de l'aperçu...", file=sys.stderr)
    img_preview = img_full.resize((SIZE_PREVIEW, SIZE_PREVIEW), Image.LANCZOS)
    preview_filename = "spectrum_preview.png"
    preview_path = os.path.join(output_dir, preview_filename)
    img_preview.save(preview_path)

    del img_full, img_preview
    gc.collect()

    # Résultat JSON
    result = {
        "success": True,
        "count": total_placed,
        "stats": stats,
        "preview": f"/generated/{preview_filename}",
        "full": f"/generated/{full_filename}"
    }

    print(json.dumps(result))


if __name__ == "__main__":
    main()
