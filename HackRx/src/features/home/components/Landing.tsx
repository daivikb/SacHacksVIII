import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRegistrationDialog } from "@/components/layout/Layout";
import { useApplicationsOpen } from "@/config/deadlines";
import { useAuth } from "@/context/auth-context";
import { prize1, prize2, prize3, prize4, prize5, sachackslogo } from "@/assets/images";
import "@/styles/landing.css";

/* --------------------------------- data ---------------------------------- */

const VENUE_URL =
  "https://maps.google.com/maps/place//data=!4m2!3m1!1s0x809ad07bc6624077:0x5be7814fdb410f19?entry=s&sa=X&ved=2ahUKEwjLiOyutYOYAxXRDTQIHYKRJfwQ4kB6BAgnEAA&hl=en";

const prizes = [
  { track: "Best Translational Science", blurb: "For the team moving discovery to bedside fastest.", prize: "Bose QuietComfort SC Headphones", sponsor: "BME Department at UC Davis", img: prize1 },
  { track: "Best Clinical Impact", blurb: "For the build most likely to improve patient outcomes.", prize: "Samsung 34\" ViewFinity UWQHD 120Hz ultra-wide curved monitor", sponsor: "Abridge", img: prize2 },
  { track: "Best Biotech Innovation", blurb: "For new work in hardware, wetware, or data.", prize: "SanDisk Extreme Go Portable SSD (1TB)", sponsor: "Base44", img: prize3 },
  { track: "Health Equity Award", blurb: "For the build that widens access to care.", prize: "Bose SoundLink Home Bluetooth Speaker", sponsor: "Betty Irene Moore School of Nursing", img: prize4 },
  { track: "Best Interdisciplinary Hack", blurb: "Best overall hack across disciplines.", prize: "Chance to win an Atari Gamestation Go handheld bundle with gamepad (Gold)", sponsor: "UC Davis College of L&S and MBA Program", img: prize5 },
];

const timeline = [
  { date: "Oct 12", what: "Applications open", body: "Registration opens." },
  { date: "Nov 12", what: "Applications close", body: "Last call: applications close at 11:59pm." },
  { date: "Nov 15", what: "Hack day", body: "Day of the event, in person in Sacramento." },
];

const sponsorTiers = [
  {
    label: "Jubilee",
    items: [
      { name: "M.S. Program of Medical Device Development", logo: "/sponsors/medical-device.png", url: "https://bme.ucdavis.edu/graduate/medical-device" },
      { name: "Abridge", logo: "/sponsors/abridge.png", url: "https://www.abridge.com/" },
    ],
  },
  {
    label: "Compute",
    items: [{ name: "Base44", logo: "/sponsors/base44.png", url: "https://base44.com/" }],
  },
  {
    label: "Platinum",
    items: [
      { name: "UC Davis College of Letters & Sciences", logo: "/sponsors/letters-sciences.png", url: "https://lettersandscience.ucdavis.edu/" },
      { name: "UC Davis Graduate School of Management MSBA", logo: "/sponsors/gsm-msba.png", url: "https://gsm.ucdavis.edu/master-science-business-analytics" },
      { name: "UC Davis Health Betty Irene Moore School of Nursing", logo: "/sponsors/nursing.png", url: "https://health.ucdavis.edu/nursing/" },
    ],
  },
  {
    label: "Gold",
    items: [
      { name: "NordVPN", logo: "/sponsors/nordvpn.svg", url: "https://nordvpn.com/" },
      { name: "UC Davis Department of Computer Science", logo: "/sponsors/computer-science.png", url: "https://cs.ucdavis.edu/" },
    ],
  },
];

const faqs = [
  {
    q: "When and where?",
    a: (
      <>
        <a href={VENUE_URL} target="_blank" rel="noreferrer">Betty Irene Moore School of Nursing</a> in
        Sacramento, CA, on Sunday, November 15th.
      </>
    ),
  },
  { q: "Who can attend?", a: "Any college student or recent graduate is welcome to participate in SacHacks!" },
  { q: "When is the application deadline?", a: "Thursday, November 12th at 11:59pm." },
  { q: "What is a hackathon?", a: "A hackathon is an event where students team up, build a project in a short window, and compete for prizes." },
  { q: "What is the maximum team size?", a: "Teams should be of 1-3 members. No more than 3 allowed on a single team." },
];

const team = [
  { role: "President", name: "Daivik (Dave) Bhardwaj" },
  { role: "Vice-President & VP of Logistics", name: "Munneth Gill" },
  { role: "VP of Software", name: "Shlok Khare" },
  { role: "VP of Marketing", name: "Melissa Li" },
  { role: "Director of Logistics", name: "Shaffana Mustafa" },
  { role: "Director of Logistics", name: "Aditi Dantaluri" },
  { role: "Director of Software", name: "Vedant Chaudhary" },
  { role: "Director of Software", name: "Ryan Mathur" },
  { role: "Director of Software", name: "Jeremy Phan" },
  { role: "Director of Logistics", name: "Kartik Yedumbaka" },
  { role: "Director of Logistics", name: "Rigo Lemus" },
  { role: "Director of Logistics", name: "Maisie Wong" },
];

const LINKS = [
  { id: "prizes", label: "Prizes" },
  { id: "timeline", label: "Timeline" },
  { id: "sponsors", label: "Sponsors" },
  { id: "faq", label: "FAQ" },
  { id: "team", label: "Team" },
];

/* ------------------------------- pieces ---------------------------------- */

/** Primary call to action: register while open, log in after. */
const useCta = () => {
  const { setOpen } = useRegistrationDialog();
  const open = useApplicationsOpen();
  return { label: open ? "Register" : "Log in", onClick: () => setOpen(true), open };
};

const TopNav = () => {
  const { user } = useAuth();
  const { openAuth } = useRegistrationDialog();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`lx-nav${scrolled ? " is-scrolled" : ""}`}>
      <div className="lx-wrap lx-nav-inner">
        <a href="#top" className="lx-word" aria-label="HackRx, back to top">
          Hack<span>Rx</span>
        </a>
        <nav aria-label="Sections" className={`lx-nav-links${menuOpen ? " is-open" : ""}`}>
          {LINKS.map((l) => (
            <a key={l.id} href={`#${l.id}`} onClick={() => setMenuOpen(false)}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="lx-nav-actions">
          {user ? (
            <button type="button" className="lx-btn lx-btn-dark lx-btn-sm" onClick={() => navigate("/dashboard")}>
              Hacker Hub
            </button>
          ) : (
            <button type="button" className="lx-btn lx-btn-dark lx-btn-sm" onClick={() => openAuth("login")}>
              Log in
            </button>
          )}
          <button
            type="button"
            className="lx-burger"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span />
            <span />
          </button>
        </div>
      </div>
    </header>
  );
};

const RxCard = () => {
  const open = useApplicationsOpen();
  const rows: Array<[string, React.ReactNode]> = [
    ["Date", "Sunday, November 15"],
    ["Location", <a href={VENUE_URL} target="_blank" rel="noreferrer">Betty Irene Moore School of Nursing, Sacramento</a>],
    ["Format", "One day, in person"],
    ["Teams", "1 to 3 people"],
    ["Open to", "College students and recent graduates"],
    ["Applications", open ? "Open until Nov 12, 11:59pm" : "Closed Nov 12"],
  ];
  return (
    <aside className="lx-rx" aria-label="Event details">
      <div className="lx-rx-head">
        <span className="lx-rx-glyph" aria-hidden="true">℞</span>
        <div>
          <p className="lx-mono">SacHacks VIII</p>
          <p className="lx-rx-title">HackRx 2026</p>
        </div>
      </div>
      <dl className="lx-rx-rows">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
};

const SectionHead = ({ label, title, children }: { label: string; title: string; children?: React.ReactNode }) => (
  <div className="lx-head">
    <p className="lx-mono lx-label">{label}</p>
    <h2>{title}</h2>
    {children}
  </div>
);

/* --------------------------------- page ---------------------------------- */

export const Landing = () => {
  const cta = useCta();
  const { openAuth } = useRegistrationDialog();

  return (
    <div className="lx" id="top">
      <TopNav />

      <main>
        <section className="lx-hero">
          <div className="lx-wrap lx-hero-grid">
            <div className="lx-hero-copy">
              <p className="lx-mono lx-label">AI-era medical hackathon</p>
              <h1>
                Prescribe <em>innovation.</em>
              </h1>
              <p className="lx-lede">
                A one-day hackathon in Sacramento for students building tools for translational medicine
                and biomedical research.
              </p>
              <div className="lx-actions">
                <button type="button" className="lx-btn lx-btn-accent" onClick={cta.onClick}>
                  {cta.label}
                </button>
                <a href="#prizes" className="lx-btn lx-btn-ghost">
                  See the prizes
                </a>
              </div>
              {!cta.open && (
                <p className="lx-note">Applications closed November 12. Already applied? Log in to check your status.</p>
              )}
            </div>
            <RxCard />
          </div>
        </section>

        <section className="lx-section lx-brief" id="brief">
          <div className="lx-wrap lx-split">
            <p className="lx-mono lx-label">The brief</p>
            <div>
              <h2>Diagnose the problem. Prescribe the fix.</h2>
              <p className="lx-big">
                Here is our diagnosis: translational medicine moves too slowly, and biomedical research is harder
                to run and harder to reach than it should be. Build the technology, platform, or workflow that
                fixes part of it. What would you prescribe?
              </p>
            </div>
          </div>
        </section>

        <section className="lx-section" id="prizes">
          <div className="lx-wrap">
            <SectionHead label="Tracks & prizes" title="Five first-place awards" />
            <ol className="lx-prizes">
              {prizes.map((p, i) => (
                <li className="lx-prize" key={p.track}>
                  <div className="lx-prize-img">
                    <img src={p.img} alt={p.prize} loading="lazy" />
                  </div>
                  <div className="lx-prize-body">
                    <p className="lx-mono lx-prize-num">{String(i + 1).padStart(2, "0")}</p>
                    <h3>{p.track}</h3>
                    <p className="lx-muted">{p.blurb}</p>
                    <p className="lx-prize-item">{p.prize}</p>
                    <p className="lx-mono lx-prize-sponsor">Sponsored by {p.sponsor}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="lx-section lx-alt" id="timeline">
          <div className="lx-wrap">
            <SectionHead label="Timeline" title="Dates to know" />
            <ol className="lx-timeline">
              {timeline.map((t) => (
                <li key={t.what}>
                  <span className="lx-dot" aria-hidden="true" />
                  <p className="lx-mono lx-date">{t.date}</p>
                  <h3>{t.what}</h3>
                  <p className="lx-muted">{t.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="lx-section" id="sponsors">
          <div className="lx-wrap">
            <SectionHead label="Sponsors" title="Thanks to our sponsors" />
            <div className="lx-tiers">
              {sponsorTiers.map((tier) => (
                <div className="lx-tier" key={tier.label} role="group" aria-label={`${tier.label} sponsors`}>
                  <p className="lx-mono lx-tier-label">{tier.label}</p>
                  <div className="lx-logos">
                    {tier.items.map((s) => (
                      <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" className="lx-logo" title={s.name}>
                        <img src={s.logo} alt={s.name} loading="lazy" />
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lx-section lx-alt" id="faq">
          <div className="lx-wrap lx-split">
            <SectionHead label="FAQ" title="Common questions">
              <p className="lx-muted">
                Something else?{" "}
                <button type="button" className="lx-link" onClick={() => openAuth("contact")}>
                  Contact us
                </button>
                .
              </p>
            </SectionHead>
            <div className="lx-faq">
              {faqs.map((f, i) => (
                <details key={f.q} open={i === 0}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="lx-section" id="team">
          <div className="lx-wrap">
            <SectionHead label="SacHacks staff" title="The organizing team" />
            <ul className="lx-team">
              {team.map((p) => (
                <li key={p.name}>
                  <p className="lx-team-name">{p.name}</p>
                  <p className="lx-mono lx-team-role">{p.role}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="lx-footer" id="register">
        <div className="lx-wrap">
          <div className="lx-cta">
            <div>
              <p className="lx-mono lx-label">Join the response team</p>
              <h2>The world needs new heroes. Will you answer?</h2>
            </div>
            <button type="button" className="lx-btn lx-btn-light" onClick={cta.onClick}>
              {cta.label}
            </button>
          </div>
          <div className="lx-footer-row">
            <img src={sachackslogo} alt="SacHacks" className="lx-footer-logo" />
            <p>Sunday, November 15 · Betty Irene Moore School of Nursing</p>
            <div className="lx-footer-links">
              <button type="button" onClick={() => openAuth("contact")}>Contact us</button>
              <button type="button" onClick={() => openAuth("admin")}>Admin</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
