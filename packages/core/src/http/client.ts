import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import axiosRetry from 'axios-retry';

export interface HttpClientConfig {
  baseURL: string;
  token: string;
  timeout?: number;
  retries?: number;
  rateLimitPerSecond?: number;
}

export interface RateLimiter {
  acquire(): Promise<void>;
}

class TokenBucketRateLimiter implements RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;

  constructor(tokensPerSecond: number) {
    this.maxTokens = tokensPerSecond;
    this.tokens = tokensPerSecond;
    this.refillRate = tokensPerSecond;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Wait for next token
    const waitTime = Math.ceil((1 - this.tokens) * (1000 / this.refillRate));
    await new Promise((resolve) => setTimeout(resolve, waitTime));
    this.refill();
    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

export class HttpClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly response?: unknown
  ) {
    super(message);
    this.name = 'HttpClientError';
  }

  static fromAxiosError(error: AxiosError): HttpClientError {
    const statusCode = error.response?.status;
    const response = error.response?.data;

    let message = error.message;
    if (statusCode === 401) {
      message = 'Authentication failed. Please check your token.';
    } else if (statusCode === 403) {
      message = 'Access forbidden. Check your token permissions.';
    } else if (statusCode === 404) {
      message = 'Resource not found.';
    } else if (statusCode === 422) {
      message = 'Validation error.';
    } else if (statusCode === 429) {
      message = 'Rate limit exceeded. Please try again later.';
    } else if (statusCode && statusCode >= 500) {
      message = 'Server error. Please try again later.';
    }

    return new HttpClientError(message, statusCode, response);
  }
}

export function createHttpClient(config: HttpClientConfig): AxiosInstance {
  const { baseURL, token, timeout = 30000, retries = 3, rateLimitPerSecond = 10 } = config;

  const client = axios.create({
    baseURL,
    timeout,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });

  // Rate limiting
  const rateLimiter = rateLimitPerSecond > 0 ? new TokenBucketRateLimiter(rateLimitPerSecond) : null;

  // Request interceptor for rate limiting
  client.interceptors.request.use(async (requestConfig: InternalAxiosRequestConfig) => {
    if (rateLimiter) {
      await rateLimiter.acquire();
    }
    return requestConfig;
  });

  // Response interceptor for error transformation
  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      throw HttpClientError.fromAxiosError(error);
    }
  );

  // Retry configuration
  axiosRetry(client, {
    retries,
    retryDelay: (retryCount, error) => {
      // Check for Retry-After header
      const retryAfter = error.response?.headers?.['retry-after'];
      if (retryAfter) {
        return parseInt(retryAfter, 10) * 1000;
      }
      // Exponential backoff
      return Math.pow(2, retryCount) * 1000;
    },
    retryCondition: (error) => {
      // Retry on network errors, 429, and 5xx
      return (
        axiosRetry.isNetworkOrIdempotentRequestError(error) ||
        error.response?.status === 429 ||
        (error.response?.status !== undefined && error.response.status >= 500)
      );
    },
  });

  return client;
}

export type { AxiosInstance };
