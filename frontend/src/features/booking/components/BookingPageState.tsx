import type { ComponentProps } from 'react';
import { PageContainer, PageHeader } from '@/components/common/page-layout';
import { StateBlock } from './StateBlocks';

/** Keep a page landmark/title while the existing booking controller loads or reports an error. */
export function BookingPageState(props: ComponentProps<typeof StateBlock>) {
  return <PageContainer><PageHeader title="Đặt sân" /><StateBlock {...props} /></PageContainer>;
}
