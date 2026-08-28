import styles from "./SlotThumbnail.module.css";

type SlotThumbnailProps = {
  name: string;
  thumbnailUrl: string | null;
  size?: "sm" | "md";
};

export function SlotThumbnail({
  name,
  thumbnailUrl,
  size = "sm",
}: SlotThumbnailProps) {
  if (thumbnailUrl) {
    return (
      <img
        className={`${styles.thumb} ${size === "md" ? styles.md : styles.sm}`}
        src={thumbnailUrl}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <span
      className={`${styles.placeholder} ${size === "md" ? styles.md : styles.sm}`}
      aria-hidden
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
