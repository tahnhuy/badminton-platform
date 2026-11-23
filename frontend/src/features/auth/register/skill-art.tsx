import { useId, type ReactNode } from 'react';
import { m, useReducedMotion } from 'motion/react';

/*
 * Vector illustrations for the technique questions (port of prototype v3 `skill-art.js`).
 * Side view (court, net, player, shuttle path) or top view for footwork and doubles.
 * Paths are drawn with Motion; SMIL moves the shuttle/players. Under reduced motion
 * nothing animates and the full static drawing is shown. Keyed by question id with a
 * generic fallback for unknown ids. Requires a LazyMotion ancestor.
 */

const FLOOR = 128;

function useArtId(prefix: string) {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

function Figure({ x, lean = 0, jump = 0, crouch = 0, mirror = false, racketUp = true }:
  { x: number; lean?: number; jump?: number; crouch?: number; mirror?: boolean; racketUp?: boolean }) {
  const feet = FLOOR - jump;
  const hip = feet - 24 + crouch;
  const shoulder = hip - 20;
  const head = shoulder - 9;
  const dir = mirror ? -1 : 1;
  const hand = racketUp ? [x + 10 * dir, shoulder - 14] : [x + 14 * dir, shoulder + 6];
  const tip = racketUp ? [hand[0] + 4 * dir, hand[1] - 14] : [hand[0] + 14 * dir, hand[1] - 4];
  return <g transform={`rotate(${lean} ${x} ${feet})`} className="fill-none stroke-primary-foreground/95 [stroke-linecap:round]">
    <circle cx={x} cy={head} r={6} strokeWidth={3.4} className="fill-primary-foreground/95" />
    <path strokeWidth={3.4} d={`M${x} ${shoulder} L${x} ${hip} M${x} ${hip} L${x - 8} ${feet} M${x} ${hip} L${x + 9} ${feet} M${x} ${shoulder + 3} L${hand[0]} ${hand[1]} M${x} ${shoulder + 4} L${x - 9 * dir} ${shoulder + 14}`} />
    <path strokeWidth={2.4} className="stroke-brand-lime" d={`M${hand[0]} ${hand[1]} L${tip[0]} ${tip[1]}`} />
    <ellipse cx={tip[0]} cy={tip[1]} rx={4.5} ry={6} strokeWidth={2} className="stroke-brand-lime"
      transform={`rotate(${racketUp ? 15 * dir : 70 * dir} ${tip[0]} ${tip[1]})`} />
  </g>;
}

function Court() {
  return <g>
    <path d={`M14 ${FLOOR} H306`} strokeWidth={2} className="stroke-brand-lime/55" />
    <path d={`M14 ${FLOOR} H306 L296 ${FLOOR + 10} H24 Z`} className="fill-brand-lime/7" />
    <path d={`M160 ${FLOOR} V86`} strokeWidth={2.5} className="stroke-brand-mint" />
    <path d="M156 86 H164" strokeWidth={3} className="stroke-primary-foreground [stroke-linecap:round]" />
    <path d="M157 92 H163 M157 99 H163 M157 106 H163 M157 113 H163 M157 120 H163" strokeWidth={1} className="stroke-brand-mint/35" />
  </g>;
}

function Label({ x, y, children, middle = false }: { x: number; y: number; children: ReactNode; middle?: boolean }) {
  return <text x={x} y={y} fontSize={10} fontWeight={600} letterSpacing="0.04em" textAnchor={middle ? 'middle' : undefined} className="fill-brand-mint">{children}</text>;
}

function Shot({ d, delay = 0.35, dur = 1.4, ghost = false, label }:
  { d: string; delay?: number; dur?: number; ghost?: boolean; label?: [number, number, string] }) {
  const reduce = useReducedMotion();
  const id = useArtId('traj');
  return <>
    {ghost
      ? <m.path id={id} d={d} pathLength={1} strokeWidth={1.6} strokeDasharray="0.02 0.025" className="fill-none stroke-brand-lime/50 [stroke-linecap:round]"
        initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay, duration: 0.7 }} />
      : <m.path id={id} d={d} strokeWidth={2.6} className="fill-none stroke-brand-lime [stroke-linecap:round]"
        initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay, duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }} />}
    {/* Moving shuttle: only with motion, hidden until its first SMIL run starts (it would sit at the SVG origin before). */}
    {!ghost && !reduce && <g data-slot="shuttle" opacity={0}>
      <circle r={4.2} className="fill-primary-foreground" />
      <path d="M-3 -2 L-9 -6 M-3 2 L-9 6 M-4 0 L-11 0" strokeWidth={1.6} className="stroke-primary-foreground [stroke-linecap:round]" />
      <set attributeName="opacity" to="1" begin={`${delay}s`} fill="freeze" />
      <animateMotion id={`${id}loop`} dur={`${dur}s`} begin={`${delay}s;${id}loop.end+1.2s`} rotate="auto" fill="freeze"><mpath href={`#${id}`} /></animateMotion>
    </g>}
    {label && <Label x={label[0]} y={label[1]}>{label[2]}</Label>}
  </>;
}

/** Without SMIL the shuttle would sit at the origin, so under reduced motion it is placed at the path end. */
function StaticShuttle({ x, y }: { x: number; y: number }) {
  const reduce = useReducedMotion();
  if (!reduce) return null;
  return <circle data-slot="shuttle" cx={x} cy={y} r={4.2} className="fill-primary-foreground" />;
}

function Landing({ x }: { x: number }) {
  const reduce = useReducedMotion();
  return <m.ellipse cx={x} cy={FLOOR - 1} rx={10} ry={2.6} className="fill-brand-lime/35"
    initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2, duration: 0.6 }} />;
}

function Footwork() {
  const reduce = useReducedMotion();
  const id = useArtId('fw');
  const points = [[78, 30], [242, 30], [78, 80], [242, 80], [78, 130], [242, 130]];
  return <>
    <rect x={60} y={16} width={200} height={128} rx={4} strokeWidth={2} className="fill-brand-lime/7 stroke-brand-lime/55" />
    <path d="M60 58 H260 M160 16 V144 M60 120 H260" strokeWidth={1.4} className="fill-none stroke-brand-lime/30" />
    {points.map(([x, y]) => <g key={`${x}-${y}`}>
      <path d={`M160 80 L${x} ${y}`} pathLength={1} strokeWidth={1.6} strokeDasharray="0.02 0.025" className="fill-none stroke-brand-lime/50" />
      <circle cx={x} cy={y} r={5} strokeWidth={2} className="fill-none stroke-brand-lime" />
    </g>)}
    <circle cx={160} cy={80} r={7} strokeWidth={2} className="fill-primary-foreground/25 stroke-primary-foreground" />
    <path id={id} d="M160 80 L78 30 L160 80 L242 30 L160 80 L242 130 L160 80 L78 130 L160 80" className="fill-none stroke-none" />
    {reduce
      ? <circle cx={242} cy={30} r={6} className="fill-brand-lime" />
      : <circle r={6} className="fill-brand-lime"><animateMotion dur="5.6s" begin="0.3s" repeatCount="indefinite"><mpath href={`#${id}`} /></animateMotion></circle>}
    <Label x={160} y={158} middle>bao 6 góc sân · hồi về trung tâm</Label>
  </>;
}

function DoublesPlayer({ cy, toX, className }: { cy: number; toX: number; className: string }) {
  const reduce = useReducedMotion();
  return <circle r={11} cx={160} cy={cy} strokeWidth={3} className={`stroke-brand-forest ${className}`}>
    {!reduce && <>
      <animate attributeName="cx" values={`160;${toX};${toX};160;160`} keyTimes="0;.2;.5;.7;1" dur="5s" repeatCount="indefinite" />
      <animate attributeName="cy" values={`${cy};88;88;${cy};${cy}`} keyTimes="0;.2;.5;.7;1" dur="5s" repeatCount="indefinite" />
    </>}
  </circle>;
}

function Doubles() {
  return <>
    <rect x={70} y={22} width={180} height={120} rx={4} strokeWidth={2} className="fill-brand-lime/7 stroke-brand-lime/55" />
    <path d="M62 22 H258" strokeWidth={4} className="stroke-primary-foreground [stroke-linecap:round]" />
    <path d="M70 50 H250 M160 50 V142" strokeWidth={1.4} className="fill-none stroke-brand-lime/30" />
    <DoublesPlayer cy={52} toX={118} className="fill-brand-lime" />
    <DoublesPlayer cy={116} toX={202} className="fill-primary-foreground" />
    <Label x={160} y={160} middle>tấn công trên–dưới ⇄ phòng thủ hai bên</Label>
  </>;
}

const SIDE_ART: Partial<Record<string, () => ReactNode>> = {
  'skill.service': () => <><Court /><Figure x={58} /><Shot d="M72 98 Q130 58 186 126" label={[178, 118, 'ngắn']} />
    <Shot d="M72 98 Q186 -12 298 126" delay={1.2} ghost label={[262, 116, 'cao sâu']} /><StaticShuttle x={186} y={124} /><Landing x={186} /><Landing x={298} /></>,
  'skill.clear': () => <><Court /><Figure x={40} jump={8} /><Shot d="M52 58 Q172 -34 298 126" dur={1.6} /><StaticShuttle x={296} y={124} /><Landing x={296} /></>,
  'skill.smash': () => <><Court /><Figure x={92} jump={16} lean={6} /><Shot d="M104 34 L222 126" dur={0.8} /><StaticShuttle x={222} y={124} /><Landing x={222} /></>,
  'skill.netPlay': () => <><Court /><Figure x={126} lean={14} racketUp={false} /><Shot d="M144 104 Q158 74 174 126" dur={1} /><StaticShuttle x={174} y={124} /><Landing x={174} /></>,
  'skill.defense': () => <><Court /><Figure x={62} crouch={8} racketUp={false} /><Shot d="M262 28 L84 108" ghost delay={0.1} />
    <Shot d="M78 106 Q178 -24 296 126" delay={0.6} dur={1.6} /><StaticShuttle x={296} y={124} /><Landing x={296} /></>,
  'skill.drive': () => <><Court /><Figure x={108} racketUp={false} /><Shot d="M124 82 L300 94" dur={0.7} /><StaticShuttle x={298} y={94} /></>,
  'skill.backhand': () => <><Court /><Figure x={44} mirror lean={-8} /><Shot d="M36 66 Q160 6 272 126" dur={1.5} label={[22, 40, 'trái tay']} /><StaticShuttle x={272} y={124} /><Landing x={272} /></>,
};

const TOP_ART: Partial<Record<string, () => ReactNode>> = {
  'skill.footwork': () => <Footwork />,
  'skill.doublesPlay': () => <Doubles />,
};

/** Generic rally for a skill without its own drawing. */
const FALLBACK_ART = () => <><Court /><Figure x={70} /><Shot d="M84 90 Q170 10 270 126" /><StaticShuttle x={270} y={124} /><Landing x={270} /></>;

export function SkillArt({ questionId }: { questionId: string }) {
  const top = TOP_ART[questionId];
  const body = top ?? SIDE_ART[questionId] ?? FALLBACK_ART;
  return <svg data-slot="skill-art" viewBox={top ? '0 0 320 166' : '0 0 320 150'} aria-hidden="true" focusable="false"
    className="relative z-1 h-auto w-full max-w-75 overflow-visible lg:max-w-90">
    {body()}
  </svg>;
}
