import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

const VALID_COLORS = ['bleu', 'rouge', 'vert', 'jaune', 'orange', 'marron', 'gris', 'violet'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { colors, full } = body;

    if (!colors || !Array.isArray(colors) || colors.length < 1 || colors.length > 8) {
      return NextResponse.json(
        { error: 'Nombre de couleurs invalide (1-8 requis)' },
        { status: 400 }
      );
    }

    for (const color of colors) {
      if (!VALID_COLORS.includes(color.toLowerCase())) {
        return NextResponse.json(
          { error: `Couleur invalide: ${color}. Choix: ${VALID_COLORS.join(', ')}` },
          { status: 400 }
        );
      }
    }

    const scriptPath = path.join(process.cwd(), 'generate_palette.py');
    const colorsArg = colors.map((c: string) => c.toLowerCase()).join(',');
    const args = [scriptPath, colorsArg];

    if (full) {
      args.push('--full');
    }

    const result = await new Promise<string>((resolve, reject) => {
      const python = spawn('python3', args, {
        cwd: process.cwd(),
      });

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
        console.log('[Python Palette]', data.toString());
      });

      python.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Python exited with code ${code}: ${stderr}`));
        }
      });

      python.on('error', (err) => {
        reject(err);
      });
    });

    const jsonResult = JSON.parse(result.trim());
    return NextResponse.json(jsonResult);

  } catch (error) {
    console.error('Palette generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    );
  }
}
