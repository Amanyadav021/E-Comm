import { BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { ZodTypeAny, output } from 'zod';
import { ORDER_NUMBER_PREFIX } from '@shopcraft/shared';

/** Validate a request body with zod; throws a clean 400 with field issues. */
export function validate<S extends ZodTypeAny>(schema: S, data: unknown): output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }));
    throw new BadRequestException({
      message: issues[0]?.message ?? 'Invalid request',
      issues,
    });
  }
  return result.data;
}

/** JSON stored in NVarChar columns — tolerant parse. */
export function fromJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200);
}

/** Human-friendly, unguessable order number: SC-20260917-4F7K2Q */
export function generateOrderNumber(date = new Date()): string {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = randomBytes(4).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
  return `${ORDER_NUMBER_PREFIX}-${ymd}-${rand}`;
}

/** Prisma Decimal | number | string → number */
export function dec(value: unknown): number {
  if (value == null) return 0;
  return Number(value);
}

export function csvEscape(value: unknown): string {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) lines.push(row.map(csvEscape).join(','));
  return '﻿' + lines.join('\r\n'); // BOM so Excel opens UTF-8 correctly
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function startOfDay(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
