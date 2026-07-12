/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { generateTokens, verifyToken } from '../server/auth';

describe('JWT Authentication', () => {
  describe('JWT token generation and verification', () => {
    it('generates valid JWT tokens', () => {
      const user = { id: 'test-user-1', name: 'Test User', role: 'admin' as const, tenantId: 'clinic-a' };
      const { token, refreshToken, expiresAt } = generateTokens(user);
      
      expect(token).toBeDefined();
      expect(refreshToken).toBeDefined();
      expect(expiresAt).toBeDefined();
      expect(typeof token).toBe('string');
      expect(typeof refreshToken).toBe('string');
      expect(typeof expiresAt).toBe('number');
    });

    it('verifies valid JWT token', () => {
      const user = { id: 'test-user-1', name: 'Test User', role: 'admin' as const, tenantId: 'clinic-a' };
      const { token } = generateTokens(user);
      
      const verified = verifyToken(token);
      expect(verified).toBeDefined();
      expect(verified?.id).toBe(user.id);
      expect(verified?.name).toBe(user.name);
      expect(verified?.role).toBe(user.role);
      expect(verified?.tenantId).toBe(user.tenantId);
    });

    it('rejects invalid JWT tokens', () => {
      const invalidToken = 'invalid.token.here';
      const verified = verifyToken(invalidToken);
      expect(verified).toBeNull();
    });

    it('verifies token immediately after generation', () => {
      const user = { id: 'test-user-1', name: 'Test User', role: 'admin' as const, tenantId: 'clinic-a' };
      const { token } = generateTokens(user);
      
      const verified = verifyToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.id).toBe(user.id);
    });

    it('preserves all user fields in token', () => {
      const user = {
        id: 'user-123',
        name: 'Dr. Silva',
        role: 'doctor' as const,
        specialty: 'Cardiologia',
        tenantId: 'clinic-xyz',
      };
      const { token } = generateTokens(user);
      
      const verified = verifyToken(token);
      expect(verified).toBeDefined();
      expect(verified?.id).toBe(user.id);
      expect(verified?.name).toBe(user.name);
      expect(verified?.role).toBe(user.role);
      expect(verified?.tenantId).toBe(user.tenantId);
      expect(verified?.specialty).toBe(user.specialty);
    });
  });

  describe('JWT token format', () => {
    it('token has correct JWT structure (3 parts)', () => {
      const user = { id: 'test-user-1', name: 'Test User', role: 'admin' as const };
      const { token } = generateTokens(user);
      
      const parts = token.split('.');
      expect(parts.length).toBe(3);
      expect(parts[0]).toBeDefined();
      expect(parts[1]).toBeDefined();
      expect(parts[2]).toBeDefined();
    });
  });

  describe('Multi-tenant JWT claims', () => {
    it('includes tenantId in token for multi-tenant isolation', () => {
      const userClinicA = { id: 'user-a', name: 'User A', role: 'admin' as const, tenantId: 'clinic-a' };
      const userClinicB = { id: 'user-b', name: 'User B', role: 'admin' as const, tenantId: 'clinic-b' };
      
      const tokenA = generateTokens(userClinicA).token;
      const tokenB = generateTokens(userClinicB).token;
      
      const verifiedA = verifyToken(tokenA);
      const verifiedB = verifyToken(tokenB);
      
      expect(verifiedA?.tenantId).toBe('clinic-a');
      expect(verifiedB?.tenantId).toBe('clinic-b');
      expect(verifiedA?.tenantId).not.toBe(verifiedB?.tenantId);
    });

    it('super_admin user without tenantId', () => {
      const superAdmin = { id: 'super-1', name: 'Super Admin', role: 'super_admin' as const };
      const { token } = generateTokens(superAdmin);
      
      const verified = verifyToken(token);
      expect(verified?.id).toBe('super-1');
      expect(verified?.role).toBe('super_admin');
      // tenantId may be undefined for super_admin
    });
  });
});
