import Link from "next/link";
import styles from "./HomeQuickLinks.module.css";

type QuickLink = {
  href: string;
  label: string;
  description: string;
  accent: "cyan" | "gold" | "live";
  external?: boolean;
};

const LINKS: QuickLink[] = [
  {
    href: "/guess-the-balance",
    label: "Guess the Balance",
    description: "Call the balance live and climb the board.",
    accent: "gold",
  },
  {
    href: "/bonus-hunts",
    label: "Bonus Hunts",
    description: "Track slots, wins, and break-even in real time.",
    accent: "cyan",
  },
  {
    href: "/giveaways",
    label: "Giveaways",
    description: "Enter with a chat keyword and spin the winner wheel.",
    accent: "live",
  },
  {
    href: "/leaderboard",
    label: "Leaderboard",
    description: "See who is wagering the most this month.",
    accent: "cyan",
  },
  {
    href: "/rewards",
    label: "Rewards",
    description: "Streamer perks, codes, and community drops.",
    accent: "gold",
  },
  {
    href: "/account",
    label: "Kick Account",
    description: "Sign in with Kick to save your profile on site.",
    accent: "cyan",
  },
];

export function HomeQuickLinks() {
  return (
    <section
      id="features"
      className={styles.section}
      aria-labelledby="home-quick-links"
    >
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Site features</p>
        <h2 id="home-quick-links" className={styles.title}>
          Jump in
        </h2>
        <p className={styles.lead}>
          Everything from bonus hunts to chat giveaways — pick a spot and go.
        </p>
      </div>

      <ul className={styles.grid}>
        {LINKS.map((link) => (
          <li key={link.href}>
            {link.external ? (
              <a
                className={styles.card}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                data-accent={link.accent}
              >
                <CardBody link={link} />
              </a>
            ) : (
              <Link
                className={styles.card}
                href={link.href}
                data-accent={link.accent}
              >
                <CardBody link={link} />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CardBody({ link }: { link: QuickLink }) {
  return (
    <>
      <span className={styles.cardLabel}>{link.label}</span>
      <span className={styles.cardDesc}>{link.description}</span>
      <span className={styles.cardArrow} aria-hidden />
    </>
  );
}
