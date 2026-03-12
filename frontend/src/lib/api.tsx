import { OptimizationResult } from '@/lib/types';

export async function runOptimization(params: any): Promise<any> {
  try {
    const response = await fetch('https://afes-4g0c.onrender.com/optimize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Optimization request failed:', error);
    throw error;
  }
}