import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';

const functions = getFunctions(getApp(), 'asia-southeast1');

export async function runOptimizeBatch(input: {
  messengerIds: string[];
  date?: string;           // 'YYYY-MM-DD'
  companyId?: string;
}) {
  const optimize = httpsCallable(functions, 'optimizeRoutesV2');
  const res = await optimize(input);
  return res.data as any;
}
