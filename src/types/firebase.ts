/**
 * Firebase Firestore 타입 정의
 * FIREBASE_DATABASE_SCHEMA.md의 스키마를 기반으로 작성
 */

import { Timestamp } from 'firebase/firestore';

// ==================== Users ====================

export type AccountType = 'free' | 'premium';
export type RegistrationSource = 'web' | 'chrome' | 'extension';

export interface UserDocument {
  email: string;
  displayName?: string;
  photoURL?: string;
  accountType: AccountType;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt?: Timestamp;
  registrationSource?: RegistrationSource;
}

// ==================== Recordings ====================

export interface RecordingDocument {
  userId: string;
  audioUrl?: string;
  audioSize: number;
  duration: number; // 초 단위
  mimeType: string;
  timestamp: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  title?: string;
  tags?: string[];
  isDeleted?: boolean;
  deletedAt?: Timestamp;
}

// ==================== Transcriptions ====================

export type TranscriptionStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface TranscriptionDocument {
  userId: string;
  recordingId: string;
  text: string;
  language: string; // 언어 코드 (예: "ko", "en")
  duration: number; // 초 단위
  status: TranscriptionStatus;
  errorMessage?: string;
  createdAt: Timestamp;
  completedAt?: Timestamp;
  updatedAt: Timestamp;
  usageDate: string; // YYYY-MM-DD 형식
  usageSeconds: number;
}

// ==================== Subscriptions ====================

export type SubscriptionPlanType = 'basic' | 'premium' | 'enterprise';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'past_due';
export type PaymentProvider = 'stripe' | 'paypal' | 'other';

export interface SubscriptionDocument {
  userId: string;
  planType: SubscriptionPlanType;
  status: SubscriptionStatus;
  paymentProvider: PaymentProvider;
  paymentProviderId?: string;
  startDate: Timestamp;
  endDate?: Timestamp | null; // null이면 무기한
  trialEndDate?: Timestamp;
  pricePerMonth: number;
  currency: string; // "KRW", "USD" 등
  createdAt: Timestamp;
  updatedAt: Timestamp;
  cancelledAt?: Timestamp;
  cancellationReason?: string;
}

// ==================== Usage ====================

export interface UsageDocument {
  userId: string;
  date: string; // YYYY-MM-DD 형식
  accountType: AccountType;
  totalSeconds: number;
  totalMinutes: number; // 계산 필드 (totalSeconds / 60)
  dailyLimitSeconds: number; // free: 1800, premium: -1 (무제한)
  remainingSeconds: number; // free: 남은 초, premium: -1
  transcriptionCount: number;
  recordingsCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastResetAt: Timestamp;
}

// ==================== Constants ====================

export const DAILY_FREE_LIMIT_SECONDS = 1800; // 30분 = 1800초
export const DAILY_FREE_LIMIT_MINUTES = 30;

// ==================== Helper Types ====================

/**
 * 문서 ID를 포함한 타입 (조회 시 사용)
 */
export type WithId<T> = T & { id: string };

/**
 * 사용량 체크 결과
 */
export interface UsageCheckResult {
  allowed: boolean;
  remainingSeconds: number;
  totalSeconds: number;
  dailyLimitSeconds: number;
  message?: string;
}



