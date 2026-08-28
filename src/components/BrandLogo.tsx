import Image from "next/image";
import Link from "next/link";
import styles from "./BrandLogo.module.css";

type BrandLogoProps = {
  href?: string | null;
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  priority?: boolean;
};

const SIZES = {
  sm: 36,
  md: 44,
  lg: 64,
} as const;

export function BrandLogo({
  href = "/",
  size = "md",
  showWordmark = false,
  priority = false,
}: BrandLogoProps) {
  const px = SIZES[size];

  const content = (
    <>
      <Image
        className={styles.image}
        src="/logo.png"
        alt="Blakjac21"
        width={px}
        height={px}
        priority={priority}
      />
      {showWordmark ? <span className={styles.wordmark}>Blakjac21</span> : null}
    </>
  );

  if (href === null) {
    return <span className={`${styles.wrap} ${styles[size]}`}>{content}</span>;
  }

  return (
    <Link className={`${styles.wrap} ${styles[size]}`} href={href} aria-label="Blakjac21 home">
      {content}
    </Link>
  );
}
