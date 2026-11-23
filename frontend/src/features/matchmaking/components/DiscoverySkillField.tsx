import { ChartNoAxesColumnIncreasing } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import type { SkillLevel } from '../types/matchmaking';

export function DiscoverySkillField({ id, value, skills, onChange }: {
  id: string;
  value: string;
  skills: SkillLevel[];
  onChange: (value: string) => void;
}) {
  const options = [
    { value: '', label: 'Tất cả trình độ' },
    ...[...skills].sort((a, b) => a.rank - b.rank).map(skill => ({ value: String(skill.id), label: skill.name })),
  ];

  return <div className="flex min-w-0 flex-col gap-1.5">
    <Label htmlFor={id} className="pl-3 text-xs font-semibold text-muted-foreground">Trình độ</Label>
    <Select
      id={id}
      value={value}
      options={options}
      placeholder="Tất cả trình độ"
      variant="ghost"
      leadingIcon={ChartNoAxesColumnIncreasing}
      className="font-semibold"
      onChange={onChange}
    />
  </div>;
}
