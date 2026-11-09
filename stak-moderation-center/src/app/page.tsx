import styles from "./home.module.css";

export default function HomePage() {
  return (
    <main className={styles.page}>
      {/* Navigation */}
      <header className={styles.header}>
        <a href="/" className={styles.logo}>
          STAK<span>.</span>
        </a>

        <nav className={styles.navigation}>
          <a href="#home">Home</a>
          <a href="#about">About</a>
          <a href="#community">Community</a>
          <a href="#staff">Staff</a>
        </nav>

        <a
          href="/api/auth/discord"
          className={styles.connectButton}
        >
          Connect with Discord
        </a>
      </header>

      {/* Hero */}
      <section id="home" className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.badge}>
            <span className={styles.statusDot}></span>
            STAK COMMUNITY
          </div>

          <h1>
            Welcome to
            <br />
            <span>STAK.</span>
          </h1>

          <p className={styles.heroDescription}>
            A community built on teamwork, interaction and shared
            experiences. Discover STAK, become part of our community
            or join our team.
          </p>

          <div className={styles.heroActions}>
            <a
              href="/api/auth/discord"
              className={styles.primaryButton}
            >
              Connect with Discord <span>→</span>
            </a>

            <a href="#about" className={styles.secondaryButton}>
              Discover STAK
            </a>
          </div>
        </div>

        <div className={styles.heroDecoration}>
          <div className={styles.glow}></div>
          <div className={styles.bigLogo}>S</div>
          <div className={styles.decorationText}>COMMUNITY · TEAM · STAK</div>
        </div>
      </section>

      {/* About */}
      <section id="about" className={styles.section}>
        <div className={styles.sectionHeading}>
          <span className={styles.eyebrow}>ABOUT US</span>
          <h2>More than just a community.</h2>
          <p>
            STAK brings people together through shared interests,
            community activities and a dedicated team.
          </p>
        </div>

        <div className={styles.cards}>
          <article className={styles.card}>
            <div className={styles.cardNumber}>01</div>
            <h3>Our Community</h3>
            <p>
              Meet new people, connect with other members and become
              part of the STAK community.
            </p>
          </article>

          <article className={styles.card}>
            <div className={styles.cardNumber}>02</div>
            <h3>Our Team</h3>
            <p>
              Our team supports the community, assists members and
              helps maintain an organized environment.
            </p>
          </article>

          <article className={styles.card}>
            <div className={styles.cardNumber}>03</div>
            <h3>Our Platform</h3>
            <p>
              Access important information, applications and
              community services through one central platform.
            </p>
          </article>
        </div>
      </section>

      {/* Community */}
      <section id="community" className={styles.communitySection}>
        <div>
          <span className={styles.eyebrow}>JOIN THE COMMUNITY</span>
          <h2>Become part of STAK.</h2>
          <p>
            Connect with our Discord community and stay up to date
            with everything happening at STAK.
          </p>
        </div>

        <a
          href="https://discord.com/"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.primaryButton}
        >
          Visit Discord <span>↗</span>
        </a>
      </section>

      {/* Staff */}
      <section id="staff" className={styles.staffSection}>
        <div className={styles.sectionHeading}>
          <span className={styles.eyebrow}>JOIN OUR TEAM</span>
          <h2>Interested in becoming Staff?</h2>
          <p>
            Become part of the STAK team and help us support and
            develop our community.
          </p>
        </div>

        <div className={styles.applicationBox}>
          <div>
            <h3>Staff Applications</h3>
            <p>
              Connect your Discord account and submit your
              application through our application portal.
            </p>
          </div>

          <a href="/apply" className={styles.primaryButton}>
            Apply for Staff <span>→</span>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <a href="/" className={styles.logo}>
          STAK<span>.</span>
        </a>

        <p>© {new Date().getFullYear()} STAK. All rights reserved.</p>

        <div>
          <a href="#about">About</a>
          <a href="#community">Community</a>
          <a href="#staff">Staff Applications</a>
        </div>
      </footer>
    </main>
  );
}