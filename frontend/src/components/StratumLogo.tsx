interface StratumLogoProps {
  size?: number;
  className?: string;
}

export default function StratumLogo({ size = 32, className = "" }: StratumLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Lectly logo"
    >
      <rect width="512" height="512" rx="108" fill="#0F3D43" />
      {/* L foundation */}
      <path d="M128 96L128 416L384 416L384 352L192 352L192 96Z" fill="#FCFAF6" />
      {/* Strata layers - short to long */}
      <rect x="208" y="160" width="80" height="20" rx="4" fill="#FCFAF6" opacity="0.35" />
      <rect x="208" y="196" width="112" height="20" rx="4" fill="#FCFAF6" opacity="0.45" />
      <rect x="208" y="232" width="144" height="20" rx="4" fill="#FCFAF6" opacity="0.55" />
      {/* Amber accent layer */}
      <rect x="208" y="268" width="160" height="20" rx="4" fill="#F2A930" />
    </svg>
  );
}
