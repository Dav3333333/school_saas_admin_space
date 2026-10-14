export type AdminRole = 'super_admin' | 'tenant_admin';

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  tenantId: number | null;
  school_id?: number | null;
  roles: string[];
  permissions: string[];
}

export interface PageResult<T> {
  data: T[];
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface Tenant {
  id: number;
  name: string;
  domain: string | null;
}

export interface School {
  id: number;
  tenantId: number;
  name: string;
  address: string | null;
  tenant?: Pick<Tenant, 'id' | 'name'>;
}

export interface Subscription {
  id: number;
  tenantId: number;
  plan: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  tenant: Pick<Tenant, 'id' | 'name'>;
}

export interface ModuleAccess {
  tenantId: number;
  tenantName: string;
  moduleName: 'Academic' | 'Communication' | 'Exams' | 'Finance';
  status: 'active' | 'suspended';
  inherited: boolean;
}

export interface PlatformBillingConfig {
  id: number;
  studentUnitPrice: string;
  agentUnitPrice: string;
  currency: string;
  updatedAt: string;
}

export interface SaasInvoice {
  id: number;
  tenantId: number;
  periodStart: string;
  periodEnd: string;
  studentCount: number;
  agentCount: number;
  studentUnitPrice: string;
  agentUnitPrice: string;
  totalAmount: string;
  currency: string;
  status: string;
  tenant: Pick<Tenant, 'id' | 'name'>;
}

export interface Agent {
  id: number;
  firstName: string;
  lastName: string;
  status: string;
  schoolId: number;
  user?: { id: number; name: string; email: string };
}

export interface ApiError extends Error {
  status?: number;
}
