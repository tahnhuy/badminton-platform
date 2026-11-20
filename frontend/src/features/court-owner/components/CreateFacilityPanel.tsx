import { useState } from 'react';
import { Building2, Plus } from 'lucide-react';
import { ContentPanel } from '@/components/common/content-panel';
import { Button } from '@/components/ui/button';
import { useOwnerWorkspace } from '../hooks/owner-workspace';
import { OwnerForm } from './OwnerForm';
import { metadataFields, locationFields } from './owner-fields';
import { Feedback } from './OwnerUi';
import { useOwnerAction } from '../hooks/useOwnerAction';
import { ownerApi } from '../services/owner-api';
import type { Facility } from '../types/owner';
export function CreateFacilityPanel() {
  const workspace = useOwnerWorkspace();
  const action = useOwnerAction();
  const [open, setOpen] = useState(workspace.facilities.length === 0);
  return <ContentPanel icon={Building2}><Button variant="outline" className="h-11 self-start" onClick={() => setOpen(!open)}><Plus aria-hidden="true" />{open ? 'Đóng biểu mẫu' : 'Thêm cơ sở'}</Button>
    {open && <><h2 className="text-lg font-bold tracking-tight">Gửi cơ sở mới để duyệt</h2><p className="text-sm leading-6 text-muted-foreground">Cơ sở và sân chỉ nhận đặt sau khi Admin duyệt và đã có giá hợp lệ.</p>
      <OwnerForm fields={[...metadataFields, ...locationFields]} title="Gửi cơ sở để duyệt" busy={action.busy} submit={values => void action.run(async () => { const result = await ownerApi.write<Facility>('/facilities', values); workspace.select(result.data.id); workspace.refresh(); setOpen(false); })} />
    </>}<Feedback {...action} /></ContentPanel>;
}
