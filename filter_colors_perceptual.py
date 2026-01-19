#!/usr/bin/env python3
"""
Filtre intelligent de la base de couleurs basé sur la perception humaine.

Utilise :
- Conversion sRGB → CIELAB (espace perceptuellement uniforme)
- Delta E 2000 (formule moderne tenant compte des non-uniformités)
- Seuils adaptatifs selon la région colorimétrique
- Vérification du gamut Epson P9000

Le but : garder un maximum de couleurs distinctes pour l'œil humain,
tout en éliminant celles qui seraient des doublons à l'impression.
"""

import numpy as np
from PIL import Image, ImageCms
from colormath.color_objects import sRGBColor, LabColor
from colormath.color_conversions import convert_color
from colormath.color_diff import delta_e_cie2000
import os
import sys
from collections import defaultdict

# Configuration
INPUT_FILE = "COULEURS_EPSON_UNIQUE_1.6M.txt"
OUTPUT_FILE = "COULEURS_EPSON_P9000_PERCEPTUAL.txt"
ICC_PROFILE = "icc_profiles/2023 Epson SureColor P9000 MOAB Profiles/MOAB Entrada Rag Bright P9000 USFA.icc"

# Seuils Delta E 2000 adaptatifs
# Plus le seuil est bas, plus on garde de nuances distinctes
DELTA_E_THRESHOLDS = {
    'neutral': 0.5,      # Gris, blancs, noirs - œil très sensible
    'pastel': 0.7,       # Couleurs désaturées claires
    'dark': 0.8,         # Couleurs sombres
    'saturated': 1.2,    # Couleurs vives - œil moins sensible
    'very_saturated': 1.5  # Couleurs très saturées
}


def load_colors(file_path):
    """Charge le fichier de couleurs"""
    print(f"Chargement de {file_path}...")
    colors = np.loadtxt(file_path, delimiter=',', skiprows=1, dtype=np.uint8)
    print(f"  → {len(colors):,} couleurs chargées")
    return colors


def rgb_to_lab_batch(rgb_colors):
    """Convertit un tableau RGB en LAB de manière optimisée"""
    print("Conversion RGB → CIELAB...")

    # Normaliser RGB [0-255] → [0-1]
    rgb_norm = rgb_colors.astype(np.float64) / 255.0

    # Conversion sRGB → XYZ (avec gamma)
    # Appliquer la correction gamma sRGB
    mask = rgb_norm <= 0.04045
    rgb_linear = np.where(mask, rgb_norm / 12.92, ((rgb_norm + 0.055) / 1.055) ** 2.4)

    # Matrice de conversion sRGB → XYZ (illuminant D65)
    M = np.array([
        [0.4124564, 0.3575761, 0.1804375],
        [0.2126729, 0.7151522, 0.0721750],
        [0.0193339, 0.1191920, 0.9503041]
    ])

    xyz = np.dot(rgb_linear, M.T)

    # Référence blanc D65
    xyz_ref = np.array([0.95047, 1.00000, 1.08883])
    xyz_norm = xyz / xyz_ref

    # Conversion XYZ → LAB
    epsilon = 0.008856
    kappa = 903.3

    f = np.where(xyz_norm > epsilon,
                 np.cbrt(xyz_norm),
                 (kappa * xyz_norm + 16) / 116)

    L = 116 * f[:, 1] - 16
    a = 500 * (f[:, 0] - f[:, 1])
    b = 200 * (f[:, 1] - f[:, 2])

    lab = np.column_stack([L, a, b])
    print(f"  → Conversion terminée")
    return lab


def classify_color_region(L, C):
    """
    Classifie une couleur selon sa région perceptuelle.
    L = Luminosité (0-100)
    C = Chroma (saturation) = sqrt(a² + b²)
    """
    if C < 10:  # Très désaturé
        if L > 90:
            return 'neutral'  # Blanc/gris clair
        elif L < 20:
            return 'neutral'  # Noir/gris foncé
        else:
            return 'neutral'  # Gris moyen
    elif C < 30:  # Peu saturé
        if L > 70:
            return 'pastel'
        elif L < 30:
            return 'dark'
        else:
            return 'pastel'
    elif C < 60:  # Moyennement saturé
        if L < 30:
            return 'dark'
        else:
            return 'saturated'
    else:  # Très saturé
        return 'very_saturated'


def delta_e_2000_vectorized(lab1, lab2):
    """
    Calcul Delta E 2000 vectorisé pour de meilleures performances.
    Basé sur la formule CIEDE2000.
    """
    L1, a1, b1 = lab1[:, 0], lab1[:, 1], lab1[:, 2]
    L2, a2, b2 = lab2[:, 0], lab2[:, 1], lab2[:, 2]

    # Constantes de pondération
    kL, kC, kH = 1.0, 1.0, 1.0

    # Calcul des chromas
    C1 = np.sqrt(a1**2 + b1**2)
    C2 = np.sqrt(a2**2 + b2**2)
    C_avg = (C1 + C2) / 2

    # G factor
    G = 0.5 * (1 - np.sqrt(C_avg**7 / (C_avg**7 + 25**7)))

    # a' (a prime)
    a1_prime = a1 * (1 + G)
    a2_prime = a2 * (1 + G)

    # C' (chroma prime)
    C1_prime = np.sqrt(a1_prime**2 + b1**2)
    C2_prime = np.sqrt(a2_prime**2 + b2**2)

    # h' (hue prime)
    h1_prime = np.degrees(np.arctan2(b1, a1_prime)) % 360
    h2_prime = np.degrees(np.arctan2(b2, a2_prime)) % 360

    # Delta L', C', H'
    delta_L_prime = L2 - L1
    delta_C_prime = C2_prime - C1_prime

    # Delta h'
    delta_h_prime = np.zeros_like(h1_prime)
    mask1 = np.abs(h2_prime - h1_prime) <= 180
    mask2 = (h2_prime - h1_prime) > 180
    mask3 = (h2_prime - h1_prime) < -180

    delta_h_prime[mask1] = h2_prime[mask1] - h1_prime[mask1]
    delta_h_prime[mask2] = h2_prime[mask2] - h1_prime[mask2] - 360
    delta_h_prime[mask3] = h2_prime[mask3] - h1_prime[mask3] + 360

    # Delta H'
    delta_H_prime = 2 * np.sqrt(C1_prime * C2_prime) * np.sin(np.radians(delta_h_prime / 2))

    # Moyennes
    L_avg = (L1 + L2) / 2
    C_avg_prime = (C1_prime + C2_prime) / 2

    # h_avg'
    h_avg_prime = np.zeros_like(h1_prime)
    mask_sum = np.abs(h1_prime - h2_prime) <= 180
    h_avg_prime[mask_sum] = (h1_prime[mask_sum] + h2_prime[mask_sum]) / 2
    h_avg_prime[~mask_sum] = (h1_prime[~mask_sum] + h2_prime[~mask_sum] + 360) / 2

    # T
    T = (1 - 0.17 * np.cos(np.radians(h_avg_prime - 30)) +
         0.24 * np.cos(np.radians(2 * h_avg_prime)) +
         0.32 * np.cos(np.radians(3 * h_avg_prime + 6)) -
         0.20 * np.cos(np.radians(4 * h_avg_prime - 63)))

    # SL, SC, SH
    SL = 1 + (0.015 * (L_avg - 50)**2) / np.sqrt(20 + (L_avg - 50)**2)
    SC = 1 + 0.045 * C_avg_prime
    SH = 1 + 0.015 * C_avg_prime * T

    # RT
    delta_theta = 30 * np.exp(-((h_avg_prime - 275) / 25)**2)
    RC = 2 * np.sqrt(C_avg_prime**7 / (C_avg_prime**7 + 25**7))
    RT = -RC * np.sin(np.radians(2 * delta_theta))

    # Delta E 2000
    delta_E = np.sqrt(
        (delta_L_prime / (kL * SL))**2 +
        (delta_C_prime / (kC * SC))**2 +
        (delta_H_prime / (kH * SH))**2 +
        RT * (delta_C_prime / (kC * SC)) * (delta_H_prime / (kH * SH))
    )

    return delta_E


def filter_perceptual_duplicates_adaptive(rgb_colors, lab_colors, batch_size=50000):
    """
    Filtre les doublons perceptuels avec des seuils adaptatifs.
    Utilise une grille LAB pour accélérer la recherche de voisins.
    """
    n = len(rgb_colors)
    print(f"\nFiltrage perceptuel adaptatif de {n:,} couleurs...")

    # Calculer le chroma pour chaque couleur
    L = lab_colors[:, 0]
    a = lab_colors[:, 1]
    b = lab_colors[:, 2]
    C = np.sqrt(a**2 + b**2)

    # Classifier chaque couleur
    print("Classification des régions colorimétriques...")
    regions = np.array([classify_color_region(L[i], C[i]) for i in range(n)])

    # Statistiques par région
    region_counts = defaultdict(int)
    for r in regions:
        region_counts[r] += 1
    print("Distribution par région:")
    for region, count in sorted(region_counts.items()):
        threshold = DELTA_E_THRESHOLDS[region]
        print(f"  {region:15s}: {count:>10,} couleurs (ΔE seuil: {threshold})")

    # Créer une grille 3D pour accélérer la recherche
    # Taille de cellule basée sur le plus petit seuil
    min_threshold = min(DELTA_E_THRESHOLDS.values())
    cell_size = min_threshold * 2  # En unités LAB

    print(f"\nCréation de la grille spatiale (cellule: {cell_size:.1f} LAB)...")

    # Normaliser LAB pour la grille
    L_min, L_max = 0, 100
    ab_min, ab_max = -128, 128

    grid = defaultdict(list)
    for i in range(n):
        # Calculer les indices de grille
        gl = int((L[i] - L_min) / cell_size)
        ga = int((a[i] - ab_min) / cell_size)
        gb = int((b[i] - ab_min) / cell_size)
        grid[(gl, ga, gb)].append(i)

    print(f"  → {len(grid):,} cellules occupées")

    # Marquer les couleurs à garder
    keep = np.ones(n, dtype=bool)

    print("Élimination des doublons perceptuels...")
    processed = 0
    removed = 0

    # Trier par luminosité pour traiter les couleurs claires en premier (plus sensibles)
    sorted_indices = np.argsort(-L)  # Du plus clair au plus sombre

    for idx in sorted_indices:
        if not keep[idx]:
            continue

        i = idx
        region = regions[i]
        threshold = DELTA_E_THRESHOLDS[region]

        # Cellule de cette couleur
        gl = int((L[i] - L_min) / cell_size)
        ga = int((a[i] - ab_min) / cell_size)
        gb = int((b[i] - ab_min) / cell_size)

        # Vérifier les cellules voisines
        neighbors = []
        for dl in range(-2, 3):
            for da in range(-2, 3):
                for db in range(-2, 3):
                    cell_key = (gl + dl, ga + da, gb + db)
                    if cell_key in grid:
                        neighbors.extend(grid[cell_key])

        # Filtrer les voisins trop proches
        if len(neighbors) > 1:
            neighbors = np.array([j for j in neighbors if j != i and keep[j]])

            if len(neighbors) > 0:
                # Calculer Delta E 2000 avec tous les voisins
                lab_i = lab_colors[i:i+1]
                lab_neighbors = lab_colors[neighbors]

                # Répéter lab_i pour le calcul vectorisé
                lab_i_repeated = np.repeat(lab_i, len(neighbors), axis=0)

                delta_e = delta_e_2000_vectorized(lab_i_repeated, lab_neighbors)

                # Marquer les voisins trop proches comme doublons
                for j, de in zip(neighbors, delta_e):
                    if de < threshold and keep[j]:
                        # Garder la couleur la plus claire (i est traitée en premier si plus claire)
                        keep[j] = False
                        removed += 1

        processed += 1
        if processed % 100000 == 0:
            kept = np.sum(keep)
            print(f"  Traité: {processed:,}/{n:,} | Gardées: {kept:,} | Supprimées: {removed:,}")

    kept_count = np.sum(keep)
    print(f"\n  → {kept_count:,} couleurs conservées ({removed:,} doublons supprimés)")

    return rgb_colors[keep], lab_colors[keep]


def check_gamut(rgb_colors, srgb_profile, printer_profile, tolerance=2):
    """Vérifie quelles couleurs sont dans le gamut de l'imprimante"""
    n = len(rgb_colors)
    print(f"\nVérification du gamut Epson P9000...")

    transform_to_printer = ImageCms.buildTransform(
        srgb_profile, printer_profile, "RGB", "RGB",
        renderingIntent=ImageCms.Intent.RELATIVE_COLORIMETRIC
    )
    transform_to_srgb = ImageCms.buildTransform(
        printer_profile, srgb_profile, "RGB", "RGB",
        renderingIntent=ImageCms.Intent.RELATIVE_COLORIMETRIC
    )

    in_gamut_mask = np.zeros(n, dtype=bool)
    batch_size = 10000

    for start in range(0, n, batch_size):
        end = min(start + batch_size, n)
        batch = rgb_colors[start:end]

        img = Image.new('RGB', (len(batch), 1))
        img.putdata([tuple(c) for c in batch])

        img_printer = ImageCms.applyTransform(img, transform_to_printer)
        img_back = ImageCms.applyTransform(img_printer, transform_to_srgb)

        original = np.array(list(img.getdata()), dtype=np.int16)
        roundtrip = np.array(list(img_back.getdata()), dtype=np.int16)

        max_diff = np.max(np.abs(original - roundtrip), axis=1)
        in_gamut_mask[start:end] = max_diff <= tolerance

        if (end % 100000 == 0) or end == n:
            in_gamut = np.sum(in_gamut_mask[:end])
            print(f"  {end:,}/{n:,} | In gamut: {in_gamut:,} ({in_gamut/end*100:.1f}%)")

    return in_gamut_mask


def save_colors(colors, file_path):
    """Sauvegarde les couleurs"""
    print(f"\nSauvegarde de {len(colors):,} couleurs dans {file_path}...")
    with open(file_path, 'w') as f:
        f.write("# R, G, B\n")
        for r, g, b in colors:
            f.write(f"{r}, {g}, {b}\n")
    print(f"  → Fichier sauvegardé ({os.path.getsize(file_path) / 1024 / 1024:.1f} MB)")


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))

    input_path = os.path.join(script_dir, INPUT_FILE)
    output_path = os.path.join(script_dir, OUTPUT_FILE)
    icc_path = os.path.join(script_dir, ICC_PROFILE)

    if not os.path.exists(icc_path):
        print(f"ERREUR: Profil ICC non trouvé: {icc_path}")
        sys.exit(1)

    # Charger
    rgb_colors = load_colors(input_path)
    initial_count = len(rgb_colors)

    # Convertir en LAB
    print("\n" + "="*60)
    print("ÉTAPE 1: Conversion en espace CIELAB")
    print("="*60)
    lab_colors = rgb_to_lab_batch(rgb_colors)

    # Filtrage gamut d'abord (plus rapide)
    print("\n" + "="*60)
    print("ÉTAPE 2: Filtrage gamut Epson P9000")
    print("="*60)

    srgb_profile = ImageCms.createProfile('sRGB')
    printer_profile = ImageCms.getOpenProfile(icc_path)

    in_gamut_mask = check_gamut(rgb_colors, srgb_profile, printer_profile)

    rgb_gamut = rgb_colors[in_gamut_mask]
    lab_gamut = lab_colors[in_gamut_mask]

    print(f"  → {len(rgb_gamut):,} couleurs dans le gamut")

    # Filtrage perceptuel adaptatif
    print("\n" + "="*60)
    print("ÉTAPE 3: Filtrage perceptuel adaptatif (Delta E 2000)")
    print("="*60)
    print("Seuils Delta E par région:")
    for region, threshold in DELTA_E_THRESHOLDS.items():
        print(f"  {region:15s}: ΔE < {threshold}")

    rgb_final, lab_final = filter_perceptual_duplicates_adaptive(rgb_gamut, lab_gamut)

    # Résumé
    print("\n" + "="*60)
    print("RÉSUMÉ")
    print("="*60)
    print(f"Couleurs initiales:        {initial_count:>12,}")
    print(f"Après filtrage gamut:      {len(rgb_gamut):>12,} (-{initial_count - len(rgb_gamut):,})")
    print(f"Après filtrage perceptuel: {len(rgb_final):>12,} (-{len(rgb_gamut) - len(rgb_final):,})")
    print(f"Réduction totale:          {(1 - len(rgb_final)/initial_count)*100:>11.1f}%")

    # Sauvegarder
    save_colors(rgb_final, output_path)

    print("\n✓ Terminé!")
    print(f"  Fichier: {OUTPUT_FILE}")
    print(f"  Toutes les couleurs sont:")
    print(f"    - Imprimables sur Epson P9000")
    print(f"    - Perceptuellement distinctes (Delta E 2000 adaptatif)")


if __name__ == "__main__":
    main()
