import { useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Landing } from "@/features/home/components/Landing";

const Home = () => {
  // Arriving with a hash (e.g. from the 404 page nav) should land on that
  // section. Retry briefly in case images are still pushing layout around.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    let tries = 0;
    let timer = 0;
    const go = () => {
      document.getElementById(id)?.scrollIntoView({ behavior: "auto" });
      if (tries++ < 10) timer = window.setTimeout(go, 90);
    };
    go();
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <Layout bare>
      <Landing />
    </Layout>
  );
};

export default Home;
