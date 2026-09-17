import type { OrderStatus, PaymentStatus, ReturnStatus } from './constants';

// Allowed transitions. Anything not listed is an invalid transition and the
// API must reject it — this is enforced in OrdersService/PaymentsService.

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['PAYMENT_FAILED', 'CONFIRMED', 'CANCELLED'],
  PAYMENT_FAILED: ['PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY', 'RETURN_REQUESTED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'RETURN_REQUESTED'],
  DELIVERED: ['RETURN_REQUESTED'],
  CANCELLED: ['REFUNDED'],
  RETURN_REQUESTED: ['RETURNED', 'DELIVERED' /* return rejected */],
  RETURNED: ['REFUNDED'],
  REFUNDED: [],
};

export const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  CREATED: ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'],
  PENDING: ['SUCCESS', 'FAILED', 'CANCELLED'],
  SUCCESS: ['REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED'],
  FAILED: ['PENDING' /* retry */],
  CANCELLED: [],
  REFUND_PENDING: ['PARTIALLY_REFUNDED', 'REFUNDED', 'SUCCESS' /* refund failed, back to paid */],
  PARTIALLY_REFUNDED: ['REFUND_PENDING', 'REFUNDED'],
  REFUNDED: [],
};

export const RETURN_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  REQUESTED: ['APPROVED', 'REJECTED'],
  APPROVED: ['RECEIVED', 'REJECTED'],
  REJECTED: [],
  RECEIVED: ['REFUND_PROCESSING', 'COMPLETED'],
  REFUND_PROCESSING: ['COMPLETED'],
  COMPLETED: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionReturn(from: ReturnStatus, to: ReturnStatus): boolean {
  return RETURN_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Order statuses a customer may cancel from (before shipping). */
export const CUSTOMER_CANCELLABLE: OrderStatus[] = [
  'PENDING_PAYMENT',
  'PAYMENT_FAILED',
  'CONFIRMED',
  'PROCESSING',
  'PACKED',
];

/** Order statuses eligible for a return request. */
export const RETURN_ELIGIBLE: OrderStatus[] = ['DELIVERED'];
