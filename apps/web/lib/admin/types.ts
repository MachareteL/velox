import type { WhatsAppSessionStatus, CapturedCall, SystemLog, PushSubscriptionRecord } from '@velox/types';

export interface AdminOverviewMetrics {
  totalUsers: number;
  newUsersLast7Days: number;
  newUsersLast30Days: number;

  connectedSessions: number;
  disconnectedSessions: number;
  needQrSessions: number;
  activeAutomations: number;

  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  successRatePercentage: number;
  avgDurationMs: number;
  avgPreviaMinutes: number;
  avgDistanceKm: number;

  totalPushSubscriptions: number;
  usersWithPushCount: number;

  recentErrorLogsCount: number;
}

export interface AdminUserListItem {
  id: string;
  name: string;
  email: string;
  created_at: string;

  sessionStatus: WhatsAppSessionStatus;
  isActiveAutomation: boolean;
  phoneNumber?: string | null;
  workerId?: string | null;
  updatedAtSession?: string | null;

  totalCalls: number;
  successfulCalls: number;

  pushSubscriptionsCount: number;
  lastLogAt?: string | null;
}

export interface AdminUserDetail {
  id: string;
  name: string;
  email: string;
  created_at: string;

  session: {
    status: WhatsAppSessionStatus;
    is_active: boolean;
    qr_code?: string | null;
    phone_number?: string | null;
    pairing_code?: string | null;
    worker_id?: string | null;
    updated_at: string;
    created_at: string;
  } | null;

  pushSubscriptions: PushSubscriptionRecord[];
  recentCalls: CapturedCall[];
  recentLogs: SystemLog[];
  metrics: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    successRatePercentage: number;
    avgPreviaMinutes: number;
    avgDistanceKm: number;
  };
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  phoneNumber?: string;
}

export interface CreateUserResponse {
  success: boolean;
  user?: {
    id: string;
    name: string;
    email: string;
    created_at: string;
  };
  error?: string;
}

export interface SendTestPushPayload {
  targetTenantId: string;
  title?: string;
  body?: string;
}

export interface SendTestPushResponse {
  success: boolean;
  sentCount: number;
  failedCount: number;
  removedCount: number;
  totalSubscriptions: number;
  message?: string;
}
