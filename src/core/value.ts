import type { AuroraConfig } from './types';

type ConfigRecord = AuroraConfig | Record<string, unknown>;
type AnyKey = string | number | symbol;

export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  return fallback;
}

export function getNumber(state: ConfigRecord, key: AnyKey, fallback = 0): number {
  const value = (state as Record<AnyKey, unknown>)[key];
  return toNumber(value, fallback);
}

export function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }
  return fallback;
}

export function toStringOption(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return fallback;
}
