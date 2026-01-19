#!/usr/bin/env python3
"""
Génère les images WebP HD pour l'animation dezoom des monochromes.
Utilise le même format que vert_hq.webp.
"""

from PIL import Image
import os

# Configuration
INPUT_DIR = "/home/arthurc/dev/projects/ColorPaps/public/generated"
OUTPUT_DIR = INPUT_DIR

# Images sources pour chaque couleur (fichiers HQ existants)
MONO_IMAGES = {
    'bleu': '191864_palette_crop_bleu_HQ.png',
    'rouge': '85728_palette_crop_rouge_HQ.png',
    'jaune': '74268_palette_crop_jaune_HQ.png',
    'orange': '110010_palette_crop_orange_HQ.png',
    'marron': '6315_palette_crop_marron_HQ.png',
    'gris': '39659_palette_crop_gris_HQ.png',
    'violet': '189159_palette_crop_violet_HQ.png',
}

# Qualité WebP (ajuster selon la taille souhaitée)
WEBP_QUALITY = 85

def convert_to_webp(color: str, filename: str):
    """Convertit une image PNG en WebP HD."""
    input_path = os.path.join(INPUT_DIR, filename)
    output_path = os.path.join(OUTPUT_DIR, f"{color}_hq.webp")

    if not os.path.exists(input_path):
        print(f"ERREUR: {input_path} n'existe pas")
        return False

    print(f"\nTraitement de {color}...")
    print(f"  Source: {filename}")

    # Charger l'image
    img = Image.open(input_path)
    print(f"  Dimensions: {img.size[0]}x{img.size[1]}")

    # Convertir en RGB si nécessaire (WebP ne supporte pas tous les modes)
    if img.mode in ('RGBA', 'P'):
        img = img.convert('RGB')

    # Sauvegarder en WebP
    img.save(output_path, 'WEBP', quality=WEBP_QUALITY, method=6)

    # Afficher les stats
    input_size = os.path.getsize(input_path) / (1024 * 1024)
    output_size = os.path.getsize(output_path) / (1024 * 1024)
    reduction = ((input_size - output_size) / input_size) * 100

    print(f"  PNG original: {input_size:.2f} MB")
    print(f"  WebP généré: {output_size:.2f} MB")
    print(f"  Réduction: {reduction:.1f}%")
    print(f"  Sauvegardé: {output_path}")

    return True

def main():
    print("=" * 60)
    print("Génération des images WebP HD pour Monochromes")
    print("=" * 60)

    success_count = 0
    for color, filename in MONO_IMAGES.items():
        if convert_to_webp(color, filename):
            success_count += 1

    print("\n" + "=" * 60)
    print(f"Terminé: {success_count}/{len(MONO_IMAGES)} images générées")
    print("=" * 60)

if __name__ == "__main__":
    main()
