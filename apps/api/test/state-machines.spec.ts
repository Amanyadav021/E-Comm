import {
  canTransitionOrder,
  canTransitionPayment,
  canTransitionReturn,
  CUSTOMER_CANCELLABLE,
  ORDER_STATUSES,
} from '@shopcraft/shared';

describe('order state machine', () => {
  it('follows the happy path', () => {
    const path = ['PENDING_PAYMENT', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const;
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransitionOrder(path[i], path[i + 1])).toBe(true);
    }
  });

  it('rejects skipping fulfilment steps', () => {
    expect(canTransitionOrder('CONFIRMED', 'DELIVERED')).toBe(false);
    expect(canTransitionOrder('PENDING_PAYMENT', 'SHIPPED')).toBe(false);
    expect(canTransitionOrder('PROCESSING', 'OUT_FOR_DELIVERY')).toBe(false);
  });

  it('rejects moving backwards or resurrecting terminal states', () => {
    expect(canTransitionOrder('DELIVERED', 'PROCESSING')).toBe(false);
    expect(canTransitionOrder('REFUNDED', 'CONFIRMED')).toBe(false);
    expect(canTransitionOrder('CANCELLED', 'PROCESSING')).toBe(false);
  });

  it('supports the return flow', () => {
    expect(canTransitionOrder('DELIVERED', 'RETURN_REQUESTED')).toBe(true);
    expect(canTransitionOrder('RETURN_REQUESTED', 'RETURNED')).toBe(true);
    expect(canTransitionOrder('RETURNED', 'REFUNDED')).toBe(true);
    expect(canTransitionOrder('RETURN_REQUESTED', 'DELIVERED')).toBe(true); // rejection path
  });

  it('customer cancellation window closes at shipping', () => {
    expect(CUSTOMER_CANCELLABLE).toContain('PROCESSING');
    expect(CUSTOMER_CANCELLABLE).toContain('PACKED');
    expect(CUSTOMER_CANCELLABLE).not.toContain('SHIPPED');
    expect(CUSTOMER_CANCELLABLE).not.toContain('DELIVERED');
  });

  it('every status has a defined transition list', () => {
    for (const status of ORDER_STATUSES) {
      // canTransitionOrder must not throw for any known state
      expect(() => canTransitionOrder(status, 'DELIVERED')).not.toThrow();
    }
  });
});

describe('payment state machine', () => {
  it('happy path and retry', () => {
    expect(canTransitionPayment('CREATED', 'PENDING')).toBe(true);
    expect(canTransitionPayment('PENDING', 'SUCCESS')).toBe(true);
    expect(canTransitionPayment('PENDING', 'FAILED')).toBe(true);
    expect(canTransitionPayment('FAILED', 'PENDING')).toBe(true); // retry
  });

  it('refund lifecycle', () => {
    expect(canTransitionPayment('SUCCESS', 'REFUND_PENDING')).toBe(true);
    expect(canTransitionPayment('REFUND_PENDING', 'REFUNDED')).toBe(true);
    expect(canTransitionPayment('SUCCESS', 'PARTIALLY_REFUNDED')).toBe(true);
    expect(canTransitionPayment('PARTIALLY_REFUNDED', 'REFUNDED')).toBe(true);
  });

  it('a failed payment can never be marked successful directly', () => {
    expect(canTransitionPayment('FAILED', 'SUCCESS')).toBe(false);
    expect(canTransitionPayment('CANCELLED', 'SUCCESS')).toBe(false);
    expect(canTransitionPayment('REFUNDED', 'SUCCESS')).toBe(false);
  });
});

describe('return state machine', () => {
  it('follows request → approve → receive → refund → complete', () => {
    expect(canTransitionReturn('REQUESTED', 'APPROVED')).toBe(true);
    expect(canTransitionReturn('APPROVED', 'RECEIVED')).toBe(true);
    expect(canTransitionReturn('RECEIVED', 'REFUND_PROCESSING')).toBe(true);
    expect(canTransitionReturn('REFUND_PROCESSING', 'COMPLETED')).toBe(true);
  });

  it('rejected and completed are terminal', () => {
    expect(canTransitionReturn('REJECTED', 'APPROVED')).toBe(false);
    expect(canTransitionReturn('COMPLETED', 'REQUESTED')).toBe(false);
  });

  it('cannot skip receiving the items before refunding', () => {
    expect(canTransitionReturn('REQUESTED', 'COMPLETED')).toBe(false);
    expect(canTransitionReturn('APPROVED', 'REFUND_PROCESSING')).toBe(false);
  });
});
