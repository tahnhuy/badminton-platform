export const ShuttlecockIcon = ({ size = 20, color = 'currentColor', className = '' }: { size?: number; color?: string; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M12 2C8.5 2 5 7 5 12C5 14.5 6 17 8 18.5V21C8 21.6 8.4 22 9 22H15C15.6 22 16 21.6 16 21V18.5C18 17 19 14.5 19 12C19 7 15.5 2 12 2Z" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M8 12H16M7 16H17M9 7L12 22M15 7L12 22" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

export const UsersIcon = ({ size = 18, color = 'currentColor', className = '' }: { size?: number; color?: string; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M16 21V19C16 16.7909 14.2091 15 12 15H6C3.79086 15 2 16.7909 2 19V21" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="9" cy="7" r="4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M22 21V19C21.9986 17.1771 20.7674 15.5857 19 15.13" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 3.13C17.7699 3.58316 19.0034 5.1764 19.0034 7.005C19.0034 8.8336 17.7699 10.4268 16 10.88" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const CourtIcon = ({ size = 18, color = 'currentColor', className = '' }: { size?: number; color?: string; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="3" y="3" width="18" height="18" rx="2" stroke={color} strokeWidth="1.5"/>
    <path d="M3 12H21M12 3V21M3 7H21M3 17H21" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

export const TournamentIcon = ({ size = 18, color = 'currentColor', className = '' }: { size?: number; color?: string; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M8 21H16M12 17V21M6 4H18V9C18 12.3137 15.3137 15 12 15C8.68629 15 6 12.3137 6 9V4Z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6 6H3C2.44772 6 2 6.44772 2 7V9C2 10.6569 3.34315 12 5 12H6M18 6H21C21.5523 6 22 6.44772 22 7V9C22 10.6569 20.6569 12 19 12H18" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const ChevronRightIcon = ({ size = 16, color = 'currentColor', className = '' }: { size?: number; color?: string; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M9 18L15 12L9 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const ArrowLeftIcon = ({ size = 18, color = 'currentColor', className = '' }: { size?: number; color?: string; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const EyeIcon = ({ size = 18, color = 'currentColor', className = '' }: { size?: number; color?: string; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M1 12C1 12 5 5 12 5C19 5 23 12 23 12C23 12 19 19 12 19C5 19 1 12 1 12Z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const EyeOffIcon = ({ size = 18, color = 'currentColor', className = '' }: { size?: number; color?: string; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 19C7 19 2.73 15.11 1 12C2.18 9.24 4.36 6.99 7.08 5.73M9.9 4.24A9.12 9.12 0 0 1 12 5C17 5 21.27 8.89 23 12A18.5 18.5 0 0 1 19.64 16.36M1 1L23 23" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9.88 9.88A3 3 0 1 0 14.12 14.12" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
