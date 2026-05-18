/**
 * Shared error taxonomy. Every thrown error at a package boundary should extend one of these
 * so UI can render a useful user-facing message (per CLAUDE.md section 10).
 */

export type ErrorCode =
  | 'not_authenticated'
  | 'not_authorized'
  | 'tier_required'
  | 'feature_disabled'
  | 'tenant_mismatch'
  | 'rate_limited'
  | 'validation_failed'
  | 'upstream_unavailable'
  | 'agent_failed'
  | 'payment_failed'
  | 'document_too_large'
  | 'not_found'
  | 'conflict'
  | 'internal';

export class AppError extends Error {
  code: ErrorCode;
  userFacing: string;
  httpStatus: number;
  cause?: unknown;

  constructor(args: {
    code: ErrorCode;
    message: string;
    userFacing: string;
    httpStatus: number;
    cause?: unknown;
  }) {
    super(args.message);
    this.name = 'AppError';
    this.code = args.code;
    this.userFacing = args.userFacing;
    this.httpStatus = args.httpStatus;
    this.cause = args.cause;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.userFacing,
    };
  }
}

export const errors = {
  notAuthenticated: (userFacing = 'Please sign in to continue.') =>
    new AppError({ code: 'not_authenticated', message: 'no session', userFacing, httpStatus: 401 }),

  notAuthorized: (userFacing = 'You do not have access to this.') =>
    new AppError({ code: 'not_authorized', message: 'forbidden', userFacing, httpStatus: 403 }),

  tierRequired: (tier: string, userFacing = `This feature requires an upgraded plan.`) =>
    new AppError({
      code: 'tier_required',
      message: `tier required: ${tier}`,
      userFacing,
      httpStatus: 402,
    }),

  featureDisabled: (key: string, userFacing = 'This feature is not available right now.') =>
    new AppError({
      code: 'feature_disabled',
      message: `feature flag disabled: ${key}`,
      userFacing,
      httpStatus: 404,
    }),

  rateLimited: (userFacing = 'Too many requests. Please try again in a moment.') =>
    new AppError({ code: 'rate_limited', message: 'rate limited', userFacing, httpStatus: 429 }),

  validationFailed: (userFacing: string, cause?: unknown) =>
    new AppError({
      code: 'validation_failed',
      message: userFacing,
      userFacing,
      httpStatus: 400,
      cause,
    }),

  agentFailed: (userFacing = 'Our assistant couldn’t complete this step. We’ve logged it.') =>
    new AppError({ code: 'agent_failed', message: 'agent error', userFacing, httpStatus: 502 }),

  notFound: (userFacing = 'That record was not found.') =>
    new AppError({ code: 'not_found', message: 'not found', userFacing, httpStatus: 404 }),
};
