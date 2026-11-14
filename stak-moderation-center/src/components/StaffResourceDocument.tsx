"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PortalShell from "@/components/PortalShell";
import styles from "./StaffResourceDocument.module.css";

type DocumentSection = { title: string; paragraphs: string[] };
type ResourceDocument = {
  title: string;
  subtitle: string;
  intro: string;
  sections: DocumentSection[];
};

function ResourceBody({ slug }: { slug: string }) {
  const [document, setDocument] = useState<ResourceDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDocument = useCallback(async () => {
    const response = await fetch(
      "/api/staff/resources?document=" + encodeURIComponent(slug),
      { credentials: "include", cache: "no-store" },
    );
    const data = await response.json() as { document?: ResourceDocument; error?: string };
    if (!response.ok || !data.document) {
      throw new Error(data.error || "The resource could not be loaded.");
    }
    return data.document;
  }, [slug]);

  useEffect(() => {
    let active = true;
    fetchDocument()
      .then((result) => { if (active) setDocument(result); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "The resource could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetchDocument]);

  async function retryLoad() {
    setLoading(true);
    setError(null);
    try { setDocument(await fetchDocument()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The resource could not be loaded."); }
    finally { setLoading(false); }
  }

  return (
    <main className={styles.page}>
      <Link className={styles.backLink} href="/staff-resources">← Resources</Link>
      {loading ? <div className={styles.state} role="status">Loading staff resource…</div> : null}
      {error ? (
        <div className={styles.error} role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void retryLoad()}>Try again</button>
        </div>
      ) : null}
      {document ? (
        <article>
          <header className={styles.heading}>
            <span className={styles.eyebrow}>STAFF KNOWLEDGE BASE · INTERNAL</span>
            <h1>{document.title}</h1>
            <p className={styles.subtitle}>{document.subtitle}</p>
            {document.intro ? <p className={styles.intro}>{document.intro}</p> : null}
          </header>
          <div className={styles.sectionList}>
            {document.sections.map((section) => (
              <section className={styles.section} key={section.title}>
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph, index) => (
                  <p key={section.title + "-" + index}>{paragraph}</p>
                ))}
              </section>
            ))}
          </div>
          <Link className={styles.backLink} href="/staff-resources">← Back to Resources</Link>
        </article>
      ) : null}
    </main>
  );
}

export default function StaffResourceDocument({ slug }: { slug: string }) {
  return (
    <PortalShell access="staff">
      {() => <ResourceBody slug={slug} />}
    </PortalShell>
  );
}

