import { CalendarDays, MessagesSquare, UsersRound } from 'lucide-react';
import { domAnimation, LazyMotion, m } from 'motion/react';
import courtScene from '@/assets/illustrations/badminton-court.svg';
import { ShuttlecockIcon } from '@/components/common/Icons';
import { usePointerParallax } from '@/shared/hooks/use-pointer-parallax';

function CourtScene({ style }: Pick<ReturnType<typeof usePointerParallax>, 'style'>) {
  return <div aria-hidden="true" className="pointer-events-none absolute -bottom-10 -right-13 h-55 w-69 opacity-60 sm:relative sm:inset-auto sm:-mx-3 sm:mt-0 sm:h-64 sm:w-auto sm:opacity-100 min-[50.0625rem]:-mx-2.5 min-[50.0625rem]:-mt-2 min-[50.0625rem]:h-86">
    <div className="absolute inset-x-20 inset-y-8 -rotate-20 rounded-[50%] border border-brand-lime/10 ring-18 ring-brand-lime/2" />
    <LazyMotion features={domAnimation} strict>
      <m.img src={courtScene} alt="" width={720} height={480} style={style} data-slot="hero-art"
        className="relative size-full object-contain" draggable={false} />
    </LazyMotion>
    <div className="absolute bottom-11 left-12 hidden items-center gap-2 rounded-xl border border-brand-lime/20 bg-brand-moss/90 px-3 py-2.5 text-brand-mint shadow-lg backdrop-blur-sm min-[50.0625rem]:flex">
      <UsersRound className="size-4 text-brand-lime" /><span className="text-[0.625rem] leading-relaxed"><strong className="block font-semibold">Đúng bạn chơi.</strong><span className="text-[0.5rem]">Chung nhịp đam mê.</span></span>
    </div>
    <div className="absolute right-7 top-5 hidden rotate-4 items-center gap-2 rounded-xl border border-brand-lime/40 bg-brand-lime/90 px-3 py-3 text-[0.625rem] font-semibold text-brand-forest-deep shadow-lg min-[50.0625rem]:flex xl:right-10">
      <ShuttlecockIcon size={17} />Cùng nhau ra sân
    </div>
  </div>;
}

function HeroBenefits() {
  return <ul aria-label="Tiện ích SmashPro" className="absolute inset-x-8 bottom-7 hidden justify-between gap-3 border-t border-brand-lime/15 pt-5 text-[0.625rem] text-brand-mint min-[50.0625rem]:flex xl:inset-x-10">
    {[{ Icon: UsersRound, text: 'Tìm bạn chơi' }, { Icon: CalendarDays, text: 'Đặt sân' }, { Icon: MessagesSquare, text: 'Giữ kết nối' }].map(({ Icon, text }) =>
      <li key={text} className="flex items-center gap-2"><Icon aria-hidden="true" className="size-4 text-brand-lime" />{text}</li>)}
  </ul>;
}

export function SignInHero() {
  const { style, onPointerMove, onPointerLeave } = usePointerParallax();
  return <aside data-slot="sign-in-hero" onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}
    className="relative isolate min-h-63 overflow-hidden bg-brand-forest sm:grid sm:min-h-66 sm:grid-cols-[1.1fr_1fr] sm:items-center min-[50.0625rem]:block min-[50.0625rem]:min-h-180">
    <div aria-hidden="true" className="absolute inset-0 -z-2 bg-[radial-gradient(ellipse_at_45%_62%,var(--color-brand-glow),transparent_60%),linear-gradient(145deg,var(--color-brand-moss),var(--color-brand-forest-deep)_75%)]" />
    <div aria-hidden="true" className="absolute inset-0 -z-1 bg-[radial-gradient(var(--color-brand-grid)_0.7px,transparent_0.7px)] bg-size-[13px_13px] opacity-70" />
    <div className="pointer-events-none relative z-1 px-6 py-7 sm:pr-0 min-[50.0625rem]:px-8 min-[50.0625rem]:pb-0 min-[50.0625rem]:pt-10 xl:px-10">
      <p className="flex items-center gap-2 text-[0.5rem] font-semibold tracking-[0.18em] text-brand-mint">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-lime" />KẾT NỐI TỪ ĐAM MÊ
      </p>
      <h2 className="my-4 text-[2.625rem] font-bold leading-[1.08] tracking-tighter text-white sm:text-5xl min-[50.0625rem]:my-5 min-[50.0625rem]:text-6xl xl:text-7xl">
        Hẹn nhau<br />trên <span className="text-brand-lime">sân.</span>
      </h2>
      <p className="max-w-64 text-[0.625rem] leading-7 text-brand-mint min-[50.0625rem]:max-w-sm min-[50.0625rem]:text-xs xl:text-sm">
        Tìm bạn chơi, đặt sân yêu thích.<br />Cùng viết tiếp câu chuyện trên sân.
      </p>
    </div>
    <CourtScene style={style} />
    <HeroBenefits />
  </aside>;
}
