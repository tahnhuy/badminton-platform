import type { Page, Route } from '@playwright/test';
import { account, mockAuthApi } from './auth-ui-mocks';
import type { Facility } from '../src/features/court-owner/types/owner';

export const ownedFacility = (id: number, name = `Cơ sở ${id}`): Facility => ({
  id, name, description: 'Cơ sở cầu lông', phone: '0900000000', address: `${id} Đường Mẫu`, ward: null,
  district: 'Quận 7', city: 'Hồ Chí Minh', openingTime: '06:00', closingTime: '23:00',
  status: 'ACTIVE', updatedAt: '2026-11-01T00:00:00Z', courts: [],
});
export const ownerFacilities = [ownedFacility(11), ownedFacility(22, 'Cơ sở thứ hai với tên dài để kiểm tra bố cục')];
export type OwnerHandler = (route: Route) => Promise<void> | void;
export async function mockOwnerUi(page: Page, handlers: Record<string, OwnerHandler> = {}, facilities = ownerFacilities) {
  let ownerProfile = { businessName: 'CLB Chủ sân mẫu', phone: '0901234567', updatedAt: '2026-11-01T00:00:00Z' };
  return mockAuthApi(page, { user: { ...account('COURT_OWNER'), email: 'owner@example.test' }, handlers: {
    '/api/v1/owner/profile': route => {
      if (route.request().method() === 'PATCH') ownerProfile = { ...ownerProfile, phone: String(route.request().postDataJSON().phone).replace(/[ ()-]/g, '') };
      return route.fulfill({ json: { data: ownerProfile } });
    },
    '/api/v1/owner/facilities': route => route.fulfill({ json: { data: facilities, meta: { page: 1, totalPages: 1, limit: 100, total: facilities.length } } }),
    ...Object.fromEntries(facilities.map(facility => [`/api/v1/owner/facilities/${facility.id}`, (route: Route) => route.fulfill({ json: { data: facility } })])),
    ...handlers,
  } });
}
