import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST() {
  try {
    const scriptPath = path.join(process.cwd(), 'generate_spectrum.py');

    const result = await new Promise<string>((resolve, reject) => {
      const python = spawn('python3', [scriptPath], {
        cwd: process.cwd(),
      });

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
        console.log('[Python Spectrum]', data.toString());
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
    console.error('Spectrum generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    );
  }
}
