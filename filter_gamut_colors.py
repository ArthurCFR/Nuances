#!/usr/bin/env python3
"""
Filtre la base de couleurs pour ne garder que les couleurs :
1. Dans le gamut de l'Epson SC-P9000 (imprimables sans clipping)
2. Perceptuellement distinctes (pas de doublons après conversion)

Utilise un profil ICC Epson P9000 pour vérifier le gamut.
"""

import numpy as np
from PIL import Image, ImageCms
import os
import sys
from io import BytesIO

# Configuration
INPUT_FILE = "COULEURS_EPSON_UNIQUE_1.6M.txt"
OUTPUT_FILE = "COULEURS_EPSON_P9000_GAMUT.txt"

# Profil ICC pour l'Epson P9000 (papier mat fine art - gamut représentatif)
ICC_PROFILE = "icc_profiles/2023 Epson SureColor P9000 MOAB Profiles/MOAB Entrada Rag Bright P9000 USFA.icc"


def load_colors(file_path):
    """Charge le fichier de couleurs"""
    print(f"Chargement de {file_path}...")
    colors = np.loadtxt(file_path, delimiter=',', skiprows=1, dtype=np.uint8)
    print(f"  → {len(colors):,} couleurs chargées")
    return colors


def check_gamut_batch(rgb_colors, srgb_profile, printer_profile, batch_size=10000):
    """
    Vérifie quelles couleurs sont dans le gamut de l'imprimante.

    Méthode : On convertit sRGB → Printer → sRGB (round-trip)
    Si la couleur change significativement, elle était hors gamut.
    """
    n = len(rgb_colors)
    in_gamut_mask = np.zeros(n, dtype=bool)

    # Créer le transform sRGB → Printer (avec rendu colorimétrique relatif)
    transform_to_printer = ImageCms.buildTransform(
        srgb_profile, printer_profile,
        "RGB", "RGB",
        renderingIntent=ImageCms.Intent.RELATIVE_COLORIMETRIC
    )

    # Créer le transform Printer → sRGB
    transform_to_srgb = ImageCms.buildTransform(
        printer_profile, srgb_profile,
        "RGB", "RGB",
        renderingIntent=ImageCms.Intent.RELATIVE_COLORIMETRIC
    )

    print(f"Vérification du gamut par lots de {batch_size}...")

    for start in range(0, n, batch_size):
        end = min(start + batch_size, n)
        batch = rgb_colors[start:end]

        # Créer une image 1D avec les couleurs du batch
        img = Image.new('RGB', (len(batch), 1))
        img.putdata([tuple(c) for c in batch])

        # Round-trip: sRGB → Printer → sRGB
        img_printer = ImageCms.applyTransform(img, transform_to_printer)
        img_back = ImageCms.applyTransform(img_printer, transform_to_srgb)

        # Comparer original et round-trip
        original = np.array(list(img.getdata()), dtype=np.int16)
        roundtrip = np.array(list(img_back.getdata()), dtype=np.int16)

        # Calculer la différence (Delta RGB)
        diff = np.abs(original - roundtrip)
        max_diff = np.max(diff, axis=1)

        # Couleur dans le gamut si le round-trip change de moins de 2 unités RGB
        # (tolérance pour les erreurs d'arrondi)
        in_gamut_mask[start:end] = max_diff <= 2

        # Progression
        progress = (end / n) * 100
        in_gamut_count = np.sum(in_gamut_mask[:end])
        if (end % (batch_size * 10) == 0) or end == n:
            print(f"  {progress:5.1f}% | {end:,}/{n:,} | In gamut: {in_gamut_count:,} ({in_gamut_count/end*100:.1f}%)")

    return in_gamut_mask


def remove_perceptual_duplicates(rgb_colors, threshold=2):
    """
    Supprime les doublons perceptuels en utilisant une réduction.
    Deux couleurs sont considérées identiques si elles arrondissent au même point
    sur une grille de pas `threshold`.
    """
    print(f"Suppression des doublons perceptuels (seuil={threshold})...")

    # Réduire les couleurs à une grille
    reduced = (rgb_colors // threshold) * threshold

    # Trouver les indices uniques
    _, unique_indices = np.unique(reduced, axis=0, return_index=True)

    # Trier pour garder l'ordre original
    unique_indices = np.sort(unique_indices)

    unique_colors = rgb_colors[unique_indices]
    print(f"  → {len(unique_colors):,} couleurs uniques (supprimé {len(rgb_colors) - len(unique_colors):,} doublons)")

    return unique_colors


def analyze_gamut_distribution(rgb_colors, in_gamut_mask):
    """Analyse la distribution des couleurs in/out gamut par région HSV"""
    from colorsys import rgb_to_hsv

    print("\nAnalyse de la distribution gamut:")

    in_gamut = rgb_colors[in_gamut_mask]
    out_gamut = rgb_colors[~in_gamut_mask]

    if len(out_gamut) == 0:
        print("  Toutes les couleurs sont dans le gamut!")
        return

    # Convertir en HSV pour analyser
    def get_hsv_stats(colors, name):
        if len(colors) == 0:
            return
        hsv = np.array([rgb_to_hsv(r/255, g/255, b/255) for r, g, b in colors[:10000]])  # Échantillon
        h, s, v = hsv[:, 0], hsv[:, 1], hsv[:, 2]
        print(f"  {name}:")
        print(f"    Hue moyenne: {np.mean(h):.3f} (0=rouge, 0.33=vert, 0.66=bleu)")
        print(f"    Saturation moyenne: {np.mean(s):.3f}")
        print(f"    Luminosité moyenne: {np.mean(v):.3f}")

    get_hsv_stats(out_gamut, "Hors gamut")
    get_hsv_stats(in_gamut, "Dans gamut")


def save_colors(colors, file_path):
    """Sauvegarde les couleurs dans un fichier"""
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

    # Vérifier que le profil ICC existe
    if not os.path.exists(icc_path):
        print(f"ERREUR: Profil ICC non trouvé: {icc_path}")
        print("Téléchargez d'abord les profils ICC Epson P9000")
        sys.exit(1)

    # Charger les couleurs
    all_colors = load_colors(input_path)
    initial_count = len(all_colors)

    # Étape 1: Supprimer les doublons perceptuels grossiers
    print("\n" + "="*60)
    print("ÉTAPE 1: Suppression des doublons perceptuels")
    print("="*60)
    unique_colors = remove_perceptual_duplicates(all_colors, threshold=2)

    # Étape 2: Vérifier le gamut
    print("\n" + "="*60)
    print("ÉTAPE 2: Vérification du gamut Epson P9000")
    print("="*60)
    print(f"Profil ICC: {os.path.basename(icc_path)}")

    # Charger les profils ICC
    srgb_profile = ImageCms.createProfile('sRGB')
    printer_profile = ImageCms.getOpenProfile(icc_path)

    # Vérifier le gamut
    in_gamut_mask = check_gamut_batch(unique_colors, srgb_profile, printer_profile)

    # Analyser la distribution
    analyze_gamut_distribution(unique_colors, in_gamut_mask)

    # Filtrer les couleurs hors gamut
    gamut_colors = unique_colors[in_gamut_mask]

    # Étape 3: Suppression finale des doublons après conversion
    print("\n" + "="*60)
    print("ÉTAPE 3: Vérification finale des doublons")
    print("="*60)
    final_colors = remove_perceptual_duplicates(gamut_colors, threshold=2)

    # Résumé
    print("\n" + "="*60)
    print("RÉSUMÉ")
    print("="*60)
    print(f"Couleurs initiales:        {initial_count:>12,}")
    print(f"Après dédoublonnage:       {len(unique_colors):>12,} (-{initial_count - len(unique_colors):,})")
    print(f"Après filtrage gamut:      {len(gamut_colors):>12,} (-{len(unique_colors) - len(gamut_colors):,})")
    print(f"Couleurs finales:          {len(final_colors):>12,}")
    print(f"Réduction totale:          {(1 - len(final_colors)/initial_count)*100:>11.1f}%")

    # Sauvegarder
    save_colors(final_colors, output_path)

    print("\n✓ Terminé! Nouveau fichier de couleurs prêt.")
    print(f"  Utilisez '{OUTPUT_FILE}' dans vos scripts.")


if __name__ == "__main__":
    main()
