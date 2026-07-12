/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { randomUUID } from 'crypto';
import { validateTenantResource, validateResourceTenant } from '../server/middleware';

describe('Multi-tenant Isolation', () => {
  describe('validateTenantResource', () => {
    it('returns true when resource tenantId matches user tenantId', () => {
      const resource = { tenantId: 'clinic-a', name: 'Patient A' };
      const result = validateTenantResource(resource, 'clinic-a');
      expect(result).toBe(true);
    });

    it('returns false when resource tenantId differs from user tenantId', () => {
      const resource = { tenantId: 'clinic-a', name: 'Patient A' };
      const result = validateTenantResource(resource, 'clinic-b');
      expect(result).toBe(false);
    });

    it('returns false when user tenantId is undefined', () => {
      const resource = { tenantId: 'clinic-a', name: 'Patient A' };
      const result = validateTenantResource(resource, undefined);
      expect(result).toBe(false);
    });

    it('returns false when resource is null', () => {
      const result = validateTenantResource(null, 'clinic-a');
      expect(result).toBe(false);
    });

    it('returns false when resource tenantId is null/undefined', () => {
      const resource = { name: 'Patient A' };
      const result = validateTenantResource(resource, 'clinic-a');
      expect(result).toBe(false);
    });
  });

  describe('validateResourceOwnership', () => {
    it('returns true when both IDs match', () => {
      const resourceTenantId = 'clinic-a';
      const userTenantId = 'clinic-a';
      const result = validateResourceTenant(resourceTenantId, userTenantId);
      expect(result).toBe(true);
    });

    it('returns false when IDs differ', () => {
      const resourceTenantId = 'clinic-a';
      const userTenantId = 'clinic-b';
      const result = validateResourceTenant(resourceTenantId, userTenantId);
      expect(result).toBe(false);
    });

    it('returns false when userTenantId is undefined', () => {
      const resourceTenantId = 'clinic-a';
      const userTenantId = undefined;
      const result = validateResourceTenant(resourceTenantId, userTenantId);
      expect(result).toBe(false);
    });

    it('returns false when resourceTenantId is undefined', () => {
      const resourceTenantId = undefined;
      const userTenantId = 'clinic-a';
      const result = validateResourceTenant(resourceTenantId, userTenantId);
      expect(result).toBe(false);
    });
  });

  describe('Cross-tenant access prevention', () => {
    it('patient from clinic A should not see clinic B resources', () => {
      // Simulate clinic A patient
      const clinicAPatient = {
        id: randomUUID(),
        fullName: 'Patient A',
        tenantId: 'clinic-a',
        birthDate: '1990-01-01',
        lgpdConsent: true,
        lgpdConsentAt: new Date().toISOString(),
      };

      // Simulate clinic B patient
      const clinicBPatient = {
        id: randomUUID(),
        fullName: 'Patient B',
        tenantId: 'clinic-b',
        birthDate: '1990-02-02',
        lgpdConsent: true,
        lgpdConsentAt: new Date().toISOString(),
      };

      // Clinic A user tries to access Clinic B patient
      const isAccessAllowed = validateTenantResource(clinicBPatient, 'clinic-a');
      expect(isAccessAllowed).toBe(false);

      // Clinic A user accessing own patient should be allowed
      const isOwnAccessAllowed = validateTenantResource(clinicAPatient, 'clinic-a');
      expect(isOwnAccessAllowed).toBe(true);
    });

    it('should filter patients by tenant correctly', () => {
      const patients = [
        { id: '1', fullName: 'Patient A', tenantId: 'clinic-a' },
        { id: '2', fullName: 'Patient B', tenantId: 'clinic-b' },
        { id: '3', fullName: 'Patient C', tenantId: 'clinic-a' },
        { id: '4', fullName: 'Patient D', tenantId: 'clinic-b' },
      ];

      const clinicAPatients = patients.filter(p => validateTenantResource(p, 'clinic-a'));
      expect(clinicAPatients).toHaveLength(2);
      expect(clinicAPatients.map(p => p.id)).toEqual(['1', '3']);

      const clinicBPatients = patients.filter(p => validateTenantResource(p, 'clinic-b'));
      expect(clinicBPatients).toHaveLength(2);
      expect(clinicBPatients.map(p => p.id)).toEqual(['2', '4']);
    });

    it('super_admin should only see resources from their assigned tenant', () => {
      const appointments = [
        { id: '1', patientName: 'Patient A', tenantId: 'clinic-a', doctorId: 'doc1', date: '2026-07-15' },
        { id: '2', patientName: 'Patient B', tenantId: 'clinic-b', doctorId: 'doc2', date: '2026-07-16' },
        { id: '3', patientName: 'Patient C', tenantId: 'clinic-a', doctorId: 'doc1', date: '2026-07-17' },
      ];

      // Super admin for clinic A
      const superAdminClincAAppointments = appointments.filter(
        a => validateTenantResource(a, 'clinic-a')
      );
      expect(superAdminClincAAppointments).toHaveLength(2);
      expect(superAdminClincAAppointments.map(a => a.id)).toEqual(['1', '3']);
    });
  });

  describe('Edge cases', () => {
    it('handles empty tenantId strings', () => {
      const resource = { tenantId: '', name: 'Patient' };
      const result = validateTenantResource(resource, '');
      expect(result).toBe(false); // empty strings should not match
    });

    it('handles special characters in tenantId', () => {
      const resource = { tenantId: 'clinic-a@#$', name: 'Patient' };
      const result = validateTenantResource(resource, 'clinic-a@#$');
      expect(result).toBe(true);
    });

    it('is case-sensitive for tenantId comparison', () => {
      const resource = { tenantId: 'clinic-a', name: 'Patient' };
      const result = validateTenantResource(resource, 'CLINIC-A');
      expect(result).toBe(false);
    });
  });
});
