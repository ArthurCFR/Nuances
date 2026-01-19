'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

// Composant pour souligner le S
const UnderlineS = ({ children }: { children: string }) => {
  const parts = children.split(/(s)/gi);
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === 's' ? (
          <span key={i} className="underline-s">{part}</span>
        ) : (
          part
        )
      )}
    </>
  );
};

type ColorKey = 'bleu' | 'rouge' | 'vert' | 'jaune' | 'orange' | 'marron' | 'gris' | 'violet';
type TabKey = 'monochromes' | 'monochromesbis' | 'rencontres' | 'rencontrescrop' | 'spectrum' | 'galerie';
type InfoPage = 'demarche' | 'methode' | 'artiste' | null;

interface GenerationResult {
  success: boolean;
  color?: string;
  count: number;
  preview: string;
  full: string;
  stats?: Record<string, number>;
  error?: string;
}

interface PaletteResult {
  success: boolean;
  count: number;
  total_available: number;
  colors: string[];
  preview: string;
  full?: string;
}

const COLORS: { key: ColorKey; hex: string; label: string }[] = [
  { key: 'bleu', hex: '#3d5a80', label: 'Bleu' },
  { key: 'rouge', hex: '#9b2226', label: 'Rouge' },
  { key: 'vert', hex: '#386641', label: 'Vert' },
  { key: 'jaune', hex: '#e9c46a', label: 'Jaune' },
  { key: 'orange', hex: '#bc6c25', label: 'Orange' },
  { key: 'marron', hex: '#6c584c', label: 'Marron' },
  { key: 'gris', hex: '#6b705c', label: 'Gris' },
  { key: 'violet', hex: '#7b2d8e', label: 'Violet' },
];

const TINTS: Record<ColorKey, string> = {
  bleu: '#e8eff5',
  rouge: '#f5e8e8',
  vert: '#e8f2ea',
  jaune: '#f7f2e8',
  orange: '#f5ede5',
  marron: '#f0ebe8',
  gris: '#eeefec',
  violet: '#f2e8f5',
};

// Données pré-générées pour chaque couleur (images crop)
const COLOR_DATA: Record<ColorKey, { count: number; preview: string; full: string } | null> = {
  bleu: { count: 191864, preview: '/generated/palette_crop_bleu_preview.png', full: '/generated/191864_palette_crop_bleu_HQ.png' },
  rouge: { count: 85728, preview: '/generated/palette_crop_rouge_preview.png', full: '/generated/85728_palette_crop_rouge_HQ.png' },
  vert: { count: 275536, preview: '/generated/palette_crop_vert_preview.png', full: '/generated/275536_palette_crop_vert_HQ.png' },
  jaune: { count: 74268, preview: '/generated/palette_crop_jaune_preview.png', full: '/generated/74268_palette_crop_jaune_HQ.png' },
  orange: { count: 110010, preview: '/generated/palette_crop_orange_preview.png', full: '/generated/110010_palette_crop_orange_HQ.png' },
  marron: { count: 6315, preview: '/generated/palette_crop_marron_preview.png', full: '/generated/6315_palette_crop_marron_HQ.png' },
  gris: { count: 39659, preview: '/generated/palette_crop_gris_preview.png', full: '/generated/39659_palette_crop_gris_HQ.png' },
  violet: { count: 189159, preview: '/generated/palette_crop_violet_preview.png', full: '/generated/189159_palette_crop_violet_HQ.png' },
};

// Labels pluriels pour l'affichage du titre
const COLOR_LABELS_PLURAL: Record<ColorKey, string> = {
  bleu: 'bleus',
  rouge: 'rouges',
  vert: 'verts',
  jaune: 'jaunes',
  orange: 'oranges',
  marron: 'marrons',
  gris: 'gris',
  violet: 'violets',
};

// Noms de couleurs pour le nuage de mots (8-12 par nuance)
const COLOR_NAMES: Record<ColorKey, { name: string; hex: string }[]> = {
  bleu: [
    { name: 'Céruléen', hex: '#007BA7' },
    { name: 'Cobalt', hex: '#0047AB' },
    { name: 'Saphir', hex: '#0F52BA' },
    { name: 'Azur', hex: '#007FFF' },
    { name: 'Indigo', hex: '#4B0082' },
    { name: 'Cyan', hex: '#00FFFF' },
    { name: 'Turquoise', hex: '#40E0D0' },
    { name: 'Marine', hex: '#000080' },
    { name: 'Pétrole', hex: '#1D4E5F' },
    { name: 'Glacier', hex: '#78A8C4' },
  ],
  rouge: [
    { name: 'Carmin', hex: '#960018' },
    { name: 'Vermillon', hex: '#E34234' },
    { name: 'Cramoisi', hex: '#DC143C' },
    { name: 'Grenat', hex: '#6C3461' },
    { name: 'Rubis', hex: '#E0115F' },
    { name: 'Bordeaux', hex: '#6D071A' },
    { name: 'Corail', hex: '#FF7F50' },
    { name: 'Cerise', hex: '#DE3163' },
    { name: 'Pourpre', hex: '#9D0208' },
    { name: 'Framboise', hex: '#C72C48' },
  ],
  vert: [
    { name: 'Émeraude', hex: '#50C878' },
    { name: 'Jade', hex: '#00A86B' },
    { name: 'Olive', hex: '#808000' },
    { name: 'Sapin', hex: '#095228' },
    { name: 'Menthe', hex: '#98FF98' },
    { name: 'Sauge', hex: '#9DC183' },
    { name: 'Chartreuse', hex: '#7FFF00' },
    { name: 'Céladon', hex: '#ACE1AF' },
    { name: 'Malachite', hex: '#0BDA51' },
    { name: 'Tilleul', hex: '#A5D152' },
  ],
  jaune: [
    { name: 'Citron', hex: '#FFF44F' },
    { name: 'Safran', hex: '#F4C430' },
    { name: 'Canari', hex: '#FFEF00' },
    { name: 'Miel', hex: '#EB9605' },
    { name: 'Paille', hex: '#E7D798' },
    { name: 'Ambre', hex: '#FFBF00' },
    { name: 'Bouton d\'or', hex: '#FCDC12' },
    { name: 'Maïs', hex: '#FFDE75' },
    { name: 'Mimosa', hex: '#FEF86C' },
    { name: 'Ocre jaune', hex: '#DFAF2C' },
  ],
  orange: [
    { name: 'Mandarine', hex: '#FF8C00' },
    { name: 'Abricot', hex: '#E9967A' },
    { name: 'Tangerine', hex: '#FF9966' },
    { name: 'Citrouille', hex: '#FF7518' },
    { name: 'Cuivre', hex: '#B87333' },
    { name: 'Carotte', hex: '#ED9121' },
    { name: 'Rouille', hex: '#B7410E' },
    { name: 'Pêche', hex: '#FFCBA4' },
    { name: 'Papaye', hex: '#FF6347' },
    { name: 'Terre cuite', hex: '#C2452D' },
  ],
  marron: [
    { name: 'Chocolat', hex: '#7B3F00' },
    { name: 'Noisette', hex: '#955628' },
    { name: 'Châtaigne', hex: '#7B3F00' },
    { name: 'Café', hex: '#4B3621' },
    { name: 'Caramel', hex: '#FFD59A' },
    { name: 'Brique', hex: '#CB4154' },
    { name: 'Acajou', hex: '#88421D' },
    { name: 'Cannelle', hex: '#D2691E' },
    { name: 'Sépia', hex: '#704214' },
    { name: 'Havane', hex: '#8B4513' },
  ],
  gris: [
    { name: 'Anthracite', hex: '#293133' },
    { name: 'Ardoise', hex: '#708090' },
    { name: 'Perle', hex: '#CECECE' },
    { name: 'Acier', hex: '#71797E' },
    { name: 'Fumée', hex: '#848884' },
    { name: 'Cendre', hex: '#8E8E8E' },
    { name: 'Plomb', hex: '#6E6E6E' },
    { name: 'Argent', hex: '#C0C0C0' },
    { name: 'Graphite', hex: '#383838' },
    { name: 'Étain', hex: '#A8A9AD' },
  ],
  violet: [
    { name: 'Améthyste', hex: '#9966CC' },
    { name: 'Lavande', hex: '#E6E6FA' },
    { name: 'Mauve', hex: '#E0B0FF' },
    { name: 'Lilas', hex: '#C8A2C8' },
    { name: 'Prune', hex: '#811453' },
    { name: 'Aubergine', hex: '#614051' },
    { name: 'Orchidée', hex: '#DA70D6' },
    { name: 'Parme', hex: '#CFA0E9' },
    { name: 'Magenta', hex: '#FF00FF' },
    { name: 'Fuchsia', hex: '#FF77FF' },
  ],
};

const SPECTRUM_BG = '#f0f2f5';
const PALETTE_BG = '#f5f0f5';

// Spectrum pré-généré (fichier statique)
const SPECTRUM_PREGENERATED: GenerationResult = {
  success: true,
  count: 1185512,
  preview: '/generated/spectrum_preview.png',
  full: '/generated/1185512_Spectrum_ColorPaps_HQ.png',
  stats: {
    vert: 340434,
    violet: 265085,
    bleu: 252197,
    orange: 113835,
    rouge: 91532,
    jaune: 82036,
    gris: 34264,
    marron: 6129,
  },
};

export default function Home() {
  // Splash screen state
  const [isLoading, setIsLoading] = useState(true);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabKey>('monochromes');

  // Info page state
  const [infoPage, setInfoPage] = useState<InfoPage>(null);

  // Couleurs tab state
  const [selectedColor, setSelectedColor] = useState<ColorKey>('bleu');

  // Modal HD state
  const [hdModalOpen, setHdModalOpen] = useState(false);
  const [hdModalImage, setHdModalImage] = useState<string | null>(null);
  const [hdModalTitle, setHdModalTitle] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imagePos, setImagePos] = useState({ x: 0, y: 0 });
  const [imageScale, setImageScale] = useState(1);
  const modalWrapperRef = useRef<HTMLDivElement>(null);

  // Palette tab state
  const [selectedPaletteColors, setSelectedPaletteColors] = useState<Set<ColorKey>>(new Set());
  const [isPaletteGenerating, setIsPaletteGenerating] = useState(false);
  const [isPaletteRevealing, setIsPaletteRevealing] = useState(false);
  const [palettePreview, setPalettePreview] = useState<string | null>(null);
  const [paletteCount, setPaletteCount] = useState<number>(0);
  const [paletteResult, setPaletteResult] = useState<GenerationResult | null>(null);
  const [paletteError, setPaletteError] = useState<string | null>(null);
  const [revealProgress, setRevealProgress] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const dotsRef = useRef<{ x: number; y: number }[]>([]);

  // Rencontres Crop state
  const [selectedCropColors, setSelectedCropColors] = useState<Set<ColorKey>>(new Set());
  const [isCropGenerating, setIsCropGenerating] = useState(false);
  const [isCropRevealing, setIsCropRevealing] = useState(false);
  const [cropPreview, setCropPreview] = useState<string | null>(null);
  const [cropCount, setCropCount] = useState<number>(0);
  const [cropResult, setCropResult] = useState<GenerationResult | null>(null);
  const [cropError, setCropError] = useState<string | null>(null);
  const [cropRevealProgress, setCropRevealProgress] = useState<number>(0);

  const canvasCropRef = useRef<HTMLCanvasElement>(null);
  const animationCropRef = useRef<number | null>(null);
  const dotsCropRef = useRef<{ x: number; y: number }[]>([]);

  // Monochromes bis state
  const [bisZoomScale, setBisZoomScale] = useState(25); // Commence au zoom max
  const [bisAnimationStarted, setBisAnimationStarted] = useState(false);
  const [bisImageLoaded, setBisImageLoaded] = useState(false);
  const bisAnimationRef = useRef<number | null>(null);
  const bisTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Monochromes animation state
  const [monoAnimationStarted, setMonoAnimationStarted] = useState(false);
  const [monoKey, setMonoKey] = useState(0); // Force le remontage complet au changement de couleur
  const [monoImageLoaded, setMonoImageLoaded] = useState(false);
  const [monoDisplayCount, setMonoDisplayCount] = useState(0);
  const [monoPrefix, setMonoPrefix] = useState(''); // "Les " apparaît lettre par lettre
  const [showWordCloud, setShowWordCloud] = useState(true); // Mots du nuage visibles
  const [showWordCloudDots, setShowWordCloudDots] = useState(true); // Pixels du nuage visibles
  const [wordCloudStarted, setWordCloudStarted] = useState(false); // Animation du nuage démarrée (après délai initial)
  const [wordCloudReady, setWordCloudReady] = useState(false); // Animation du nuage terminée
  const [showHdImage, setShowHdImage] = useState(false); // Image HD visible (après fade out des mots)
  const monoAnimationRef = useRef<number | null>(null);
  const monoWordCloudTimerRef = useRef<NodeJS.Timeout | null>(null);
  const monoRevealTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const monoDezoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [previousColor, setPreviousColor] = useState<ColorKey | null>(null);
  // Couleurs déjà animées pendant cette session (reset au rechargement de la page)
  const [animatedColors, setAnimatedColors] = useState<Set<ColorKey>>(new Set());

  // Toggle Nuages/Brumes pour Rencontres
  const [rencontresMode, setRencontresMode] = useState<'nuages' | 'brumes'>('nuages');

  const openHdModal = (imagePath: string, title: string) => {
    setHdModalImage(imagePath);
    setHdModalTitle(title);
    setImagePos({ x: 0, y: 0 });
    setImageScale(1);
    setHdModalOpen(true);
  };

  const closeHdModal = () => {
    setHdModalOpen(false);
    setHdModalImage(null);
    setHdModalTitle('');
    setImageScale(1);
    setImagePos({ x: 0, y: 0 });
  };

  // Drag handlers pour le modal
  const handleMouseDown = (e: React.MouseEvent) => {
    if (imageScale <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - imagePos.x, y: e.clientY - imagePos.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    setImagePos({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const container = modalWrapperRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(imageScale * delta, 1), 25);

    // Zoom vers le curseur
    const scaleChange = newScale / imageScale;
    const newX = mouseX - (mouseX - imagePos.x) * scaleChange;
    const newY = mouseY - (mouseY - imagePos.y) * scaleChange;

    setImageScale(newScale);
    setImagePos({ x: newX, y: newY });
  };

  // Fermer le modal/pages avec Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (hdModalOpen) closeHdModal();
        if (infoPage) setInfoPage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hdModalOpen, infoPage]);

  // Bloquer le scroll de la page quand le modal HD ou une page info est ouverte
  useEffect(() => {
    if (hdModalOpen || infoPage) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [hdModalOpen, infoPage]);

  // Précharger les images et gérer le splash screen
  useEffect(() => {
    let bleuLoaded = false;
    let minTimeElapsed = false;

    const checkReady = () => {
      if (bleuLoaded && minTimeElapsed) {
        setIsLoading(false);
      }
    };

    // Charger l'image bleue en priorité (première affichée)
    const bleuImg = new Image();
    bleuImg.onload = () => {
      bleuLoaded = true;
      checkReady();
    };
    bleuImg.src = '/generated/bleu_hq.webp';

    // Précharger les autres en arrière-plan
    COLORS.filter(c => c.key !== 'bleu').forEach(({ key }) => {
      const img = new Image();
      img.src = `/generated/${key}_hq.webp`;
    });

    // Minimum 2 secondes de splash
    setTimeout(() => {
      minTimeElapsed = true;
      checkReady();
    }, 2000);
  }, []);

  // Animation dezoom pour Monochromes bis
  const startBisAnimation = useCallback(() => {
    const startTime = Date.now();
    const duration = 4000; // 4 secondes pour le dezoom
    const startScale = 25;
    const endScale = 1;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing out cubic pour un dezoom fluide
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentScale = startScale - (startScale - endScale) * easeOut;

      setBisZoomScale(currentScale);

      if (progress < 1) {
        bisAnimationRef.current = requestAnimationFrame(animate);
      }
    };

    bisAnimationRef.current = requestAnimationFrame(animate);
  }, []);

  // Animation compteur pour Monochromes (le dezoom est en CSS)
  const startMonoAnimation = useCallback((targetCount: number, startCount: number = 0, colorToAnimate: ColorKey) => {
    const startTime = Date.now();
    const duration = 4000;
    let lastUpdateTime = 0;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Throttle: mise à jour max 30fps au lieu de 60
      if (now - lastUpdateTime >= 33) {
        lastUpdateTime = now;
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const countProgress = startCount + (targetCount - startCount) * easeOut;
        setMonoDisplayCount(Math.floor(countProgress));
      }

      if (progress < 1) {
        monoAnimationRef.current = requestAnimationFrame(animate);
      } else {
        setMonoDisplayCount(targetCount);
        setShowWordCloudDots(false);
        setAnimatedColors(prev => new Set(prev).add(colorToAnimate));
      }
    };

    monoAnimationRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (activeTab === 'monochromesbis' && bisImageLoaded && !bisAnimationStarted) {
      // Attendre 2 secondes avant de commencer l'animation
      const timeout = setTimeout(() => {
        setBisAnimationStarted(true);
        startBisAnimation();
      }, 2000);

      return () => clearTimeout(timeout);
    }
  }, [activeTab, bisImageLoaded, bisAnimationStarted, startBisAnimation]);

  // Reset animation quand on quitte l'onglet monochromes bis
  useEffect(() => {
    if (activeTab !== 'monochromesbis') {
      if (bisAnimationRef.current) {
        cancelAnimationFrame(bisAnimationRef.current);
      }
      setBisZoomScale(25);
      setBisAnimationStarted(false);
      setBisImageLoaded(false);
    }
  }, [activeTab]);

  // Animation pour Monochromes - séquence:
  // 1. Nuage de mots pendant 6s
  // 2. Mots disparaissent (fade out 0.8s)
  // 3. Après fade out complet, image HD apparaît (fade in 1.5s)
  // 4. Après 0.8s supplémentaires, dezoom se lance
  // 5. Pixels dezooment avec l'image, disparaissent juste avant la fin
  useEffect(() => {
    const colorData = COLOR_DATA[selectedColor];
    const wordCount = COLOR_NAMES[selectedColor]?.length || 0;
    // L'image est toujours dans le DOM et a 6s pour charger pendant le nuage de mots
    // Ne pas animer si cette couleur a déjà été animée pendant cette session
    if (activeTab === 'monochromes' && wordCloudReady && !monoAnimationStarted && colorData && !animatedColors.has(selectedColor)) {
      // Étape 1: Cacher les mots (fade out rapide)
      setShowWordCloud(false);

      // Étape 2: Révéler l'image HD (fade in 0.6s)
      monoRevealTimeoutRef.current = setTimeout(() => {
        setShowHdImage(true);
      }, 400);

      // Étape 3: Lancer le dezoom après fade complet + 0.5s de pause
      // 400ms (attente) + 600ms (fade in) + 500ms (pause) = 1500ms
      monoDezoomTimeoutRef.current = setTimeout(() => {
        setMonoAnimationStarted(true);
        startMonoAnimation(colorData.count, wordCount, selectedColor);
      }, 1500);

      return () => {
        if (monoRevealTimeoutRef.current) clearTimeout(monoRevealTimeoutRef.current);
        if (monoDezoomTimeoutRef.current) clearTimeout(monoDezoomTimeoutRef.current);
      };
    }
  }, [activeTab, wordCloudReady, monoAnimationStarted, startMonoAnimation, selectedColor, animatedColors]);

  // Timer de 6 secondes pour le nuage de mots + compteur synchronisé avec rAF
  // Ne pas démarrer si la couleur a déjà été animée
  // Délai initial d'1 seconde pour laisser le temps au reset de se faire proprement
  useEffect(() => {
    if (activeTab === 'monochromes' && showWordCloud && !wordCloudReady && !animatedColors.has(selectedColor)) {
      const wordCount = COLOR_NAMES[selectedColor]?.length || 0;
      const wordInterval = 350; // ms entre chaque mot (plus rapide)
      const totalDuration = 4000; // durée totale du nuage (réduite)
      const initialDelay = 500; // délai initial réduit
      let startTime: number;
      let lastWordIndex = 0;
      let rafId: number;
      let delayTimeoutId: NodeJS.Timeout;

      const tick = (now: number) => {
        const elapsed = now - startTime;

        // Calculer quel mot devrait être affiché
        const currentWordIndex = Math.min(Math.floor(elapsed / wordInterval) + 1, wordCount);

        // Ne mettre à jour le state que si le mot a changé
        if (currentWordIndex !== lastWordIndex) {
          lastWordIndex = currentWordIndex;
          setMonoDisplayCount(currentWordIndex);
        }

        // Vérifier si le nuage est terminé
        if (elapsed >= totalDuration) {
          setWordCloudReady(true);
          return;
        }

        rafId = requestAnimationFrame(tick);
      };

      // Attendre 1 seconde avant de démarrer pour s'assurer que tout est bien reset
      delayTimeoutId = setTimeout(() => {
        setWordCloudStarted(true); // Maintenant on peut afficher les éléments
        startTime = performance.now();
        rafId = requestAnimationFrame(tick);
      }, initialDelay);

      return () => {
        clearTimeout(delayTimeoutId);
        cancelAnimationFrame(rafId);
      };
    }
  }, [activeTab, showWordCloud, wordCloudReady, selectedColor, animatedColors]);

  // Fonction pour annuler tous les timeouts monochromes
  const clearAllMonoTimeouts = useCallback(() => {
    if (monoAnimationRef.current) {
      cancelAnimationFrame(monoAnimationRef.current);
      monoAnimationRef.current = null;
    }
    if (monoWordCloudTimerRef.current) {
      clearTimeout(monoWordCloudTimerRef.current);
      monoWordCloudTimerRef.current = null;
    }
    if (monoRevealTimeoutRef.current) {
      clearTimeout(monoRevealTimeoutRef.current);
      monoRevealTimeoutRef.current = null;
    }
    if (monoDezoomTimeoutRef.current) {
      clearTimeout(monoDezoomTimeoutRef.current);
      monoDezoomTimeoutRef.current = null;
    }
  }, []);

  // Reset animation monochromes quand on change de couleur (pas au montage initial)
  useEffect(() => {
    // Ne pas exécuter au montage initial (previousColor est null)
    if (previousColor !== null && selectedColor !== previousColor) {
      // Annuler toutes les animations et timeouts en cours
      clearAllMonoTimeouts();

      const colorData = COLOR_DATA[selectedColor];

      // Si cette couleur a déjà été animée, aller directement à l'état final
      if (animatedColors.has(selectedColor) && colorData) {
        setShowWordCloud(false);
        setShowWordCloudDots(false);
        setWordCloudStarted(true);
        setWordCloudReady(true);
        setShowHdImage(true);
        setMonoAnimationStarted(true);
        setMonoImageLoaded(true);
        setMonoDisplayCount(colorData.count);
        setMonoPrefix('Les');
      } else {
        // Reset complet avec nouvelle clé pour forcer le remontage
        setMonoKey(k => k + 1);
        setShowWordCloud(true);
        setShowWordCloudDots(true);
        setWordCloudStarted(false);
        setWordCloudReady(false);
        setShowHdImage(false);
        setMonoAnimationStarted(false);
        setMonoImageLoaded(false);
        setMonoDisplayCount(0);
        setMonoPrefix('');
      }
    }
    setPreviousColor(selectedColor);
  }, [selectedColor, previousColor, clearAllMonoTimeouts, animatedColors]);

  // Reset animation monochromes quand on quitte l'onglet
  useEffect(() => {
    if (activeTab !== 'monochromes') {
      clearAllMonoTimeouts();
      setShowWordCloud(true);
      setShowWordCloudDots(true);
      setWordCloudStarted(false);
      setWordCloudReady(false);
      setShowHdImage(false);
      setMonoAnimationStarted(false);
      setMonoImageLoaded(false);
      setMonoDisplayCount(0);
      setMonoPrefix('');
    }
  }, [activeTab, clearAllMonoTimeouts]);

  // Animation "Les" lettre par lettre quand le compteur atteint la valeur finale
  useEffect(() => {
    const colorData = COLOR_DATA[selectedColor];
    const fullPrefix = 'Les';
    if (colorData && monoDisplayCount >= colorData.count && monoPrefix.length < fullPrefix.length) {
      const timeout = setTimeout(() => {
        setMonoPrefix(fullPrefix.slice(0, monoPrefix.length + 1));
      }, 150); // 150ms entre chaque lettre
      return () => clearTimeout(timeout);
    }
  }, [monoDisplayCount, monoPrefix, selectedColor]);

  const togglePaletteColor = (color: ColorKey) => {
    // Effacer l'aperçu quand on change les couleurs
    if (palettePreview) {
      setPalettePreview(null);
      setPaletteResult(null);
      setPaletteCount(0);
      setRevealProgress(0);
      // Réinitialiser le canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }
    }

    setSelectedPaletteColors((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(color)) {
        newSet.delete(color);
      } else {
        newSet.add(color);
      }
      return newSet;
    });
  };

  const toggleCropColor = (color: ColorKey) => {
    // Effacer l'aperçu quand on change les couleurs
    if (cropPreview) {
      setCropPreview(null);
      setCropResult(null);
      setCropCount(0);
      setCropRevealProgress(0);
      // Réinitialiser le canvas
      const canvas = canvasCropRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }
    }

    setSelectedCropColors((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(color)) {
        newSet.delete(color);
      } else {
        newSet.add(color);
      }
      return newSet;
    });
  };

  const initRevealDots = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Créer une grille de points blancs très fins couvrant tout le canvas
    const dotSize = 1;
    const dots: { x: number; y: number }[] = [];

    for (let y = 0; y < canvas.height; y += dotSize) {
      for (let x = 0; x < canvas.width; x += dotSize) {
        dots.push({ x, y });
      }
    }

    // Mélanger les points de façon chaotique
    for (let i = dots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dots[i], dots[j]] = [dots[j], dots[i]];
    }

    dotsRef.current = dots;

    // Dessiner tous les points blancs
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    return dots.length;
  }, []);

  const startRevealAnimation = useCallback((totalCount: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dots = dotsRef.current;
    const dotSize = 1;
    let currentIndex = 0;
    const dotsPerFrame = Math.max(2000, Math.floor(dots.length / 200)); // ~200 frames

    const reveal = () => {
      const endIndex = Math.min(currentIndex + dotsPerFrame, dots.length);

      // Effacer seulement les points de cette frame (plus performant)
      for (let i = currentIndex; i < endIndex; i++) {
        ctx.clearRect(dots[i].x, dots[i].y, dotSize, dotSize);
      }

      currentIndex = endIndex;
      const revealed = Math.floor((currentIndex / dots.length) * totalCount);
      setPaletteCount(revealed);
      setRevealProgress(currentIndex / dots.length);

      if (currentIndex < dots.length) {
        animationRef.current = requestAnimationFrame(reveal);
      } else {
        setIsPaletteRevealing(false);
        setPaletteCount(totalCount);
      }
    };

    setIsPaletteRevealing(true);
    animationRef.current = requestAnimationFrame(reveal);
  }, []);

  // Fonctions pour Rencontres Crop
  const initRevealDotsCrop = useCallback(() => {
    const canvas = canvasCropRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dotSize = 1;
    const dots: { x: number; y: number }[] = [];

    for (let y = 0; y < canvas.height; y += dotSize) {
      for (let x = 0; x < canvas.width; x += dotSize) {
        dots.push({ x, y });
      }
    }

    for (let i = dots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dots[i], dots[j]] = [dots[j], dots[i]];
    }

    dotsCropRef.current = dots;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    return dots.length;
  }, []);

  const startRevealAnimationCrop = useCallback((totalCount: number) => {
    const canvas = canvasCropRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dots = dotsCropRef.current;
    const dotSize = 1;
    let currentIndex = 0;
    const dotsPerFrame = Math.max(2000, Math.floor(dots.length / 200));

    const reveal = () => {
      const endIndex = Math.min(currentIndex + dotsPerFrame, dots.length);

      for (let i = currentIndex; i < endIndex; i++) {
        ctx.clearRect(dots[i].x, dots[i].y, dotSize, dotSize);
      }

      currentIndex = endIndex;
      const revealed = Math.floor((currentIndex / dots.length) * totalCount);
      setCropCount(revealed);
      setCropRevealProgress(currentIndex / dots.length);

      if (currentIndex < dots.length) {
        animationCropRef.current = requestAnimationFrame(reveal);
      } else {
        setIsCropRevealing(false);
        setCropCount(totalCount);
      }
    };

    setIsCropRevealing(true);
    animationCropRef.current = requestAnimationFrame(reveal);
  }, []);

  const handleGeneratePalette = async () => {
    if (selectedPaletteColors.size < 2) return;

    // Cancel any ongoing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    setIsPaletteGenerating(true);
    setPaletteError(null);
    setPaletteResult(null);
    setPalettePreview(null);
    setPaletteCount(0);
    setRevealProgress(0);

    // Initialiser les points blancs
    initRevealDots();

    try {
      const colors = Array.from(selectedPaletteColors);

      // Choisir l'endpoint selon le mode (nuages ou brumes)
      const endpoint = rencontresMode === 'nuages' ? '/api/generate-palette' : '/api/generate-palette-crop';

      // Générer l'aperçu
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colors, full: false }),
      });

      const data: PaletteResult = await response.json();

      if ('error' in data) {
        setPaletteError((data as { error: string }).error);
        setIsPaletteGenerating(false);
        return;
      }

      setPalettePreview(data.preview + '?t=' + Date.now());
      // Utiliser total_available (nombre théorique avant collisions) pour le compteur
      const displayCount = data.total_available || data.count;
      setPaletteCount(displayCount);
      // Stocker le résultat complet (inclut maintenant le chemin HD)
      setPaletteResult(data as GenerationResult);
      setIsPaletteGenerating(false);

      // Attendre que l'image soit chargée avant de lancer l'animation
      const img = new Image();
      img.onload = () => {
        startRevealAnimation(displayCount);
      };
      img.src = data.preview + '?t=' + Date.now();

    } catch (err) {
      setPaletteError(err instanceof Error ? err.message : 'Erreur de connexion');
      setIsPaletteGenerating(false);
    }
  };

  const handleDownloadPalette = async () => {
    if (selectedPaletteColors.size < 2) return;

    setIsPaletteGenerating(true);

    try {
      const colors = Array.from(selectedPaletteColors);

      // Choisir l'endpoint selon le mode
      const endpoint = rencontresMode === 'nuages' ? '/api/generate-palette' : '/api/generate-palette-crop';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colors, full: true }),
      });

      const data = await response.json();

      if (data.error) {
        setPaletteError(data.error);
      } else {
        setPaletteResult(data);
        // Trigger download
        const link = document.createElement('a');
        link.href = data.full;
        link.download = data.full.split('/').pop() || 'palette.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      setPaletteError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setIsPaletteGenerating(false);
    }
  };

  const handleDownload = (result: GenerationResult | null) => {
    if (!result?.full) return;
    const link = document.createElement('a');
    link.href = result.full;
    link.download = result.full.split('/').pop() || 'colorpaps.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handlers pour Rencontres Crop
  const handleGenerateCrop = async () => {
    if (selectedCropColors.size < 2) return;

    if (animationCropRef.current) {
      cancelAnimationFrame(animationCropRef.current);
    }

    setIsCropGenerating(true);
    setCropError(null);
    setCropResult(null);
    setCropPreview(null);
    setCropCount(0);
    setCropRevealProgress(0);

    initRevealDotsCrop();

    try {
      const colors = Array.from(selectedCropColors);

      const response = await fetch('/api/generate-palette-crop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colors }),
      });

      const data: PaletteResult = await response.json();

      if ('error' in data) {
        setCropError((data as { error: string }).error);
        setIsCropGenerating(false);
        return;
      }

      setCropPreview(data.preview + '?t=' + Date.now());
      // Utiliser total_available (nombre théorique avant collisions) pour le compteur
      const displayCount = data.total_available || data.count;
      setCropCount(displayCount);
      setCropResult(data as GenerationResult);
      setIsCropGenerating(false);

      const img = new Image();
      img.onload = () => {
        startRevealAnimationCrop(displayCount);
      };
      img.src = data.preview + '?t=' + Date.now();

    } catch (err) {
      setCropError(err instanceof Error ? err.message : 'Erreur de connexion');
      setIsCropGenerating(false);
    }
  };

  // Mémorise la couleur de fond pour éviter les recalculs
  const bgColor = useMemo(() => {
    if (activeTab === 'spectrum') return SPECTRUM_BG;
    if (activeTab === 'galerie') return '#f5f5f0';
    if (activeTab === 'rencontres') {
      if (selectedPaletteColors.size === 0) return PALETTE_BG;
      if (selectedPaletteColors.size === 1) return TINTS[Array.from(selectedPaletteColors)[0]];
      // Mélange des couleurs
      const colors = Array.from(selectedPaletteColors);
      const rgbColors = colors.map((c) => {
        const hex = TINTS[c].replace('#', '');
        return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
      });
      const avg = rgbColors.reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0]);
      return `rgb(${Math.round(avg[0] / colors.length)}, ${Math.round(avg[1] / colors.length)}, ${Math.round(avg[2] / colors.length)})`;
    }
    if (activeTab === 'rencontrescrop') {
      if (selectedCropColors.size === 0) return PALETTE_BG;
      if (selectedCropColors.size === 1) return TINTS[Array.from(selectedCropColors)[0]];
      const colors = Array.from(selectedCropColors);
      const rgbColors = colors.map((c) => {
        const hex = TINTS[c].replace('#', '');
        return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
      });
      const avg = rgbColors.reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0]);
      return `rgb(${Math.round(avg[0] / colors.length)}, ${Math.round(avg[1] / colors.length)}, ${Math.round(avg[2] / colors.length)})`;
    }
    if (activeTab === 'monochromesbis') return TINTS.bleu;
    return TINTS[selectedColor];
  }, [activeTab, selectedColor, selectedPaletteColors, selectedCropColors]);

  // Données mémorisées
  const selectedColorData = useMemo(() => COLOR_DATA[selectedColor], [selectedColor]);
  const currentError = activeTab === 'rencontres' ? paletteError : activeTab === 'rencontrescrop' ? cropError : null;

  // Splash screen
  if (isLoading) {
    return (
      <div className="splash-screen">
        <h1 className="splash-title">NUANCE<span className="underline-s">S</span></h1>
      </div>
    );
  }

  return (
    <main className="main-container" style={{ backgroundColor: bgColor }}>
      {/* Navigation */}
      <nav className="info-nav">
        <button onClick={() => setInfoPage('demarche')} className="info-nav-link">
          <UnderlineS>Démarche</UnderlineS>
        </button>
        <button onClick={() => setInfoPage('methode')} className="info-nav-link">
          Méthode
        </button>
        <button onClick={() => setInfoPage('artiste')} className="info-nav-link">
          <UnderlineS>L&apos;Artiste</UnderlineS>
        </button>
      </nav>

      {/* Header */}
      <header className="main-header">
        <div className="header-content">
          <h1 className="title"><UnderlineS>NUANCES</UnderlineS></h1>
          <img
            src="/jg-causse-signature.png"
            alt="Jean-Gabriel Causse"
            className="signature-image"
          />
        </div>
        <div className="divider" style={{ margin: '20px auto' }} />
      </header>

      {/* Tabs */}
      <div className="tabs tabs-spaced">
        <button
          className={`tab ${activeTab === 'monochromes' ? 'active' : ''}`}
          onClick={() => setActiveTab('monochromes')}
        >
          <UnderlineS>Monochromes</UnderlineS>
        </button>
        <button
          className={`tab ${activeTab === 'rencontres' ? 'active' : ''}`}
          onClick={() => setActiveTab('rencontres')}
        >
          <UnderlineS>Rencontres</UnderlineS>
        </button>
        <button
          className={`tab ${activeTab === 'galerie' ? 'active' : ''}`}
          onClick={() => setActiveTab('galerie')}
        >
          Galerie
        </button>
      </div>

      {/* Frame for Couleurs - avec nuage de mots puis dezoom animé */}
      {activeTab === 'monochromes' && (
        <div
          className="frame-container"
                  >
          <div className="frame-inner frame-relative">
            {selectedColorData?.full ? (
              /* Clé unique force le remontage complet au changement de couleur */
              <div key={`mono-${selectedColor}-${monoKey}`} style={{ position: 'absolute', inset: 0 }}>
                {/* Image HD */}
                <img
                  src={`/generated/${selectedColor}_hq.webp`}
                  alt={`Nuage ${selectedColor}`}
                  onLoad={() => setMonoImageLoaded(true)}
                  className={`mono-hd-image ${monoAnimationStarted ? 'animating' : ''} ${showHdImage ? 'visible' : ''}`}
                />

                {/* Fond blanc pendant le nuage de mots */}
                <div className={`mono-white-overlay ${showHdImage ? 'hidden' : ''}`} />

                {/* Nuage de mots et pixels */}
                {showWordCloudDots && wordCloudStarted && (
                  <div className={`word-cloud-pixels ${monoAnimationStarted ? 'animating' : ''}`}>
                    {COLOR_NAMES[selectedColor].map((colorName, index) => (
                      <div
                        key={`dot-${colorName.name}`}
                        className="word-cloud-pixel"
                        data-index={index}
                        style={{ '--color': colorName.hex } as React.CSSProperties}
                      />
                    ))}
                  </div>
                )}

                {showWordCloud && wordCloudStarted && (
                  <div className={`word-cloud-words ${wordCloudReady ? 'fading' : ''}`}>
                    {COLOR_NAMES[selectedColor].map((colorName, index) => (
                      <div
                        key={colorName.name}
                        className="word-cloud-item"
                        data-index={index}
                        style={{ '--color': colorName.hex } as React.CSSProperties}
                      >
                        <span className="word-cloud-name">{colorName.name}</span>
                        <span className="word-cloud-rgb">{colorName.hex}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="placeholder-text">
                Cette couleur n&apos;est pas encore disponible
              </p>
            )}
          </div>
        </div>
      )}

      {/* Frame for Monochromes bis - avec dezoom animé */}
      {activeTab === 'monochromesbis' && (
        <div
          className="frame-container"
                  >
          <div className="frame-inner" style={{ overflow: 'hidden' }}>
            <img
              src={COLOR_DATA.bleu?.full}
              alt="Nuage bleu HD"
              onLoad={() => setBisImageLoaded(true)}
              style={{
                transform: `scale(${bisZoomScale})`,
                transformOrigin: '35% 40%', // Point de focus sur un des points du nuage
                transition: bisAnimationStarted ? 'none' : 'transform 0.1s ease-out',
              }}
            />
          </div>
        </div>
      )}

      {/* Frame for Spectrum */}
      {activeTab === 'spectrum' && (
        <div
          className="frame-container"
                  >
          <div className="frame-inner">
            <img
              src={SPECTRUM_PREGENERATED.preview}
              alt="Spectrum"
            />
          </div>
        </div>
      )}

      {/* Frame for Palette with reveal animation */}
      {activeTab === 'rencontres' && (
        <div
          className="frame-container"
                  >
          <div className="frame-inner" style={{ position: 'relative' }}>
            {/* Image de l'aperçu (en dessous) */}
            {palettePreview && (
              <img
                src={palettePreview}
                alt="Palette preview"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                }}
              />
            )}
            {/* Canvas de révélation (points blancs par dessus) */}
            <canvas
              ref={canvasRef}
              width={800}
              height={800}
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
                position: 'relative',
                zIndex: 1,
              }}
            />
            {isPaletteGenerating && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  zIndex: 2,
                }}
              >
                <div className="loader">
                  <div className="loader-ring" />
                  <p className="loader-text">Composition en cours...</p>
                </div>
              </div>
            )}
            {!isPaletteRevealing && !isPaletteGenerating && !palettePreview && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  zIndex: 2,
                }}
              >
                {selectedPaletteColors.size === 0 ? (
                  <p className="placeholder-text">
                    Sélectionnez vos couleurs
                  </p>
                ) : (
                  <div className="color-names-stack">
                    {Array.from(selectedPaletteColors).map((c) => (
                      <span
                        key={c}
                        className="color-name-item"
                        style={{ color: COLORS.find(col => col.key === c)?.hex }}
                      >
                        {COLOR_LABELS_PLURAL[c]}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Frame for Rencontres Crop with reveal animation */}
      {activeTab === 'rencontrescrop' && (
        <div
          className="frame-container"
                  >
          <div className="frame-inner" style={{ position: 'relative' }}>
            {/* Image de l'aperçu (en dessous) */}
            {cropPreview && (
              <img
                src={cropPreview}
                alt="Palette crop preview"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                }}
              />
            )}
            {/* Canvas de révélation (points blancs par dessus) */}
            <canvas
              ref={canvasCropRef}
              width={800}
              height={800}
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
                position: 'relative',
                zIndex: 1,
              }}
            />
            {isCropGenerating && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  zIndex: 2,
                }}
              >
                <div className="loader">
                  <div className="loader-ring" />
                  <p className="loader-text">Composition en cours...</p>
                </div>
              </div>
            )}
            {selectedCropColors.size < 2 && !isCropRevealing && !isCropGenerating && !cropPreview && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255,255,255,0.9)',
                  zIndex: 2,
                }}
              >
                <p className="placeholder-text">
                  Selectionnez au moins 2 couleurspour composer cotre rencontre
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gallery Section */}
      {activeTab === 'galerie' && (
        <div className="gallery-container">
          <div className="gallery-grid" style={{ justifyContent: 'center' }}>
            <div className="mockup-card">
              <div className="mockup-image-container">
                <img
                  src="/nano-banana.png"
                  alt="Salon contemporain avec composition Jaune-Orange"
                  className="mockup-bg"
                  style={{ objectFit: 'contain' }}
                />
              </div>
              <div className="mockup-info">
                <h3><UnderlineS>Salon</UnderlineS> contemporain</h3>
                <p>Rencontre de nuances Jaune-Orange</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Title display for Monochromes - compteur visible dès le début */}
      {activeTab === 'monochromes' && selectedColorData && (
        <div className="section-title">
          <h2 className="color-title">
            {monoPrefix} {monoDisplayCount.toLocaleString('fr-FR')} <UnderlineS>{COLOR_LABELS_PLURAL[selectedColor]}</UnderlineS>
          </h2>
        </div>
      )}

      {/* Title display for Monochromes bis */}
      {activeTab === 'monochromesbis' && COLOR_DATA.bleu && (
        <div className="section-title">
          <h2 className="color-title">
            {COLOR_DATA.bleu.count.toLocaleString('fr-FR')} <UnderlineS>bleus</UnderlineS>
          </h2>
        </div>
      )}

      {/* Title display for Spectrum */}
      {activeTab === 'spectrum' && (
        <div className="section-title">
          <h2 className="color-title">
            {SPECTRUM_PREGENERATED.count.toLocaleString('fr-FR')} <UnderlineS>nuances</UnderlineS>
          </h2>
          {SPECTRUM_PREGENERATED.stats && (
            <div className="stats-grid">
              {Object.entries(SPECTRUM_PREGENERATED.stats).map(([color, count]) => (
                <div key={color} className="stat-item">
                  <span
                    className="stat-dot"
                    style={{ backgroundColor: COLORS.find((c) => c.key === color)?.hex || '#999' }}
                  />
                  <span className="stat-count">{count.toLocaleString('fr-FR')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'rencontres' && (isPaletteRevealing || palettePreview) && (
        <div className="section-title">
          <h2 className="color-title">
            {paletteCount.toLocaleString('fr-FR')} <UnderlineS>nuances</UnderlineS>
          </h2>
        </div>
      )}

      {activeTab === 'rencontrescrop' && (isCropRevealing || cropPreview) && (
        <div className="section-title">
          <h2 className="color-title">
            {cropCount.toLocaleString('fr-FR')} <UnderlineS>nuances</UnderlineS>
          </h2>
        </div>
      )}

      {/* Controls for Couleurs tab */}
      {activeTab === 'monochromes' && (
        <>
          <div className="color-selector selector-spaced">
            {COLORS.map((color) => (
              <button
                key={color.key}
                className={`color-btn ${selectedColor === color.key ? 'selected' : ''}`}
                style={{
                  backgroundColor: color.hex,
                  '--btn-color': color.hex,
                } as React.CSSProperties}
                onClick={() => setSelectedColor(color.key)}
                title={color.label}
                aria-label={color.label}
              />
            ))}
          </div>

          {selectedColorData && (
            <div className="btn-group">
              <button
                className="btn btn-primary"
                onClick={() => openHdModal(
                  selectedColorData.full,
                  `${selectedColorData.count.toLocaleString('fr-FR')} ${COLOR_LABELS_PLURAL[selectedColor]}`
                )}
              >
                Visualiser en HD
              </button>
            </div>
          )}
        </>
      )}

      {/* Controls for Monochromes bis */}
      {activeTab === 'monochromesbis' && COLOR_DATA.bleu && (
        <div className="btn-group">
          <button
            className="btn btn-secondary"
            onClick={() => {
              if (bisAnimationRef.current) {
                cancelAnimationFrame(bisAnimationRef.current);
              }
              setBisZoomScale(25);
              setBisAnimationStarted(false);
              // Petit délai pour que le state se reset avant de relancer
              setTimeout(() => {
                setBisAnimationStarted(true);
                startBisAnimation();
              }, 100);
            }}
          >
            Rejouer l&apos;animation
          </button>
          <button
            className="btn btn-primary"
            onClick={() => openHdModal(
              COLOR_DATA.bleu!.full,
              `${COLOR_DATA.bleu!.count.toLocaleString('fr-FR')} bleus`
            )}
          >
            Visualiser en HD
          </button>
        </div>
      )}

      {/* Controls for Palette tab */}
      {activeTab === 'rencontres' && (
        <>
          <div className="color-selector selector-spaced">
            {COLORS.map((color) => (
              <button
                key={color.key}
                className={`color-btn ${selectedPaletteColors.has(color.key) ? 'selected' : ''}`}
                style={{
                  backgroundColor: color.hex,
                  '--btn-color': color.hex,
                } as React.CSSProperties}
                onClick={() => togglePaletteColor(color.key)}
                title={color.label}
                disabled={isPaletteGenerating || isPaletteRevealing}
                aria-label={color.label}
              />
            ))}
          </div>

          <p className="info-label" style={{ marginBottom: '20px' }}>
            {selectedPaletteColors.size} couleur{selectedPaletteColors.size > 1 ? 's' : ''} sélectionnée{selectedPaletteColors.size > 1 ? 's' : ''}
            {selectedPaletteColors.size > 0 && (
              <>
                {' : '}
                {Array.from(selectedPaletteColors).map((c, i) => (
                  <span key={c}>
                    <span style={{ color: COLORS.find(col => col.key === c)?.hex }}>{COLOR_LABELS_PLURAL[c]}</span>
                    {i < selectedPaletteColors.size - 1 && ', '}
                  </span>
                ))}
              </>
            )}
          </p>

          {/* Toggle Nuages/Brumes */}
          <div className="mode-toggle-container" style={{ marginBottom: '24px' }}>
            <div className={`mode-toggle ${rencontresMode === 'brumes' ? 'brumes-active' : ''}`}>
              <button
                className={`mode-toggle-btn ${rencontresMode === 'nuages' ? 'active' : ''}`}
                onClick={() => {
                  if (rencontresMode !== 'nuages') {
                    setRencontresMode('nuages');
                    setPalettePreview(null);
                    setPaletteResult(null);
                    setPaletteCount(0);
                    setRevealProgress(0);
                  }
                }}
              >
                <UnderlineS>Nuages</UnderlineS>
              </button>
              <button
                className={`mode-toggle-btn ${rencontresMode === 'brumes' ? 'active' : ''}`}
                onClick={() => {
                  if (rencontresMode !== 'brumes') {
                    setRencontresMode('brumes');
                    setPalettePreview(null);
                    setPaletteResult(null);
                    setPaletteCount(0);
                    setRevealProgress(0);
                  }
                }}
              >
                <UnderlineS>Brumes</UnderlineS>
              </button>
            </div>
            <p className="mode-description">
              {rencontresMode === 'nuages'
                ? 'Îlots de couleurs distincts'
                : 'Couleurs diffuses jusqu\'aux bords'}
            </p>
          </div>

          <div className="btn-group">
            {/* Bouton Générer - visible seulement s'il n'y a pas d'aperçu */}
            {!palettePreview && (
              <button
                className="btn btn-primary"
                onClick={handleGeneratePalette}
                disabled={selectedPaletteColors.size < 2 || isPaletteGenerating || isPaletteRevealing}
              >
                {isPaletteGenerating ? 'Generation...' : isPaletteRevealing ? 'Revelation...' : 'Generer'}
              </button>
            )}

            {/* Bouton Visualiser en HD - visible seulement après génération */}
            {palettePreview && !isPaletteRevealing && paletteResult?.full && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  openHdModal(paletteResult.full, `${paletteCount.toLocaleString('fr-FR')} nuances`);
                }}
              >
                Visualiser en HD
              </button>
            )}
          </div>
        </>
      )}

      {/* Controls for Rencontres Crop tab */}
      {activeTab === 'rencontrescrop' && (
        <>
          <div className="color-selector selector-spaced">
            {COLORS.map((color) => (
              <button
                key={color.key}
                className={`color-btn ${selectedCropColors.has(color.key) ? 'selected' : ''}`}
                style={{
                  backgroundColor: color.hex,
                  '--btn-color': color.hex,
                } as React.CSSProperties}
                onClick={() => toggleCropColor(color.key)}
                title={color.label}
                disabled={isCropGenerating || isCropRevealing}
                aria-label={color.label}
              />
            ))}
          </div>

          <p className="info-label" style={{ marginBottom: '20px' }}>
            {selectedCropColors.size} couleur{selectedCropColors.size > 1 ? 's' : ''} selectionnee{selectedCropColors.size > 1 ? 's' : ''}
          </p>

          <div className="btn-group">
            {/* Bouton Générer - visible seulement s'il n'y a pas d'aperçu */}
            {!cropPreview && (
              <button
                className="btn btn-primary"
                onClick={handleGenerateCrop}
                disabled={selectedCropColors.size < 2 || isCropGenerating || isCropRevealing}
              >
                {isCropGenerating ? 'Generation...' : isCropRevealing ? 'Revelation...' : 'Generer'}
              </button>
            )}

            {/* Bouton Visualiser en HD - visible seulement après génération */}
            {cropPreview && !isCropRevealing && cropResult?.full && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  openHdModal(cropResult.full, `${cropCount.toLocaleString('fr-FR')} nuances`);
                }}
              >
                Visualiser en HD
              </button>
            )}
          </div>
        </>
      )}

      {/* Controls for Spectrum tab */}
      {activeTab === 'spectrum' && (
        <div className="btn-group">
          <button
            className="btn btn-primary"
            onClick={() => openHdModal(
              SPECTRUM_PREGENERATED.full,
              `${SPECTRUM_PREGENERATED.count.toLocaleString('fr-FR')} nuances`
            )}
          >
            Visualiser en HD
          </button>
        </div>
      )}

      {/* Error */}
      {currentError && (
        <div className="error-message" style={{ marginTop: '24px' }}>
          {currentError}
        </div>
      )}

      {/* Footer */}
      <footer className="footer" style={{ marginTop: '80px' }}>
        <p>
          {activeTab === 'spectrum'
            ? 'Toutes les nuances chromatiques reunies en une seule composition'
            : activeTab === 'rencontres'
            ? 'Composez votre propre palette de nuances chromatiques'
            : activeTab === 'rencontrescrop'
            ? 'Rencontres qui debordent jusqu\'aux bords du cadre'
            : activeTab === 'galerie'
            ? 'Imaginez nos compositions dans votre espace de vie'
            : 'Chaque composition represente des milliers de nuances chromatiques uniques'}
        </p>
        {activeTab !== 'galerie' && (
          <p style={{ marginTop: '8px' }}>
            <span className="footer-accent">Gamut Epson P9000</span> &middot; 1m &times; 1m &middot; 300 DPI
          </p>
        )}
      </footer>

      {/* Modal HD */}
      {hdModalOpen && hdModalImage && (
        <div
          className="hd-modal-overlay"
          onClick={closeHdModal}
          onTouchMove={(e) => {
            // Bloquer le pinch-to-zoom (multi-touch)
            if (e.touches.length > 1) {
              e.preventDefault();
            }
          }}
        >
          <div
            ref={modalWrapperRef}
            className={`hd-modal-image-wrapper ${isDragging ? 'dragging' : ''} ${imageScale > 1 ? 'zoomed' : ''}`}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            onTouchStart={(e) => {
              // Bloquer le pinch-to-zoom dès le début du geste
              if (e.touches.length > 1) {
                e.preventDefault();
              }
            }}
            onTouchMove={(e) => {
              // Bloquer le pinch-to-zoom pendant le mouvement
              if (e.touches.length > 1) {
                e.preventDefault();
              }
            }}
          >
            <img
              src={hdModalImage}
              alt={hdModalTitle}
              className="hd-modal-image"
              style={{
                transform: `translate(${imagePos.x}px, ${imagePos.y}px) scale(${imageScale})`,
              }}
              onContextMenu={(e) => e.preventDefault()}
              draggable={false}
            />
          </div>
        </div>
      )}

      {/* Info Pages */}
      {infoPage && (
        <div className="info-page-overlay" onClick={() => setInfoPage(null)}>
          <article className="info-page" onClick={(e) => e.stopPropagation()}>
            <button className="info-page-close" onClick={() => setInfoPage(null)} aria-label="Fermer">
              <span />
              <span />
            </button>

            {/* Navigation arrows */}
            <nav
              className="info-page-nav info-page-nav-left"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="info-page-nav-btn"
                onClick={() => {
                  const pages: InfoPage[] = ['demarche', 'methode', 'artiste'];
                  const currentIndex = pages.indexOf(infoPage);
                  const prevIndex = currentIndex === 0 ? pages.length - 1 : currentIndex - 1;
                  setInfoPage(pages[prevIndex]);
                }}
                aria-label="Page précédente"
              >
                <svg viewBox="0 0 24 24">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <span className="info-page-nav-label">
                {infoPage === 'demarche' ? 'Artiste' : infoPage === 'methode' ? 'Démarche' : 'Méthode'}
              </span>
            </nav>

            <nav
              className="info-page-nav info-page-nav-right"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="info-page-nav-btn"
                onClick={() => {
                  const pages: InfoPage[] = ['demarche', 'methode', 'artiste'];
                  const currentIndex = pages.indexOf(infoPage);
                  const nextIndex = currentIndex === pages.length - 1 ? 0 : currentIndex + 1;
                  setInfoPage(pages[nextIndex]);
                }}
                aria-label="Page suivante"
              >
                <svg viewBox="0 0 24 24">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
              <span className="info-page-nav-label">
                {infoPage === 'demarche' ? 'Méthode' : infoPage === 'methode' ? 'Artiste' : 'Démarche'}
              </span>
            </nav>

            {infoPage === 'demarche' && (
              <div className="info-page-content">
                <header className="info-page-hero">
                  <span className="info-page-number">01</span>
                  <h2 className="info-page-title">La <UnderlineS>Démarche</UnderlineS></h2>
                  <p className="info-page-subtitle">Chromo-diversité</p>
                </header>

                <div className="info-page-body">
                  <p className="info-page-intro">
                    Cette œuvre chromatique s&apos;appuie sur les formidables capacités de l&apos;œil humain
                    à distinguer les nuances les plus subtiles.
                  </p>

                  <p>
                    Je vous invite à considérer chaque point de couleur comme une entité vivante,
                    une espèce à part entière.
                  </p>

                  <p>
                    À l&apos;image de la nature, où l&apos;on pourrait dire « une fleur » tout en ignorant
                    l&apos;existence de milliers de variétés uniques qui assurent l&apos;équilibre d&apos;une prairie,
                    la <em>Chromo-diversité</em> redonne leur place à tous les individus du spectre.
                  </p>

                  <h3>Le <UnderlineS>Manifeste</UnderlineS> de l&apos;Infime</h3>

                  <p>
                    Chaque point de 8 pixels possède sa propre identité. Ils sont extrêmement proches
                    de leurs cousins, presque indiscernables au premier regard, et pourtant radicalement différents.
                  </p>

                  <p className="info-page-highlight">
                    En réunissant 1 185 512 points uniques de couleurs distinctes perceptibles par l&apos;œil humain,
                    je crée un parallèle avec la fragilité de notre écosystème : chaque nuance est un maillon
                    indispensable. Sa disparition, même imperceptible, romprait l&apos;équilibre de l&apos;ensemble.
                  </p>

                  <h3><UnderlineS>Symbioses</UnderlineS> chromatiques</h3>

                  <p>
                    Au-delà de l&apos;isolement de chaque nuance, mon travail explore les zones de contact entre
                    les familles chromatiques. Dans certains visuels, je provoque la rencontre — presque l&apos;étreinte —
                    de deux pôles du spectre, comme les roses et les verts.
                  </p>

                  <p>
                    Ces confrontations ne sont pas des mélanges, mais des <em>symbioses</em>. En faisant s&apos;embrasser
                    deux écosystèmes que tout oppose, je mets en lumière leur interdépendance. Le rose ne vibre
                    jamais autant que lorsqu&apos;il frôle son complémentaire.
                  </p>

                  <p>
                    Ces zones de tension sont les lieux de la plus haute biodiversité : là où les nuances s&apos;entremêlent,
                    l&apos;œil est forcé de redoubler d&apos;acuité pour maintenir la distinction entre les individus de chaque lignée.
                  </p>

                  <p className="info-page-closing">
                    C&apos;est dans ce dialogue entre contraires que la Chromo-diversité révèle sa force
                    et sa capacité à créer une harmonie globale sans jamais sacrifier l&apos;unité de chaque point.
                  </p>
                </div>
              </div>
            )}

            {infoPage === 'methode' && (
              <div className="info-page-content">
                <header className="info-page-hero">
                  <span className="info-page-number">02</span>
                  <h2 className="info-page-title">Protocole de l&apos;Unicité</h2>
                  <p className="info-page-subtitle">La Méthode</p>
                </header>

                <div className="info-page-body">
                  <p className="info-page-intro">
                    Ce projet repose sur une approche scientifique visant à isoler l&apos;intégralité
                    des nuances discriminables par l&apos;œil humain au sein des gamuts les plus étendus
                    de l&apos;impression contemporaine.
                  </p>

                  <div className="method-grid">
                    <div className="method-section">
                      <span className="method-number">01</span>
                      <div className="method-content">
                        <h3>L&apos;Échantillonnage Perceptuel</h3>
                        <p className="method-subtitle">Espace CIE Lab*</p>
                        <p>
                          Plutôt que d&apos;utiliser des valeurs numériques arbitraires, le projet prend pour base
                          l&apos;espace CIE Lab*, qui modélise la vision humaine. Pour respecter la biologie de l&apos;œil,
                          j&apos;ai appliqué un Delta E adaptatif.
                        </p>
                        <div className="method-details">
                          <p><strong>Zones de haute sensibilité</strong> (Clairs et Neutres) : seuil de 0.5 pour capturer les nuances les plus infimes.</p>
                          <p><strong>Zones de saturation et d&apos;ombre</strong> : seuil élargi jusqu&apos;à 1.5, là où l&apos;œil humain devient moins discriminant.</p>
                        </div>
                        <p className="method-result">Ce processus génère <strong>1 185 512 couleurs Lab*</strong>.</p>
                      </div>
                    </div>

                    <div className="method-section">
                      <span className="method-number">02</span>
                      <div className="method-content">
                        <h3>Le Filtrage d&apos;Unicité</h3>
                        <p className="method-subtitle">Déduplication</p>
                        <p>
                          Le passage de la perception (Lab*) à la commande numérique (RGB) crée un phénomène
                          de convergence : plusieurs couleurs perçues comme distinctes peuvent aboutir au même
                          code informatique après arrondi.
                        </p>
                        <p className="method-result">
                          Aucune couleur n&apos;est répétée. Aucune « espèce » n&apos;est en double.
                        </p>
                      </div>
                    </div>

                    <div className="method-section">
                      <span className="method-number">03</span>
                      <div className="method-content">
                        <h3>La Confrontation à la Matière</h3>
                        <p className="method-subtitle">Epson P9000 — 10 encres pigmentaires</p>
                        <p>
                          L&apos;étape finale est celle de l&apos;incarnation physique via le gamut de l&apos;Epson P9000.
                        </p>
                        <div className="method-stats">
                          <div className="method-stat">
                            <span className="method-stat-value">100%</span>
                            <span className="method-stat-label">Intégrité du spectre</span>
                            <span className="method-stat-detail">1 185 512 nuances préservées</span>
                          </div>
                          <div className="method-stat">
                            <span className="method-stat-value">8</span>
                            <span className="method-stat-label">Familles chromatiques</span>
                            <span className="method-stat-detail">Du bleu profond au violet éclatant</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="info-page-closing">
                    L&apos;œuvre constitue une taxonomie exhaustive du visible imprimable. Elle ne donne pas à voir
                    une « image », mais une population de 1 185 512 points où chaque individu chromatique
                    revendique sa différence.
                  </p>
                </div>
              </div>
            )}

            {infoPage === 'artiste' && (
              <div className="info-page-content info-page-artist">
                <header className="info-page-hero">
                  <div className="artist-hero-text">
                    <span className="info-page-number">03</span>
                    <h2 className="info-page-title">L&apos;<UnderlineS>Artiste</UnderlineS></h2>
                    <p className="info-page-subtitle">Jean-Gabriel Causse</p>
                  </div>
                  <div className="artist-image-container">
                    <img
                      src="/jg-causse.jpg"
                      alt="Jean-Gabriel Causse"
                      className="artist-image"
                    />
                  </div>
                </header>

                <div className="info-page-body-artist">
                  <div className="artist-content">
                    <h3 className="artist-name">Jean-Gabriel <UnderlineS>Causse</UnderlineS></h3>
                    <p className="artist-subtitle">Designer de la Chromo-diversité</p>

                    <p>
                      Jean-Gabriel Causse est un designer couleur dont le parcours se situe à l&apos;intersection
                      de la psychologie, de la science et de l&apos;esthétique.
                    </p>

                    <p>
                      Membre du Comité Français de la Couleur et auteur d&apos;ouvrages de référence traduits
                      dans le monde entier, il a consacré sa carrière à l&apos;influence des nuances sur nos
                      comportements et nos émotions en France, au Canada et au Japon.
                    </p>

                    <h4>Une quête de l&apos;infime</h4>

                    <p>
                      Pour Jean-Gabriel Causse, la couleur n&apos;est pas une masse uniforme, c&apos;est une <em>population</em>.
                      Son approche est celle d&apos;un curateur du spectre : il recense, isole et protège chaque nuance
                      comme on préserverait une espèce rare.
                    </p>

                    <p>
                      Dans son travail artistique, il délaisse la fonction utilitaire de la couleur pour en explorer
                      la matérialité pure. Il ne cherche plus à utiliser la couleur pour séduire ou convaincre,
                      mais pour témoigner de sa richesse structurelle et de sa fragilité.
                    </p>

                    <blockquote>
                      Dans un monde qui tend à la standardisation,
                      le semblable n&apos;est jamais l&apos;identique.
                    </blockquote>

                    <p className="info-page-closing">
                      À travers ses œuvres, il nous place face à notre propre miroir biologique.
                      Son travail nous force à ralentir, à exercer notre regard pour percevoir
                      ce que nous avons appris à ignorer : la nuance.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </article>
        </div>
      )}
    </main>
  );
}
