import { useState } from 'react';
import { Building2, Plus } from 'lucide-react';
import { ContentPanel } from '@/components/common/content-panel';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useOwnerWorkspace } from '../hooks/owner-workspace';
import { OwnerForm } from './OwnerForm';
import { metadataFields, locationFields } from './owner-fields';
import { Feedback } from './OwnerUi';
import { useOwnerAction } from '../hooks/useOwnerAction';
import { ownerApi } from '../services/owner-api';
import type { Facility } from '../types/owner';

const HINT = 'Cơ sở và sân chỉ nhận đặt sau khi Admin duyệt và đã có giá hợp lệ.';

/** Submit form shared by the inline first-facility panel and the "Thêm cơ sở" drawer. */
function CreateFacilityForm({ onCreated }: { onCreated: () => void }) {
  const workspace = useOwnerWorkspace();
  const action = useOwnerAction();
  return <>
    <OwnerForm fields={[...metadataFields, ...locationFields]} title="Gửi cơ sở để duyệt" busy={action.busy} submit={values => void action.run(async () => { const result = await ownerApi.write<Facility>('/facilities', values); workspace.select(result.data.id); workspace.refresh(); onCreated(); })} />
    <Feedback {...action} />
  </>;
}

/** First-facility onboarding, shown inline while the Owner has no facility (no drawer to dismiss before sign-out). */
export function CreateFacilityPanel() {
  const [open, setOpen] = useState(true);
  return <ContentPanel icon={Building2}><Button variant="outline" className="h-11 self-start" onClick={() => setOpen(!open)}><Plus aria-hidden="true" />{open ? 'Đóng biểu mẫu' : 'Thêm cơ sở'}</Button>
    {open && <><h2 className="text-lg font-bold tracking-tight">Gửi cơ sở mới để duyệt</h2><p className="text-sm leading-6 text-muted-foreground">{HINT}</p><CreateFacilityForm onCreated={() => setOpen(false)} /></>}
  </ContentPanel>;
}

/** Page-header action for Owners who already have facilities: same form, opened in a side drawer. */
export function CreateFacilityAction() {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button type="button" variant="outline" className="h-11"><Plus aria-hidden="true" />Thêm cơ sở</Button></DialogTrigger>
    <DialogContent variant="side" className="flex flex-col gap-5" onInteractOutside={event => event.preventDefault()}>
      <DialogTitle>Gửi cơ sở mới để duyệt</DialogTitle>
      <DialogDescription>{HINT}</DialogDescription>
      <CreateFacilityForm onCreated={() => setOpen(false)} />
    </DialogContent>
  </Dialog>;
}
